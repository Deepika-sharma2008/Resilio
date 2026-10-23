
const mongoose = require('mongoose');

const stockQuantitySchema = new mongoose.Schema(
    {
        ingredientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ingredient',
            required: true,
            unique: true
        },

        totalQuantity: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },

        lastUpdatedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    'StockQuantity',
    stockQuantitySchema
);
