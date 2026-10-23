const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./database/connectDB');
const Ingredient = require('./datamodels/Ingredient');
const { stockIn } = require('./inventoryLogic/stockInLogic');

async function testStockIn() {
    try {
        await connectDB();

        const ingredient = await Ingredient.findOne({
            ingredientCode: 'ING-001',
            isActive: true
        });

        if (!ingredient) {
            throw new Error('Tomato ingredient not found.');
        }

        const result = await stockIn({
            movementCode: 'MOV-IN-001',
            batchCode: 'BATCH-TOM-001',
            ingredientId: ingredient._id.toString(),
            quantity: 10,
            unitCost: 30,
            receivedDate: new Date(),
            referenceCode: 'TEST-DELIVERY-001'
        });

        console.log('\nStock In successful!');
        console.log('Ingredient:', ingredient.name);
        console.log('Batch code:', result.batch.batchCode);
        console.log('Quantity received:', result.batch.quantityReceived, ingredient.unit);
        console.log('Unit cost: ₹', result.batch.unitCost);
        console.log('Total cost: ₹', result.batch.totalCost);
        console.log('Updated total stock:', result.totalQuantity, ingredient.unit);

    } catch (error) {
        console.error('Stock In test failed:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

testStockIn();