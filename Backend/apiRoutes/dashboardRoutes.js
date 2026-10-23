
const express = require('express');

const router = express.Router();
const Ingredient = require('../datamodels/Ingredient');
const Supplier = require('../datamodels/Supplier');
const StockQuantity = require('../datamodels/StockQuantity');
const StockBatch = require('../datamodels/StockBatch');
const StockMovement = require('../datamodels/StockMovement');
const StockAlert = require('../datamodels/StockAlert');

// GET: Inventory dashboard summary
router.get('/inventory', async (req, res) => {
    try {
        const now = new Date();

        const sevenDaysLater = new Date(now);
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

        const [
            ingredients,
            quantities,
            batches,
            activeSupplierCount,
            openAlertCount,
            recentAlerts,
            recentMovements
        ] = await Promise.all([
            Ingredient.find({ isActive: true })
                .select('ingredientCode name category unit minimumStock')
                .sort({ name: 1 }),

            StockQuantity.find()
                .select('ingredientId totalQuantity lastUpdatedAt'),

            StockBatch.find({
                quantityRemaining: { $gt: 0 }
            })
                .populate(
                    'ingredientId',
                    'ingredientCode name category unit minimumStock'
                )
                .populate('supplierId', 'supplierCode name')
                .sort({ expiryDate: 1 }),

            Supplier.countDocuments({ isActive: true }),

            StockAlert.countDocuments({ status: 'Open' }),

            StockAlert.find({ status: 'Open' })
                .populate('ingredientId', 'ingredientCode name unit')
                .populate('batchId', 'batchCode expiryDate')
                .sort({ detectedAt: -1 })
                .limit(5),

            StockMovement.find()
                .populate('ingredientId', 'ingredientCode name unit')
                .populate('batchId', 'batchCode')
                .sort({ movementDate: -1 })
                .limit(5)
        ]);

        // Get the current quantity for each ingredient.
        const quantityMap = new Map(
            quantities.map(item => [
                String(item.ingredientId),
                Number(item.totalQuantity || 0)
            ])
        );

        const ingredientStock = ingredients.map(ingredient => {
            const currentQuantity =
                quantityMap.get(String(ingredient._id)) ?? 0;

            const minimumStock = Number(
                ingredient.minimumStock || 0
            );

            return {
                _id: ingredient._id,
                ingredientCode: ingredient.ingredientCode,
                name: ingredient.name,
                category: ingredient.category,
                unit: ingredient.unit,
                currentQuantity,
                minimumStock
            };
        });

        const outOfStockIngredients = ingredientStock.filter(
            item => item.currentQuantity <= 0
        );

        const lowStockIngredients = ingredientStock.filter(
            item =>
                item.currentQuantity > 0 &&
                item.minimumStock > 0 &&
                item.currentQuantity <= item.minimumStock
        );

        // Group stock quantities by unit so incompatible units
        // are never combined into a misleading total.
        const stockByUnitMap = new Map();

        for (const item of ingredientStock) {
            const unit = item.unit || 'Unknown';

            stockByUnitMap.set(
                unit,
                (stockByUnitMap.get(unit) || 0) +
                    item.currentQuantity
            );
        }

        const stockByUnit = Array.from(
            stockByUnitMap,
            ([unit, totalQuantity]) => ({
                unit,
                totalQuantity
            })
        );

        // Expiry warnings are calculated from batch dates.
        // These are dashboard calculations, not automatically
        // created StockAlert documents.
        const expiredBatches = [];
        const nearExpiryBatches = [];
        const expiryUnknownBatches = [];

        for (const batch of batches) {
            const item = {
                _id: batch._id,
                batchCode: batch.batchCode,
                ingredient: batch.ingredientId,
                supplier: batch.supplierId,
                quantityRemaining: batch.quantityRemaining,
                unitCost: batch.unitCost,
                expiryDate: batch.expiryDate,
                status: batch.status
            };

            if (!batch.expiryDate) {
                expiryUnknownBatches.push(item);
                continue;
            }

            const expiryDate = new Date(batch.expiryDate);

            if (expiryDate < now) {
                expiredBatches.push(item);
            } else if (expiryDate <= sevenDaysLater) {
                nearExpiryBatches.push(item);
            }
        }

        res.status(200).json({
            success: true,
            generatedAt: now,

            summary: {
                activeIngredientCount: ingredients.length,
                activeSupplierCount,

                ingredientsWithStockCount:
                    ingredientStock.filter(
                        item => item.currentQuantity > 0
                    ).length,

                outOfStockCount: outOfStockIngredients.length,
                lowStockCount: lowStockIngredients.length,

                stockByUnit,

                openAlertCount,

                expiredBatchCount: expiredBatches.length,
                nearExpiryBatchCount: nearExpiryBatches.length,
                expiryUnknownBatchCount: expiryUnknownBatches.length
            },

            lowStockIngredients: lowStockIngredients.slice(0, 5),
            outOfStockIngredients: outOfStockIngredients.slice(0, 5),

            expiryWarnings: {
                expiredBatches: expiredBatches.slice(0, 5),
                nearExpiryBatches: nearExpiryBatches.slice(0, 5),
                expiryUnknownBatches: expiryUnknownBatches.slice(0, 5)
            },

            recentAlerts,
            recentMovements
        });
    } catch (error) {
        console.error('Inventory dashboard error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to load inventory dashboard.',
            error: error.message
        });
    }
});

module.exports = router;
