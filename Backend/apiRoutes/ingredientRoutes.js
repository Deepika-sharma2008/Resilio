const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const Ingredient = require('../datamodels/Ingredient');
const StockBatch = require('../datamodels/StockBatch');

// CREATE: Add a new ingredient
router.post('/', async (req, res) => {
    try {
        const {
            ingredientCode,
            name,
            category,
            unit,
            minimumStock
        } = req.body;

        const ingredient = await Ingredient.create({
            ingredientCode,
            name,
            category,
            unit,
            minimumStock
        });

        return res.status(201).json({
            success: true,
            message: 'Ingredient added successfully.',
            data: ingredient
        });
    } catch (error) {
        return res.status(error.code === 11000 ? 409 : 400).json({
            success: false,
            message: error.code === 11000
                ? 'Ingredient code or name already exists.'
                : error.message
        });
    }
});

// READ: Get all active ingredients
// Use ?includeInactive=true to include inactive ingredients.
router.get('/', async (req, res) => {
    try {
        const filter =
            req.query.includeInactive === 'true'
                ? {}
                : { isActive: true };

        const ingredients = await Ingredient.find(filter)
            .sort({ name: 1 });

        return res.status(200).json({
            success: true,
            count: ingredients.length,
            data: ingredients
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// READ: Get one ingredient by ID
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ingredient ID.'
            });
        }

        const ingredient = await Ingredient.findById(req.params.id);

        if (!ingredient) {
            return res.status(404).json({
                success: false,
                message: 'Ingredient not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: ingredient
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// UPDATE: Edit ingredient details
router.put('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ingredient ID.'
            });
        }

        const allowedFields = [
            'ingredientCode',
            'name',
            'category',
            'unit',
            'minimumStock'
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
                message: 'Provide at least one valid field to update.'
            });
        }

        const ingredient = await Ingredient.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            {
                returnDocument: 'after',
                runValidators: true
            }
        );

        if (!ingredient) {
            return res.status(404).json({
                success: false,
                message: 'Ingredient not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Ingredient updated successfully.',
            data: ingredient
        });
    } catch (error) {
        return res.status(error.code === 11000 ? 409 : 400).json({
            success: false,
            message: error.code === 11000
                ? 'Ingredient code or name already exists.'
                : error.message
        });
    }
});

// REACTIVATE: Restore a deactivated ingredient
// Keep this route before DELETE for clarity.
router.patch('/:id/reactivate', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ingredient ID.'
            });
        }

        const ingredient = await Ingredient.findById(req.params.id);

        if (!ingredient) {
            return res.status(404).json({
                success: false,
                message: 'Ingredient not found.'
            });
        }

        if (ingredient.isActive) {
            return res.status(200).json({
                success: true,
                message: 'Ingredient is already active.',
                data: ingredient
            });
        }

        ingredient.isActive = true;
        await ingredient.save();

        return res.status(200).json({
            success: true,
            message: 'Ingredient reactivated successfully.',
            data: ingredient
        });
    } catch (error) {
        console.error('Reactivate ingredient error:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Unable to reactivate ingredient.'
        });
    }
});

// DELETE: Deactivate an ingredient without deleting its history
router.delete('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ingredient ID.'
            });
        }

        const ingredient = await Ingredient.findById(req.params.id);

        if (!ingredient) {
            return res.status(404).json({
                success: false,
                message: 'Ingredient not found.'
            });
        }

        if (!ingredient.isActive) {
            return res.status(200).json({
                success: true,
                message: 'Ingredient is already deactivated.'
            });
        }

        // Prevent deactivation while stock remains.
        const remainingBatch = await StockBatch.exists({
            ingredientId: ingredient._id,
            quantityRemaining: { $gt: 0 }
        });

        if (remainingBatch) {
            return res.status(409).json({
                success: false,
                message:
                    'Cannot deactivate this ingredient while stock remains in its batches.'
            });
        }

        ingredient.isActive = false;
        await ingredient.save();

        return res.status(200).json({
            success: true,
            message: 'Ingredient deactivated successfully.',
            data: ingredient
        });
    } catch (error) {
        console.error('Deactivate ingredient error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;