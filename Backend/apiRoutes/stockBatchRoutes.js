const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const StockBatch = require('../datamodels/StockBatch');
const Supplier = require('../datamodels/Supplier');
const { stockIn } = require('../inventoryLogic/stockInLogic');

// CREATE: Receive a new stock batch
router.post('/', async (req, res) => {
    try {
        const {
            movementCode,
            batchCode,
            ingredientId,
            quantity,
            unitCost,
            supplierId,
            receivedDate,
            expiryDate,
            referenceCode
        } = req.body;

        if (!mongoose.isValidObjectId(ingredientId)) {
            return res.status(400).json({
                success: false,
                message: 'A valid ingredient ID is required.'
            });
        }

        if (supplierId && !mongoose.isValidObjectId(supplierId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid supplier ID.'
            });
        }

        const result = await stockIn({
            movementCode,
            batchCode,
            ingredientId,
            quantity,
            unitCost,
            supplierId,
            receivedDate,
            expiryDate,
            referenceCode
        });

        res.status(201).json({
            success: true,
            message: 'Stock received successfully.',
            data: result
        });
    } catch (error) {
        res.status(error.code === 11000 ? 409 : 400).json({
            success: false,
            message: error.code === 11000
                ? 'Batch code or movement code already exists.'
                : error.message
        });
    }
});

// READ: Get all batches, with optional filters
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

        if (req.query.status) {
            const allowedStatuses = [
                'Available',
                'Depleted',
                'Expired',
                'Quarantined'
            ];

            if (!allowedStatuses.includes(req.query.status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid batch status.'
                });
            }

            filter.status = req.query.status;
        }

        const batches = await StockBatch.find(filter)
            .populate('ingredientId', 'ingredientCode name unit')
            .populate('supplierId', 'supplierCode name')
            .sort({ receivedDate: -1 });

        res.status(200).json({
            success: true,
            count: batches.length,
            data: batches
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// READ: Get one batch by ID
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid batch ID.'
            });
        }

        const batch = await StockBatch.findById(req.params.id)
            .populate('ingredientId', 'ingredientCode name unit')
            .populate('supplierId', 'supplierCode name');

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Stock batch not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: batch
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// UPDATE: Change only batch metadata
// Quantity and cost changes must use stock movement logic.
router.put('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid batch ID.'
            });
        }

        const allowedFields = ['expiryDate', 'supplierId'];
        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Provide expiryDate or supplierId to update.'
            });
        }

        const existingBatch = await StockBatch.findById(req.params.id);

        if (!existingBatch) {
            return res.status(404).json({
                success: false,
                message: 'Stock batch not found.'
            });
        }

        // Validate or clear expiry date
        if (updates.expiryDate !== undefined) {
            if (
                updates.expiryDate === null ||
                updates.expiryDate === ''
            ) {
                updates.expiryDate = null;
            } else {
                const expiry = new Date(updates.expiryDate);

                if (Number.isNaN(expiry.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid expiry date.'
                    });
                }

                if (expiry < new Date(existingBatch.receivedDate)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Expiry date cannot be before the received date.'
                    });
                }

                updates.expiryDate = expiry;
            }
        }

        // Validate supplier, or clear the supplier assignment
        if (updates.supplierId !== undefined) {
            if (
                updates.supplierId === null ||
                updates.supplierId === ''
            ) {
                updates.supplierId = null;
            } else {
                if (!mongoose.isValidObjectId(updates.supplierId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid supplier ID.'
                    });
                }

                const supplier = await Supplier.findOne({
                    _id: updates.supplierId,
                    isActive: true
                });

                if (!supplier) {
                    return res.status(400).json({
                        success: false,
                        message: 'Active supplier not found.'
                    });
                }
            }
        }

        const batch = await StockBatch.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            {
                returnDocument: 'after',
                runValidators: true
            }
        )
            .populate('ingredientId', 'ingredientCode name unit')
            .populate('supplierId', 'supplierCode name');

        res.status(200).json({
            success: true,
            message: 'Stock batch updated successfully.',
            data: batch
        });
    } catch (error) {
        res.status(error.code === 11000 ? 409 : 400).json({
            success: false,
            message: error.code === 11000
                ? 'A duplicate record was detected.'
                : error.message
        });
    }
});

module.exports = router;
