
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./database/connectDB');
const Ingredient = require('./datamodels/Ingredient');

const {
    reconcileIngredient
} = require('./inventoryLogic/stockReconciliationLogic');

async function testReconciliation() {
    try {
        await connectDB();

        const ingredient = await Ingredient.findOne({
            ingredientCode: 'ING-001',
            isActive: true
        });

        if (!ingredient) {
            throw new Error('Tomato ingredient not found.');
        }

        console.log('Testing ingredient:', ingredient.name);

        const result = await reconcileIngredient(
            ingredient._id.toString()
        );

        console.log('\nReconciliation result:');
        console.log('Success:', result.success);
        console.log('Repair needed:', result.repaired);
        console.log('Previous quantity:', result.previousQuantity);
        console.log('Expected quantity:', result.expectedQuantity);
        console.log('Current quantity:', result.currentQuantity);
        console.log('Message:', result.message);

    } catch (error) {
        console.error('Reconciliation test failed:', error.message);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
}

testReconciliation();
