
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const StockAlert = require('../datamodels/StockAlert');
const Ingredient = require('../datamodels/Ingredient');
const StockBatch = require('../datamodels/StockBatch');

const ALERT_TYPES = [
    'Low Stock',
    'Out of Stock',
    'Near Expiry',
    'Expired',
    'Expiry Unknown'
];

const SEVERITIES = [
    'Low',
    'Medium',
    'High',
    'Critical'
];

const STATUSES = [
    'Open',
    'Resolved',
    'Dismissed'
];

// CREATE: Record a stock alert
router.post('/', async (req, res) => {
    try {
        const {
            alertCode,
            ingredientId,
            batchId,
            alertType,
            message,
            severity
        } = req.body;

        if (!mongoose.isValidObjectId(ingredientId)) {
            return res.status(400).json({
                success: false,
                message: 'A valid ingredient ID is required.'
            });
        }

        const ingredient = await Ingredient.findById(ingredientId);

        if (!ingredient) {
            return res.status(404).json({
                success: false,
                message: 'Ingredient not found.'
            });
        }

        if (!ALERT_TYPES.includes(alertType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid alert type.'
            });
        }

        if (severity && !SEVERITIES.includes(severity)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid alert severity.'
            });
        }

        if (!alertCode || !message) {
            return res.status(400).json({
                success: false,
                message: 'Alert code and message are required.'
            });
        }

        let validBatchId = null;

        if (batchId !== undefined && batchId !== null && batchId !== '') {
            if (!mongoose.isValidObjectId(batchId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid batch ID.'
                });
            }

            const batch = await StockBatch.findById(batchId);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'Stock batch not found.'
                });
            }

            if (String(batch.ingredientId) !== String(ingredient._id)) {
                return res.status(400).json({
                    success: false,
                    message: 'The batch does not belong to this ingredient.'
                });
            }

            validBatchId = batch._id;
        }

        const alert = await StockAlert.create({
            alertCode,
            ingredientId: ingredient._id,
            batchId: validBatchId,
            alertType,
            message,
            severity: severity || 'Medium'
        });

        res.status(201).json({
            success: true,
            message: 'Stock alert created successfully.',
            data: alert
        });
    } catch (error) {
        res.status(error.code === 11000 ? 409 : 400).json({
            success: false,
            message: error.code === 11000
                ? 'This alert code already exists.'
                : error.message
        });
    }
});

// READ: Get alerts, with optional filters
// Examples: ?status=Open or ?alertType=Low%20Stock
router.get('/', async (req, res) => {
    try {
        const filter = {};

        if (req.query.status) {
            if (!STATUSES.includes(req.query.status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid alert status.'
                });
            }

            filter.status = req.query.status;
        }

        if (req.query.alertType) {
            if (!ALERT_TYPES.includes(req.query.alertType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid alert type.'
                });
            }

            filter.alertType = req.query.alertType;
        }

        if (req.query.severity) {
            if (!SEVERITIES.includes(req.query.severity)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid alert severity.'
                });
            }

            filter.severity = req.query.severity;
        }

        if (req.query.ingredientId) {
            if (!mongoose.isValidObjectId(req.query.ingredientId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid ingredient ID.'
                });
            }

            filter.ingredientId = req.query.ingredientId;
        }

        const alerts = await StockAlert.find(filter)
            .populate(
                'ingredientId',
                'ingredientCode name category unit'
            )
            .populate(
                'batchId',
                'batchCode expiryDate status'
            )
            .sort({ detectedAt: -1 });

        res.status(200).json({
            success: true,
            count: alerts.length,
            data: alerts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// READ: Get one alert by ID
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid alert ID.'
            });
        }

        const alert = await StockAlert.findById(req.params.id)
            .populate(
                'ingredientId',
                'ingredientCode name category unit'
            )
            .populate(
                'batchId',
                'batchCode expiryDate status'
            );

        if (!alert) {
            return res.status(404).json({
                success: false,
                message: 'Stock alert not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: alert
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// UPDATE: Edit alert details or change its status
router.put('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid alert ID.'
            });
        }

        const allowedFields = [
            'status',
            'message',
            'severity'
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Provide status, message, or severity to update.'
            });
        }

        if (
            updates.status !== undefined &&
            !STATUSES.includes(updates.status)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid alert status.'
            });
        }

        if (
            updates.severity !== undefined &&
            !SEVERITIES.includes(updates.severity)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid alert severity.'
            });
        }

        // Track when an alert is resolved.
        if (updates.status === 'Resolved') {
            updates.resolvedAt = new Date();
        } else if (updates.status === 'Open') {
            updates.resolvedAt = null;
        }

        const alert = await StockAlert.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            {
                returnDocument: 'after',
                runValidators: true
            }
        )
            .populate(
                'ingredientId',
                'ingredientCode name category unit'
            )
            .populate(
                'batchId',
                'batchCode expiryDate status'
            );

        if (!alert) {
            return res.status(404).json({
                success: false,
                message: 'Stock alert not found.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Stock alert updated successfully.',
            data: alert
        });
    } catch (error) {
        res.status(error.code === 11000 ? 409 : 400).json({
            success: false,
            message: error.code === 11000
                ? 'This alert code already exists.'
                : error.message
        });
    }
});

module.exports = router;
