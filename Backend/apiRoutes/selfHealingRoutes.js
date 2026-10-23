
const express = require("express");
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const Ingredient = require("../datamodels/Ingredient");
const {
  reconcileIngredient,
} = require("../inventoryLogic/stockReconciliationLogic");

const router = express.Router();

const incidents = [];
const activeFailures = new Set();

const failureTypes = {
  inventory: "Inventory Consistency Failure",
  database: "Database Request Failure",
  order: "Order Processing Failure",
  api: "API Timeout Failure",
};

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function retry(operation, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await operation();
      return { success: true, attempts: attempt, result };
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await delay(500 * Math.pow(2, attempt - 1));
      }
    }
  }

  return {
    success: false,
    attempts,
    error: lastError?.message || "Recovery failed",
  };
}

function saveIncident(data) {
  const incident = {
    id: randomUUID(),
    timestamp: new Date(),
    ...data,
  };

  incidents.unshift(incident);

  // Keep recent history limited in memory.
  if (incidents.length > 100) incidents.length = 100;

  return incident;
}

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    status:
      mongoose.connection.readyState === 1
        ? "HEALTHY"
        : "DEGRADED",
    database:
      mongoose.connection.readyState === 1
        ? "CONNECTED"
        : "DISCONNECTED",
    activeFailures: activeFailures.size,
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Get ingredients for the admin dashboard
router.get("/ingredients", async (req, res) => {
  try {
    const ingredients = await Ingredient.find().lean();

    res.json({
      success: true,
      ingredients,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Reconcile a real ingredient using your existing logic
router.post(
  "/inventory/reconcile/:ingredientId",
  async (req, res) => {
    const { ingredientId } = req.params;
    const startedAt = Date.now();

    if (!mongoose.isValidObjectId(ingredientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ingredient ID",
      });
    }

    try {
      const result = await retry(async () => {
        if (mongoose.connection.readyState !== 1) {
          throw new Error("MongoDB is not connected");
        }

        return await reconcileIngredient(ingredientId);
      });

      const incident = saveIncident({
        type: "inventory",
        title: failureTypes.inventory,
        status: result.success ? "RECOVERED" : "FAILED",
        recoveryTimeMs: Date.now() - startedAt,
        attempts: result.attempts,
        details: result.success
          ? "Inventory reconciliation executed."
          : result.error,
      });

      return res.status(result.success ? 200 : 503).json({
        success: result.success,
        incident,
        reconciliation: result.result || null,
        message: result.success
          ? "Reconciliation completed. Verify the resulting quantities."
          : "Automatic reconciliation failed.",
      });
    } catch (error) {
      const incident = saveIncident({
        type: "inventory",
        title: failureTypes.inventory,
        status: "FAILED",
        recoveryTimeMs: Date.now() - startedAt,
        details: error.message,
      });

      return res.status(500).json({
        success: false,
        incident,
        message: error.message,
      });
    }
  }
);

// Failure simulator for admin demonstration
router.post("/simulate/:type", async (req, res) => {
  const { type } = req.params;

  if (!failureTypes[type]) {
    return res.status(400).json({
      success: false,
      message: "Unknown failure type",
      allowedTypes: Object.keys(failureTypes),
    });
  }

  if (activeFailures.has(type)) {
    return res.status(409).json({
      success: false,
      message: "This failure is already being processed",
    });
  }

  activeFailures.add(type);
  const startedAt = Date.now();

  try {
    let recovery;

    if (type === "database") {
      // Checks the actual MongoDB connection.
      recovery = await retry(async () => {
        if (mongoose.connection.readyState !== 1) {
          throw new Error("MongoDB connection unavailable");
        }

        await Ingredient.findOne().select("_id").lean();
        return "Database request succeeded";
      });
    } else if (type === "order") {
      // Demonstration only: no real order is created.
      recovery = await retry(async () => {
        await delay(300);
        return "Simulated order-processing retry succeeded";
      });
    } else if (type === "api") {
      // Demonstration only: no external API is called.
      recovery = await retry(async () => {
        await delay(300);
        return "Simulated API retry succeeded";
      });
    } else {
      return res.status(400).json({
        success: false,
        message:
          "For real inventory healing, select an ingredient and use the reconcile endpoint.",
      });
    }

    const incident = saveIncident({
      type,
      title: failureTypes[type],
      status: recovery.success ? "RECOVERED" : "FAILED",
      attempts: recovery.attempts,
      recoveryTimeMs: Date.now() - startedAt,
      details: recovery.success
        ? recovery.result
        : recovery.error,
    });

    return res.status(recovery.success ? 200 : 503).json({
      success: recovery.success,
      incident,
      message: recovery.success
        ? "Recovery completed"
        : "Recovery unsuccessful",
    });
  } catch (error) {
    const incident = saveIncident({
      type,
      title: failureTypes[type],
      status: "FAILED",
      recoveryTimeMs: Date.now() - startedAt,
      details: error.message,
    });

    return res.status(500).json({
      success: false,
      incident,
      message: error.message,
    });
  } finally {
    activeFailures.delete(type);
  }
});

// Incident history
router.get("/history", (req, res) => {
  res.json({
    success: true,
    total: incidents.length,
    incidents,
  });
});



router.post("/database-failure", async (req, res) => {
  const startedAt = Date.now();
  const events = [];

  const log = (message) => {
    events.push({
      message,
      time: new Date(),
    });

    console.log("[SELF-HEALING]", message);
  };

  try {
    const uri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MongoDB URI environment variable missing");
    }

    log("Controlled database disconnection started");

    // Disconnect only the application's MongoDB connection.
    await mongoose.disconnect();

    log("Database connection interrupted");

    let recovered = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!recovered && attempts < maxAttempts) {
      attempts++;

      log(`Reconnection attempt ${attempts}/${maxAttempts}`);

      try {
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 3000,
        });

        await mongoose.connection.db.admin().ping();

        recovered = true;
        log("Database connection restored and verified");
      } catch (error) {
        log(`Attempt ${attempts} failed: ${error.message}`);

        if (attempts < maxAttempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * attempts)
          );
        }
      }
    }

    const recoveryTimeMs = Date.now() - startedAt;

    const incident = {
      type: "database",
      status: recovered ? "RECOVERED" : "FAILED",
      attempts,
      recoveryTimeMs,
      events,
      timestamp: new Date(),
    };

    saveIncident(incident);

    res.status(recovered ? 200 : 503).json({
      success: recovered,
      incident,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      events,
    });
  }
});

module.exports = router;
