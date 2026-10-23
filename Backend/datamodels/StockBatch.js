
const mongoose = require('mongoose');

const stockBatchSchema = new mongoose.Schema(
    {
        batchCode: {
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

        quantityReceived: {
            type: Number,
            required: true,
            min: 0
        },

        quantityRemaining: {
            type: Number,
            required: true,
            min: 0
        },

        unitCost: {
            type: Number,
            required: true,
            min: 0
        },

        totalCost: {
            type: Number,
            required: true,
            min: 0
        },

        supplierId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Supplier',
            default: null
        },

        receivedDate: {
            type: Date,
            required: true,
            default: Date.now
        },

        expiryDate: {
            type: Date,
            default: null
        },

        status: {
            type: String,
            enum: ['Available', 'Depleted', 'Expired', 'Quarantined'],
            default: 'Available'
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('StockBatch', stockBatchSchema);
