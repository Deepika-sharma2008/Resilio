const requireAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin === true) {
        return next();
    }

    return res.status(401).json({
        success: false,
        message: 'Please log in as an admin to continue.'
    });
};

module.exports = requireAdmin;