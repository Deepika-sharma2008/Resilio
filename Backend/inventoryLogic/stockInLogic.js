
const mongoose = require('mongoose');

const Ingredient = require('../datamodels/Ingredient');
const StockBatch = require('../datamodels/StockBatch');
const StockMovement = require('../datamodels/StockMovement');
const StockQuantity = require('../datamodels/StockQuantity');
const { syncStockQuantity } = require('./stockQuantityLogic');

const stockIn = async (data) => {
    const {
        movementCode,
        batchCode,
        ingredientId,
        quantity,
        unitCost,
        supplierId,
        receivedDate,
        expiryDate,
        performedBy,
        referenceCode
    } = data;

    if (!movementCode || !batchCode || !ingredientId) {
        throw new Error(
            'Movement code, batch code, and ingredient are required.'
        );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Quantity must be greater than zero.');
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error('Unit cost cannot be negative.');
    }

    if (
        expiryDate &&
        receivedDate &&
        new Date(expiryDate) < new Date(receivedDate)
    ) {
        throw new Error('Expiry date cannot be before the received date.');
    }

    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const ingredient = await Ingredient.findOne({
                _id: ingredientId,
                isActive: true
            }).session(session);

            if (!ingredient) {
                throw new Error('Active ingredient not found.');
            }

            const batch = await StockBatch.create(
                [{
                    batchCode,
                    ingredientId,
                    quantityReceived: quantity,
                    quantityRemaining: quantity,
                    unitCost,
                    totalCost: quantity * unitCost,
                    supplierId: supplierId || null,
                    receivedDate: receivedDate || new Date(),
                    expiryDate: expiryDate || null,
                    status: 'Available'
                }],
                { session }
            );

            await StockMovement.create(
                [{
                    movementCode,
                    ingredientId,
                    batchId: batch[0]._id,
                    movementType: 'Stock In',
                    quantity,
                    unit: ingredient.unit,
                    reason: 'New stock received',
                    referenceCode: referenceCode || null,
                    performedBy: performedBy || null,
                    movementDate: receivedDate || new Date()
                }],
                { session }
            );

            const totals = await StockBatch.aggregate([
                {
                    $match: {
                        ingredientId: ingredient._id
                    }
                },
                {
                    $group: {
                        _id: '$ingredientId',
                        totalQuantity: {
                            $sum: '$quantityRemaining'
                        }
                    }
                }
            ]).session(session);

            const totalQuantity =
                totals.length > 0 ? totals[0].totalQuantity : 0;

            const stockQuantity = await StockQuantity.findOneAndUpdate(
                { ingredientId: ingredient._id },
                {
                    $set: {
                        totalQuantity,
                        lastUpdatedAt: new Date()
                    }
                },
                {
                    session,
                    returnDocument: 'after',
                    upsert: true,
                    runValidators: true,
                    setDefaultsOnInsert: true
                }
            );

            result = {
                batch: batch[0],
                totalQuantity: stockQuantity.totalQuantity
            };
        });

        return result;
    } finally {
        await session.endSession();
    }
};

module.exports = { stockIn };
