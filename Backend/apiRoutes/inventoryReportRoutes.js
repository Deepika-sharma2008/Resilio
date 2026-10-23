
const express = require('express');

const router = express.Router();

const Ingredient = require('../datamodels/Ingredient');
const StockQuantity = require('../datamodels/StockQuantity');
const StockBatch = require('../datamodels/StockBatch');
const StockMovement = require('../datamodels/StockMovement');

const MOVEMENT_TYPES = [
    'Stock In',
    'Stock Out',
    'Wastage',
    'Adjustment'
];

// Helper: Build current stock details from existing records.
async function getCurrentStock() {
    const [ingredients, quantities] = await Promise.all([
        Ingredient.find({ isActive: true })
            .select('ingredientCode name category unit minimumStock')
            .sort({ name: 1 })
            .lean(),

        StockQuantity.find()
            .select('ingredientId totalQuantity')
            .lean()
    ]);

    const quantityMap = new Map(
        quantities.map(item => [
            String(item.ingredientId),
            Number(item.totalQuantity || 0)
        ])
    );

    return ingredients.map(ingredient => {
        const currentQuantity =
            quantityMap.get(String(ingredient._id)) ?? 0;

        const minimumStock = Number(
            ingredient.minimumStock || 0
        );

        let stockStatus = 'In Stock';

        if (currentQuantity <= 0) {
            stockStatus = 'Out of Stock';
        } else if (
            minimumStock > 0 &&
            currentQuantity <= minimumStock
        ) {
            stockStatus = 'Low Stock';
        }

        return {
            _id: ingredient._id,
            ingredientCode: ingredient.ingredientCode,
            name: ingredient.name,
            category: ingredient.category,
            unit: ingredient.unit,
            currentQuantity,
            minimumStock,
            stockStatus
        };
    });
}

// Helper: Parse report dates.
// A date-only "to" value includes the whole UTC day.
function parseReportDate(value, endOfDay = false) {
    if (!value) return null;

    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = new Date(
        dateOnly && endOfDay
            ? `${value}T23:59:59.999Z`
            : dateOnly
                ? `${value}T00:00:00.000Z`
                : value
    );

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

// REPORT 1: Current stock by ingredient
router.get('/current-stock', async (req, res) => {
    try {
        const stock = await getCurrentStock();

        const stockByUnit = {};

        for (const item of stock) {
            stockByUnit[item.unit] =
                (stockByUnit[item.unit] || 0) +
                item.currentQuantity;
        }

        res.status(200).json({
            success: true,
            generatedAt: new Date(),
            count: stock.length,
            stockByUnit: Object.entries(stockByUnit).map(
                ([unit, totalQuantity]) => ({
                    unit,
                    totalQuantity
                })
            ),
            data: stock
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate current stock report.',
            error: error.message
        });
    }
});

// REPORT 2: Stock In/Out movement history and summary
// Optional: ?from=2026-10-01&to=2026-10-31
// Optional: ?movementType=Stock%20In
router.get('/stock-movements', async (req, res) => {
    try {
        const filter = {};

        if (req.query.from) {
            const from = parseReportDate(req.query.from);

            if (!from) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid from date.'
                });
            }

            filter.movementDate = {
                ...filter.movementDate,
                $gte: from
            };
        }

        if (req.query.to) {
            const to = parseReportDate(req.query.to, true);

            if (!to) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid to date.'
                });
            }

            filter.movementDate = {
                ...filter.movementDate,
                $lte: to
            };
        }

        if (
            filter.movementDate?.$gte &&
            filter.movementDate?.$lte &&
            filter.movementDate.$gte > filter.movementDate.$lte
        ) {
            return res.status(400).json({
                success: false,
                message: 'The from date must not be after the to date.'
            });
        }

        if (req.query.movementType) {
            if (!MOVEMENT_TYPES.includes(req.query.movementType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid movement type.'
                });
            }

            filter.movementType = req.query.movementType;
        }

        if (req.query.ingredientId) {
            const mongoose = require('mongoose');

            if (!mongoose.isValidObjectId(req.query.ingredientId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid ingredient ID.'
                });
            }

            filter.ingredientId = req.query.ingredientId;
        }

        const movements = await StockMovement.find(filter)
            .populate('ingredientId', 'ingredientCode name unit')
            .populate('batchId', 'batchCode')
            .sort({ movementDate: -1 })
            .lean();

        // Never total quantities across incompatible units.
        const summaryMap = new Map();

        for (const movement of movements) {
            const key =
                `${movement.movementType}|${movement.unit}`;

            if (!summaryMap.has(key)) {
                summaryMap.set(key, {
                    movementType: movement.movementType,
                    unit: movement.unit,
                    transactionCount: 0,
                    totalQuantity: 0
                });
            }

            const summary = summaryMap.get(key);
            summary.transactionCount += 1;
            summary.totalQuantity += movement.quantity;
        }

        res.status(200).json({
            success: true,
            generatedAt: new Date(),
            count: movements.length,
            summary: Array.from(summaryMap.values()),
            data: movements
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate stock movement report.',
            error: error.message
        });
    }
});

// REPORT 3: Inventory valuation using remaining batch quantities
router.get('/valuation', async (req, res) => {
    try {
        const batches = await StockBatch.find({
            quantityRemaining: { $gt: 0 }
        })
            .populate('ingredientId', 'ingredientCode name unit')
            .populate('supplierId', 'supplierCode name')
            .sort({ receivedDate: -1 })
            .lean();

        const valueByStatus = {};
        let totalRecordedValue = 0;

        const data = batches.map(batch => {
            const estimatedValue =
                batch.quantityRemaining * batch.unitCost;

            totalRecordedValue += estimatedValue;

            valueByStatus[batch.status] =
                (valueByStatus[batch.status] || 0) +
                estimatedValue;

            return {
                batchCode: batch.batchCode,
                ingredient: batch.ingredientId,
                supplier: batch.supplierId,
                quantityRemaining: batch.quantityRemaining,
                unitCost: batch.unitCost,
                estimatedValue: Number(estimatedValue.toFixed(2)),
                receivedDate: batch.receivedDate,
                expiryDate: batch.expiryDate,
                status: batch.status
            };
        });

        res.status(200).json({
            success: true,
            generatedAt: new Date(),
            note: 'Values use the currency recorded in unitCost.',
            totalRecordedValue: Number(totalRecordedValue.toFixed(2)),
            valueByStatus: Object.entries(valueByStatus).map(
                ([status, value]) => ({
                    status,
                    value: Number(value.toFixed(2))
                })
            ),
            count: data.length,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate inventory valuation.',
            error: error.message
        });
    }
});

// REPORT 4: Low-stock and out-of-stock ingredients
router.get('/low-stock', async (req, res) => {
    try {
        const stock = await getCurrentStock();

        const outOfStock = stock.filter(
            item => item.currentQuantity <= 0
        );

        const lowStock = stock.filter(
            item =>
                item.currentQuantity > 0 &&
                item.minimumStock > 0 &&
                item.currentQuantity <= item.minimumStock
        );

        res.status(200).json({
            success: true,
            generatedAt: new Date(),
            summary: {
                lowStockCount: lowStock.length,
                outOfStockCount: outOfStock.length
            },
            lowStock,
            outOfStock
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate low-stock report.',
            error: error.message
        });
    }
});

// REPORT 5: Expired, near-expiry, and unknown-expiry batches
// Optional: ?days=7 (allowed range 1 to 90)
router.get('/expiry', async (req, res) => {
    try {
        const days = req.query.days === undefined
            ? 7
            : Number(req.query.days);

        if (
            !Number.isInteger(days) ||
            days < 1 ||
            days > 90
        ) {
            return res.status(400).json({
                success: false,
                message: 'Days must be a whole number from 1 to 90.'
            });
        }

        const now = new Date();
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() + days);

        const batches = await StockBatch.find({
            quantityRemaining: { $gt: 0 }
        })
            .populate('ingredientId', 'ingredientCode name unit')
            .populate('supplierId', 'supplierCode name')
            .sort({ expiryDate: 1 })
            .lean();

        const expired = [];
        const nearExpiry = [];
        const expiryUnknown = [];

        for (const batch of batches) {
            const details = {
                batchCode: batch.batchCode,
                ingredient: batch.ingredientId,
                supplier: batch.supplierId,
                quantityRemaining: batch.quantityRemaining,
                expiryDate: batch.expiryDate,
                status: batch.status
            };

            if (!batch.expiryDate) {
                expiryUnknown.push(details);
            } else if (new Date(batch.expiryDate) < now) {
                expired.push(details);
            } else if (new Date(batch.expiryDate) <= cutoff) {
                nearExpiry.push(details);
            }
        }

        res.status(200).json({
            success: true,
            generatedAt: now,
            daysAhead: days,
            summary: {
                expiredCount: expired.length,
                nearExpiryCount: nearExpiry.length,
                expiryUnknownCount: expiryUnknown.length
            },
            expired,
            nearExpiry,
            expiryUnknown
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate expiry report.',
            error: error.message
        });
    }
});

module.exports = router;
