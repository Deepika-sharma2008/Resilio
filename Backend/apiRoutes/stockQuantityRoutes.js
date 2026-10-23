
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const StockQuantity = require('../datamodels/StockQuantity');

// READ: Get stock quantities for all ingredients
router.get('/', async (req, res) => {
    try {
        const quantities = await StockQuantity.find()
            .populate(
                'ingredientId',
                'ingredientCode name category unit minimumStock isActive'
            )
            .sort({ lastUpdatedAt: -1 });

        res.status(200).json({
            success: true,
            count: quantities.length,
            data: quantities
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// READ: Get the stock quantity for one ingredient
router.get('/ingredient/:ingredientId', async (req, res) => {
    try {
        const { ingredientId } = req.params;

        if (!mongoose.isValidObjectId(ingredientId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ingredient ID.'
            });
        }

        const quantity = await StockQuantity.findOne({
            ingredientId
        }).populate(
            'ingredientId',
            'ingredientCode name category unit minimumStock isActive'
        );

        if (!quantity) {
            return res.status(404).json({
                success: false,
                message: 'Stock quantity record not found for this ingredient.'
            });
        }

        res.status(200).json({
            success: true,
            data: quantity
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
