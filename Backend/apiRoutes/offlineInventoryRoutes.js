
const express = require("express");
const router = express.Router();

const Ingredient = require("../datamodels/Ingredient");
const StockBatch = require("../datamodels/StockBatch");
const StockQuantity = require("../datamodels/StockQuantity");

const syncedOperations = new Map();

function generateBatchCode() {
  return `OFF-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

async function generateIngredientCode() {
  const ingredients = await Ingredient.find(
    { ingredientCode: /^ING-\d+$/i },
    { ingredientCode: 1 }
  ).lean();

  const largest = ingredients.reduce((max, item) => {
    const match = item.ingredientCode?.match(/^ING-(\d+)$/i);

    return match
      ? Math.max(max, Number(match[1]))
      : max;
  }, 0);

  return `ING-${String(largest + 1).padStart(3, "0")}`;
}

router.post("/offline-sync", async (req, res) => {
  const {
    operationId,
    ingredientName,
    quantity,
    unit,
    category = "Vegetables",
    minimumStock = 5,
    ingredientCode,
  } = req.body;

  const normalizedUnit =
    unit === "pcs" ? "piece" : unit;

  if (
    !operationId ||
    typeof ingredientName !== "string" ||
    !ingredientName.trim()
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Operation ID and ingredient name are required.",
    });
  }

  const amount = Number(quantity);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be a positive number.",
    });
  }

  const allowedUnits = [
    "kg",
    "g",
    "litre",
    "ml",
    "piece",
  ];

  if (!allowedUnits.includes(normalizedUnit)) {
    return res.status(400).json({
      success: false,
      message: `Unsupported measurement unit: ${unit}`,
    });
  }

  if (syncedOperations.has(operationId)) {
    return res.status(200).json({
      success: true,
      message: "This operation was already processed.",
      data: syncedOperations.get(operationId),
    });
  }

  try {
    const normalizedName = ingredientName.trim();

    const escapedName = normalizedName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    let ingredient = await Ingredient.findOne({
      name: {
        $regex: `^${escapedName}$`,
        $options: "i",
      },
    });

    if (!ingredient) {
      const code =
        ingredientCode?.trim().toUpperCase() ||
        await generateIngredientCode();

      ingredient = await Ingredient.create({
        ingredientCode: code,
        name: normalizedName,
        category,
        unit: normalizedUnit,
        minimumStock: Number(minimumStock) || 5,
      });
    } else if (ingredient.unit !== normalizedUnit) {
      return res.status(409).json({
        success: false,
        message:
          `The existing ingredient uses ${ingredient.unit}, ` +
          `not ${normalizedUnit}.`,
      });
    }

    const batch = await StockBatch.create({
      batchCode: generateBatchCode(),
      ingredientId: ingredient._id,
      quantityReceived: amount,
      quantityRemaining: amount,
      unitCost: 0,
      totalCost: 0,
      receivedDate: new Date(),
      status: "Available",
    });

    const stock = await StockQuantity.findOneAndUpdate(
      { ingredientId: ingredient._id },
      {
        $inc: { totalQuantity: amount },
        $set: { lastUpdatedAt: new Date() },
        $setOnInsert: { ingredientId: ingredient._id },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    const result = {
      ingredientId: ingredient._id,
      ingredientName: ingredient.name,
      unit: normalizedUnit,
      quantityAdded: amount,
      batchId: batch._id,
      totalQuantity: stock.totalQuantity,
    };

    syncedOperations.set(operationId, result);

    return res.status(200).json({
      success: true,
      message: "Offline inventory entry synced successfully.",
      data: result,
    });
  } catch (error) {
    console.error(
      "Offline inventory sync error:",
      error
    );

    return res.status(
      error.code === 11000 ? 409 : 500
    ).json({
      success: false,
      message:
        error.code === 11000
          ? "A duplicate ingredient or batch code was detected."
          : error.message ||
            "Offline inventory sync failed.",
    });
  }
});

module.exports = router;
