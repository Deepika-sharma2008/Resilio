
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const StockMovement = require('../datamodels/StockMovement');
const { stockOut } = require('../inventoryLogic/stockOutLogic');

// CREATE: Stock Out API
// Deducts stock through the existing stockOut logic.
router.post('/stock-out', async (req, res) => {
    try {
        const {
            movementCode,
            ingredientId,
            quantity,
            reason,
            referenceCode,
            performedBy
        } = req.body;

        if (!mongoose.isValidObjectId(ingredientId)) {
            return res.status(400).json({
                success: false,
                message: 'A valid ingredient ID is required.'
            });
        }

        if (
            typeof quantity !== 'number' ||
            !Number.isFinite(quantity) ||
            quantity <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive number.'
            });
        }

        if (!movementCode) {
            return res.status(400).json({
                success: false,
                message: 'Movement code is required.'
            });
        }

        const result = await stockOut({
            movementCode,
            ingredientId,
            quantity,
            reason,
            referenceCode,
            performedBy
        });

        res.status(200).json({
            success: true,
            message: 'Stock Out completed successfully.',
            data: result
        });
    } catch (error) {
        res.status(error.code === 11000 ? 409 : 400).json({
            success: false,
            message: error.message
        });
    }
});

// READ: Get all stock movements
// Optional filters:
// ?ingredientId=<ingredient ID>
// ?batchId=<batch ID>
// ?movementType=Stock%20In
router.get('/', async (req, res) => {
    try {
        const filter = {};

        if (req.query.ingredientId) {
            if (!mongoose.isValidObjectId(req.query.ingredientId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid ingredient ID.'
                });
            }

            filter.ingredientId = req.query.ingredientId;
        }

        if (req.query.batchId) {
            if (!mongoose.isValidObjectId(req.query.batchId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid batch ID.'
                });
            }

            filter.batchId = req.query.batchId;
        }

        if (req.query.movementType) {
            const allowedTypes = [
                'Stock In',
                'Stock Out',
                'Wastage',
                'Adjustment'
            ];

            if (!allowedTypes.includes(req.query.movementType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid movement type.'
                });
            }

            filter.movementType = req.query.movementType;
        }

        const movements = await StockMovement.find(filter)
            .populate(
                'ingredientId',
                'ingredientCode name unit'
            )
            .populate(
                'batchId',
                'batchCode receivedDate expiryDate'
            )
            .sort({ movementDate: -1 });

        res.status(200).json({
            success: true,
            count: movements.length,
            data: movements
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// READ: Get one stock movement by ID
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid movement ID.'
            });
        }

        const movement = await StockMovement.findById(req.params.id)
            .populate(
                'ingredientId',
                'ingredientCode name unit'
            )
            .populate(
                'batchId',
                'batchCode receivedDate expiryDate'
            );

        if (!movement) {
            return res.status(404).json({
                success: false,
                message: 'Stock movement not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: movement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
