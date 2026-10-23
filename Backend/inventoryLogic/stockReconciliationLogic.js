
const mongoose = require('mongoose');

const Ingredient = require('../datamodels/Ingredient');
const StockBatch = require('../datamodels/StockBatch');
const StockQuantity = require('../datamodels/StockQuantity');

const reconcileIngredient = async (ingredientId) => {
    const startedAt = Date.now();
    const steps = [];

    const addStep = (status, details) => {
        steps.push({
            status,
            details,
            time: new Date().toISOString(),
            elapsedMs: Date.now() - startedAt
        });
    };

    if (!mongoose.isValidObjectId(ingredientId)) {
        throw new Error('Invalid ingredient ID.');
    }

    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const transactionSteps = [];

            const record = (status, details) => {
                transactionSteps.push({
                    status,
                    details,
                    time: new Date().toISOString(),
                    elapsedMs: Date.now() - startedAt
                });
            };

            record(
                'INVESTIGATING',
                'Reading ingredient and batch records.'
            );

            const ingredient = await Ingredient.findById(
                ingredientId
            ).session(session);

            if (!ingredient) {
                throw new Error('Ingredient not found.');
            }

            const batches = await StockBatch.find({
                ingredientId: ingredient._id
            })
                .select('batchCode quantityRemaining status')
                .session(session)
                .lean();

            const invalidBatch = batches.find(batch =>
                typeof batch.quantityRemaining !== 'number' ||
                !Number.isFinite(batch.quantityRemaining) ||
                batch.quantityRemaining < 0
            );

            if (invalidBatch) {
                throw new Error(
                    `Unsafe batch data detected: ${invalidBatch.batchCode}. Automatic repair stopped.`
                );
            }

            const expectedQuantity = batches.reduce(
                (total, batch) => total + batch.quantityRemaining,
                0
            );

            const existingStock = await StockQuantity.findOne({
                ingredientId: ingredient._id
            }).session(session);

            const previousQuantity = existingStock
                ? existingStock.totalQuantity
                : null;

            const tolerance = 0.000001;

            const mismatch =
                !existingStock ||
                !Number.isFinite(previousQuantity) ||
                Math.abs(previousQuantity - expectedQuantity) > tolerance;

            record(
                'DETECTED',
                mismatch
                    ? 'Stored stock total differs from the batch total.'
                    : 'Stored stock total matches the batch total.'
            );

            const beforeState = {
                storedQuantity: previousQuantity,
                batchTotal: expectedQuantity,
                unit: ingredient.unit,
                batchCount: batches.length
            };

            if (!mismatch) {
                record(
                    'VERIFIED',
                    'No repair was needed; both quantities match.'
                );

                result = {
                    success: true,
                    repaired: false,
                    status: 'HEALTHY',
                    failure: 'Inventory Consistency Check',
                    failureLocation: 'Inventory / StockQuantity',
                    ingredient: ingredient.name,
                    ingredientId: String(ingredient._id),
                    evidence: {
                        beforeState,
                        difference: 0
                    },
                    recoveryAction: 'No repair required.',
                    afterState: beforeState,
                    verificationResult: 'PASSED',
                    detectionTimeMs: Date.now() - startedAt,
                    recoveryTimeMs: Date.now() - startedAt,
                    steps: transactionSteps,
                    message: 'Stock totals match. No repair needed.'
                };

                return;
            }

            const detectionTimeMs = Date.now() - startedAt;

            record(
                'HEALING',
                'Reconciling StockQuantity from remaining batch quantities.'
            );

            await StockQuantity.findOneAndUpdate(
                { ingredientId: ingredient._id },
                {
                    $set: {
                        totalQuantity: expectedQuantity,
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

            record(
                'VERIFYING',
                'Reading the saved stock total again.'
            );

            const verifiedStock = await StockQuantity.findOne({
                ingredientId: ingredient._id
            }).session(session);

            if (
                !verifiedStock ||
                !Number.isFinite(verifiedStock.totalQuantity) ||
                Math.abs(
                    verifiedStock.totalQuantity - expectedQuantity
                ) > tolerance
            ) {
                throw new Error(
                    'Stock reconciliation verification failed.'
                );
            }

            const afterState = {
                storedQuantity: verifiedStock.totalQuantity,
                batchTotal: expectedQuantity,
                unit: ingredient.unit,
                batchCount: batches.length
            };

            record(
                'RECOVERED',
                'Saved stock total matches the batch total.'
            );

            result = {
                success: true,
                repaired: true,
                status: 'RECOVERED',
                failure: 'Inventory Consistency Failure',
                failureLocation: 'Inventory / StockQuantity',
                ingredient: ingredient.name,
                ingredientId: String(ingredient._id),
                evidence: {
                    beforeState,
                    difference: previousQuantity === null
                        ? null
                        : previousQuantity - expectedQuantity
                },
                recoveryAction:
                    'Updated StockQuantity.totalQuantity from remaining batch quantities.',
                afterState,
                verificationResult: 'PASSED',
                detectionTimeMs,
                recoveryTimeMs: Date.now() - startedAt,
                steps: transactionSteps,
                message: 'Stock mismatch detected, repaired and verified.'
            };
        });

        return result;
    } finally {
        await session.endSession();
    }
};

module.exports = {
    reconcileIngredient
};
