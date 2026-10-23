
const mongoose = require('mongoose');

const stockAlertSchema = new mongoose.Schema(
    {
        alertCode: {
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
            default: null
        },

        alertType: {
            type: String,
            required: true,
            enum: [
                'Low Stock',
                'Out of Stock',
                'Near Expiry',
                'Expired',
                'Expiry Unknown'
            ]
        },

        message: {
            type: String,
            required: true,
            trim: true
        },

        severity: {
            type: String,
            required: true,
            enum: ['Low', 'Medium', 'High', 'Critical'],
            default: 'Medium'
        },

        status: {
            type: String,
            enum: ['Open', 'Resolved', 'Dismissed'],
            default: 'Open'
        },

        detectedAt: {
            type: Date,
            default: Date.now
        },

        resolvedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('StockAlert', stockAlertSchema);
