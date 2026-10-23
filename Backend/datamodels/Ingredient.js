
const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema(
    {
        ingredientCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },

        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        category: {
            type: String,
            required: true,
            enum: [
                'Vegetables',
                'Fruits',
                'Dairy',
                'Meat',
                'Grains',
                'Spices',
                'Oils',
                'Other'
            ]
        },

        unit: {
            type: String,
            enum: ["kg", "g", "litre", "ml", "piece", "pcs"],
            required: true
        },

        minimumStock: {
            type: Number,
            required: true,
            min: 0,
            default: 5
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Ingredient', ingredientSchema);
