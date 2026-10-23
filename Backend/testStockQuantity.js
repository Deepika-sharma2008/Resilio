const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./database/connectDB');
const Ingredient = require('./datamodels/Ingredient');
const { syncStockQuantity } = require('./inventoryLogic/stockQuantityLogic');

async function testStockQuantity() {
    try {
        await connectDB();

        // Find an existing ingredient
        const ingredient = await Ingredient.findOne({
            isActive: true
        });

        if (!ingredient) {
            console.log('No active ingredient found. Add an ingredient first.');
            return;
        }

        console.log('Testing ingredient:', ingredient.name);

        // Recalculate the total from its batches
        const stockQuantity = await syncStockQuantity(ingredient._id);

        console.log('Stock quantity synchronization successful!');
        console.log('Ingredient:', ingredient.name);
        console.log('Total quantity:', stockQuantity.totalQuantity);
        console.log('Last updated:', stockQuantity.lastUpdatedAt);

    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

testStockQuantity();
