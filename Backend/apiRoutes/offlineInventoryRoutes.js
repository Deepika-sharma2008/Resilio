const express = require("express");
const router = express.Router();

const Ingredient = require("../datamodels/Ingredient");
const StockBatch = require("../datamodels/StockBatch");
const StockQuantity = require("../datamodels/StockQuantity");

const syncedOperations = new Map();
const inFlightOperations = new Map();

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

    return match ? Math.max(max, Number(match[1])) : max;
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
  } = req.body || {};

  const normalizedUnit = unit === "pcs" ? "piece" : unit;

  if (
    typeof operationId !== "string" ||
    !operationId.trim() ||
    typeof ingredientName !== "string" ||
    !ingredientName.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Operation ID and ingredient name are required.",
    });
  }

  const amount = Number(quantity);
  const minimum = Number(minimumStock);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be a positive number.",
    });
  }

  if (!Number.isFinite(minimum) || minimum < 0) {
    return res.status(400).json({
      success: false,
      message: "Minimum stock must be zero or greater.",
    });
  }

  const allowedUnits = ["kg", "g", "litre", "ml", "piece"];

  if (!allowedUnits.includes(normalizedUnit)) {
    return res.status(400).json({
      success: false,
      message: `Unsupported measurement unit: ${unit}`,
    });
  }

  const operationKey = operationId.trim();

  // Return the previous result if this operation has already completed.
  if (syncedOperations.has(operationKey)) {
    return res.status(200).json({
      success: true,
      message: "This operation was already processed.",
      data: syncedOperations.get(operationKey),
      alreadyProcessed: true,
    });
  }

  // Avoid two concurrent requests processing the same operation.
  if (inFlightOperations.has(operationKey)) {
    try {
      const result = await inFlightOperations.get(operationKey);

      return res.status(200).json({
        success: true,
        message: "Inventory operation processed.",
        data: result,
        alreadyProcessed: true,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || "Inventory sync failed.",
      });
    }
  }

  const operationPromise = (async () => {
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
        minimumStock: minimum,
      });
    } else {
      if (ingredient.unit !== normalizedUnit) {
        throw new Error(
          `The existing ingredient uses ${ingredient.unit}, not ${normalizedUnit}.`
        );
      }

      if (ingredient.isActive === false) {
        throw new Error(
          "This ingredient is inactive. Reactivate it before adding stock."
        );
      }
    }

    const batch = await StockBatch.create({
      batchCode: generateBatchCode(),
      ingredientId: ingredient._id,
      quantityReceived: amount,
      quantityRemaining: amount,
      unitCost: 0,
      totalCost: 0,
      receivedDate: new Date(),
      status: "ACTIVE",
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

    return {
      ingredientId: ingredient._id,
      ingredientName: ingredient.name,
      unit: normalizedUnit,
      quantityAdded: amount,
      batchId: batch._id,
      totalQuantity: stock.totalQuantity,
    };
  })();

  inFlightOperations.set(operationKey, operationPromise);

  try {
    const result = await operationPromise;

    syncedOperations.set(operationKey, result);

    return res.status(200).json({
      success: true,
      message: "Offline inventory entry synced successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Offline inventory sync error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Offline inventory sync failed.",
    });
  } finally {
    inFlightOperations.delete(operationKey);
  }
});

module.exports = router;