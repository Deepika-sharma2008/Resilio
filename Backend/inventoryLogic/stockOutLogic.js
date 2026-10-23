
const mongoose = require('mongoose');

const Ingredient = require('../datamodels/Ingredient');
const StockBatch = require('../datamodels/StockBatch');
const StockMovement = require('../datamodels/StockMovement');
const StockQuantity = require('../datamodels/StockQuantity');

const stockOut = async (data) => {
    const {
        movementCode,
        ingredientId,
        quantity,
        reason,
        referenceCode,
        performedBy
    } = data;

    // Validate input
    if (!movementCode || !ingredientId) {
        throw new Error(
            'Movement code and ingredient are required.'
        );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(
            'Quantity must be greater than zero.'
        );
    }

    if (!mongoose.isValidObjectId(ingredientId)) {
        throw new Error('Invalid ingredient ID.');
    }

    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            // Find the active ingredient
            const ingredient = await Ingredient.findOne({
                _id: ingredientId,
                isActive: true
            }).session(session);

            if (!ingredient) {
                throw new Error('Active ingredient not found.');
            }

            // Find batches that can be used
            const batches = await StockBatch.find({
                ingredientId: ingredient._id,
                status: 'Available',
                quantityRemaining: { $gt: 0 },
                $or: [
                    { expiryDate: null },
                    { expiryDate: { $gt: new Date() } }
                ]
            }).session(session);

            // FEFO: earliest expiry first.
            // Batches without an expiry date go last.
            batches.sort((a, b) => {
                const expiryA = a.expiryDate
                    ? new Date(a.expiryDate).getTime()
                    : Infinity;

                const expiryB = b.expiryDate
                    ? new Date(b.expiryDate).getTime()
                    : Infinity;

                if (expiryA !== expiryB) {
                    return expiryA - expiryB;
                }

                return (
                    new Date(a.receivedDate).getTime() -
                    new Date(b.receivedDate).getTime()
                );
            });

            // Calculate usable stock
            const availableQuantity = batches.reduce(
                (total, batch) =>
                    total + batch.quantityRemaining,
                0
            );

            // Never allow stock to become negative
            if (availableQuantity < quantity) {
                throw new Error(
                    `Insufficient usable stock. Available: ${availableQuantity} ${ingredient.unit}.`
                );
            }

            let remainingToDeduct = quantity;
            const movements = [];

            // Deduct stock from batches in FEFO order
            for (const batch of batches) {
                if (remainingToDeduct <= 0) {
                    break;
                }

                const deducted = Math.min(
                    batch.quantityRemaining,
                    remainingToDeduct
                );

                batch.quantityRemaining -= deducted;

                if (batch.quantityRemaining === 0) {
                    batch.status = 'Depleted';
                }

                await batch.save({ session });

                const movementNumber = movements.length + 1;

                movements.push({
                    movementCode:
                        movementNumber === 1
                            ? movementCode
                            : `${movementCode}-${movementNumber}`,
                    ingredientId: ingredient._id,
                    batchId: batch._id,
                    movementType: 'Stock Out',
                    quantity: deducted,
                    unit: ingredient.unit,
                    reason: reason || 'Restaurant usage',
                    referenceCode: referenceCode || null,
                    performedBy: performedBy || null,
                    movementDate: new Date()
                });

                remainingToDeduct -= deducted;
            }

            // Record each batch deduction
            await StockMovement.insertMany(
                movements,
                { session }
            );

            // Recalculate total physical stock across all batches
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
                totals.length > 0
                    ? totals[0].totalQuantity
                    : 0;

            // Synchronize the StockQuantity collection
            const stockQuantity =
                await StockQuantity.findOneAndUpdate(
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
                ingredient: ingredient.name,
                quantityDeducted: quantity,
                remainingUsableStock:
                    availableQuantity - quantity,
                totalQuantity: stockQuantity.totalQuantity,
                movements
            };
        });

        return result;
    } finally {
        await session.endSession();
    }
};

module.exports = { stockOut };
