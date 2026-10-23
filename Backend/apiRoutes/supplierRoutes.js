
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const Supplier = require('../datamodels/Supplier');

// CREATE: Add a supplier
router.post('/', async (req, res) => {
    try {
        const {
            supplierCode,
            name,
            contactPerson,
            phone,
            email,
            address
        } = req.body;

        const supplier = await Supplier.create({
            supplierCode,
            name,
            contactPerson,
            phone,
            email,
            address
        });

        res.status(201).json({
            success: true,
            message: 'Supplier added successfully.',
            data: supplier
        });
    } catch (error) {
        res.status(error.code === 11000 ? 409 : 400).json({
            success: false,
            message: error.code === 11000
                ? 'Supplier code already exists.'
                : error.message
        });
    }
});

// READ: Get all active suppliers
// Use ?includeInactive=true to include deactivated suppliers.
router.get('/', async (req, res) => {
    try {
        const filter =
            req.query.includeInactive === 'true'
                ? {}
                : { isActive: true };

        const suppliers = await Supplier.find(filter)
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: suppliers.length,
            data: suppliers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// READ: Get one supplier by ID
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid supplier ID.'
            });
        }

        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: supplier
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// UPDATE: Edit supplier details
router.put('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid supplier ID.'
            });
        }

        const allowedFields = [
            'supplierCode',
            'name',
            'contactPerson',
            'phone',
            'email',
            'address'
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Provide at least one valid field to update.'
            });
        }

        const supplier = await Supplier.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            {
                returnDocument: 'after',
                runValidators: true
            }
        );

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Supplier updated successfully.',
            data: supplier
        });
    } catch (error) {
        res.status(error.code === 11000 ? 409 : 400).json({
            success: false,
            message: error.code === 11000
                ? 'Supplier code already exists.'
                : error.message
        });
    }
});

// DELETE: Soft-delete a supplier
// The supplier document and its historical references are preserved.
router.delete('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid supplier ID.'
            });
        }

        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found.'
            });
        }

        if (!supplier.isActive) {
            return res.status(200).json({
                success: true,
                message: 'Supplier is already deactivated.'
            });
        }

        supplier.isActive = false;
        await supplier.save();

        res.status(200).json({
            success: true,
            message: 'Supplier deactivated successfully.',
            data: supplier
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
