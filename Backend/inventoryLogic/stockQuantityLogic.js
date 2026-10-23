
const StockBatch = require('../datamodels/StockBatch');
const StockQuantity = require('../datamodels/StockQuantity');

// Recalculate total stock from all batches of an ingredient
const syncStockQuantity = async (ingredientId) => {
    const result = await StockBatch.aggregate([
        {
            $match: {
                ingredientId: ingredientId
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
    ]);

    const totalQuantity =
        result.length > 0 ? result[0].totalQuantity : 0;

    const stockQuantity = await StockQuantity.findOneAndUpdate(
        { ingredientId },
        {
            $set: {
                totalQuantity,
                lastUpdatedAt: new Date()
            }
        },
        {
            returnDocument: 'after',
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true
        }
    );

    return stockQuantity;
};

module.exports = {
    syncStockQuantity
};
