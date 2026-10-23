
const express = require("express");
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

// Adjust these paths according to your project folders

const Ingredient = require("../datamodels/Ingredient");
const { reconcileIngredient } = require("../inventoryLogic/stockReconciliationLogic");

const router = express.Router();
const incidents = new Map();

const failureTypes = {
    inventory: "Inventory Mismatch Test",
    database: "Database Failure Test",
    order: "Order Processing Failure Test",
    api: "API Timeout Test",
};

const delay = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

router.post("/test/:type", async (req, res) => {
    const { type } = req.params;

    if (!failureTypes[type]) {
        return res.status(400).json({
            success: false,
            message: "Unsupported failure type",
        });
    }

    const started = Date.now();

    const incident = {
        id: randomUUID(),
        type,
        title: failureTypes[type],
        status: "TESTING",
        failureDetected: false,
        recoveryVerified: false,
        recoveryTimeMs: null,
        attempts: 0,
        message: "",
        steps: [],
        startedAt: new Date().toISOString(),
    };

    const addStep = (message) => {
        incident.steps.push({
            message,
            time: new Date().toISOString(),
        });
    };

    try {
        // REAL INVENTORY RECONCILIATION
        if (type === "inventory") {
            const { ingredientId } = req.body || {};

            let ingredients;

            if (ingredientId) {
                if (!mongoose.isValidObjectId(ingredientId)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid ingredientId.",
                    });
                }

                const ingredient = await Ingredient.findById(
                    ingredientId
                ).select("_id name");

                if (!ingredient) {
                    return res.status(404).json({
                        success: false,
                        message: "Ingredient not found.",
                    });
                }

                ingredients = [ingredient];
            } else {
                // No ID supplied: inspect all active ingredients.
                ingredients = await Ingredient.find({
                    isActive: true,
                }).select("_id name");
            }

            if (ingredients.length === 0) {
                incident.status = "FAILED";
                incident.message = "No ingredients found to reconcile.";
                addStep(incident.message);

                return res.status(404).json({
                    success: false,
                    incident,
                });
            }

            incident.status = "DETECTED";
            addStep(
                `Inventory consistency check started for ${ingredients.length} ingredient(s).`
            );

            const results = [];

            for (const ingredient of ingredients) {
                incident.attempts += 1;

                addStep(
                    `Checking stock for ${ingredient.name}.`
                );

                // Existing reconciliation logic checks batches,
                // repairs StockQuantity and verifies the saved result.
                const result = await reconcileIngredient(
                    String(ingredient._id)
                );

                results.push(result);

                if (result.repaired) {
                    incident.failureDetected = true;
                    addStep(
                        `Mismatch repaired for ${ingredient.name}.`
                    );
                } else {
                    addStep(
                        `Stock verified for ${ingredient.name}.`
                    );
                }

                if (result.verificationResult !== "PASSED") {
                    throw new Error(
                        `Verification failed for ${ingredient.name}.`
                    );
                }
            }

            incident.recoveryVerified = true;

            const repairedCount = results.filter(
                (result) => result.repaired
            ).length;

            incident.status =
                repairedCount > 0 ? "RECOVERED" : "HEALTHY";

            incident.message = repairedCount > 0
                ? `Inventory reconciliation completed. ${repairedCount} ingredient(s) repaired and verified.`
                : "Inventory checked. No stock mismatch found.";

            incident.results = results;
            incident.finishedAt = new Date().toISOString();
            incident.recoveryTimeMs = Date.now() - started;

            addStep(incident.message);

            incidents.set(incident.id, incident);

            return res.status(200).json({
                success: true,
                incident,
            });
        }

        // EXISTING CONTROLLED TESTS FOR OTHER FAILURE TYPES
        async function simulatedOperation() {
            incident.attempts += 1;

            if (incident.attempts === 1) {
                throw new Error("SIMULATED_FAILURE");
            }

            return { success: true };
        }

        addStep("Controlled failure test started.");

        try {
            await simulatedOperation();
        } catch (error) {
            if (error.message !== "SIMULATED_FAILURE") {
                throw error;
            }

            incident.failureDetected = true;
            incident.status = "DETECTED";
            addStep("Controlled failure detected.");

            incident.status = "HEALING";
            addStep("Automatic retry started.");

            await delay(500);

            const result = await simulatedOperation();

            if (!result.success) {
                throw new Error("Recovery verification failed.");
            }

            incident.recoveryVerified = true;
            incident.status = "RECOVERED";
            incident.message =
                "Controlled failure detected and retry verified successfully.";

            addStep("Retry succeeded.");
            addStep("Recovery verification passed.");
        }

        incident.recoveryTimeMs = Date.now() - started;
        incident.finishedAt = new Date().toISOString();

        incidents.set(incident.id, incident);

        return res.status(200).json({
            success: true,
            incident,
        });
    } catch (error) {
        console.error(
            `Failure simulation error (${type}):`,
            error
        );

        incident.status = "FAILED";
        incident.message = error.message;
        incident.recoveryTimeMs = Date.now() - started;
        incident.finishedAt = new Date().toISOString();

        addStep(`Recovery failed: ${error.message}`);

        incidents.set(incident.id, incident);

        return res.status(500).json({
            success: false,
            message: error.message,
            incident,
        });
    }
});

router.get("/history", (req, res) => {
    return res.json({
        success: true,
        incidents: Array.from(incidents.values()).reverse(),
    });
});


let demoApiConfig = {
  baseUrl: "http://localhost:5000/api",
  timeout: 5000
};

const knownGoodApiConfig = {
  baseUrl: "http://localhost:5000/api",
  timeout: 5000
};

function validateApiConfig(config) {
  try {
    const url = new URL(config.baseUrl);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      Number.isFinite(config.timeout) &&
      config.timeout > 0
    );
  } catch {
    return false;
  }
}

router.post("/configuration", (req, res) => {
  const startedAt = Date.now();
  const incidentId = `CFG-${Date.now()}`;
    
  // Failure inject
  demoApiConfig.baseUrl = "invalid-url";

  const failureDetected = !validateApiConfig(demoApiConfig);
  const stages = ["FAILURE_INJECTED"];

  if (failureDetected) {
    stages.push("DETECTED");
    stages.push("HEALING");

    demoApiConfig = { ...knownGoodApiConfig };
  }

  const recovered = validateApiConfig(demoApiConfig);

  stages.push(recovered ? "RECOVERED" : "FAILED");

  return res.status(recovered ? 200 : 500).json({
    success: recovered,
    incidentId,
    failureType: "API Configuration Failure",
    component: "Admin API Configuration",
    failureDetected,
    healingAction: "Restored known-good API configuration",
    status: recovered ? "RECOVERED" : "FAILED",
    recoveryTimeMs: Date.now() - startedAt,
    stages
  });
});



module.exports = router;
