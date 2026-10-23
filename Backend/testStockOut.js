
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./database/connectDB');
const Ingredient = require('./datamodels/Ingredient');
const { stockOut } = require('./inventoryLogic/stockOutLogic');

async function testStockOut() {
    try {
        await connectDB();

        const ingredient = await Ingredient.findOne({
            ingredientCode: 'ING-001',
            isActive: true
        });

        if (!ingredient) {
            throw new Error('Tomato ingredient not found.');
        }

        const result = await stockOut({
            movementCode: 'MOV-OUT-001',
            ingredientId: ingredient._id.toString(),
            quantity: 3,
            reason: 'Restaurant cooking usage',
            referenceCode: 'TEST-USAGE-001'
        });

        console.log('\nStock Out successful!');
        console.log('Ingredient:', result.ingredient);
        console.log('Quantity deducted:', result.quantityDeducted, 'kg');
        console.log('Remaining usable stock:', result.remainingUsableStock, 'kg');
        console.log('Total stock:', result.totalQuantity, 'kg');
        console.log('Movement records created:', result.movements.length);

    } catch (error) {
        console.error('Stock Out test failed:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

testStockOut();
