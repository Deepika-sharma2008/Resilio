
const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
    {
        movementCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },

        ingredientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ingredient',
            required: true
        },

        batchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StockBatch',
            required: true
        },

        movementType: {
            type: String,
            required: true,
            enum: ['Stock In', 'Stock Out', 'Wastage', 'Adjustment']
        },

        quantity: {
            type: Number,
            required: true,
            min: 0.01
        },

        unit: {
            type: String,
            required: true,
            enum: ['kg', 'g', 'litre', 'ml', 'piece']
        },

        reason: {
            type: String,
            trim: true,
            default: null
        },

        referenceCode: {
            type: String,
            trim: true,
            default: null
        },

        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        movementDate: {
            type: Date,
            required: true,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('StockMovement', stockMovementSchema);
