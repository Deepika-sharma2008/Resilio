const express = require('express');
const bcrypt = require('bcrypt');

const router = express.Router();

// Admin login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = '1234';

        
        if (!adminEmail || !adminPassword) {
            console.error('Admin credentials are missing from .env');

            return res.status(500).json({
                success: false,
                message: 'Admin login is not configured.'
            });
        }

        const emailMatches =
            email.trim().toLowerCase() === adminEmail.trim().toLowerCase();

        const passwordMatches = password === adminPassword;

        console.log('Admin email matches:', emailMatches);
        console.log('Admin password matches:', passwordMatches);
        if (!emailMatches || !passwordMatches) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Regenerate the session after successful authentication.
        req.session.regenerate((error) => {
            if (error) {
                console.error('Session regeneration failed:', error);

                return res.status(500).json({
                    success: false,
                    message: 'Unable to start your session.'
                });
            }

            req.session.isAdmin = true;
            req.session.adminEmail = adminEmail;

            req.session.save((saveError) => {
                if (saveError) {
                    console.error('Session save failed:', saveError);

                    return res.status(500).json({
                        success: false,
                        message: 'Unable to save your login session.'
                    });
                }

                return res.json({
                    success: true,
                    message: 'Admin login successful.',
                    admin: {
                        email: adminEmail
                    }
                });
            });
        });
    } catch (error) {
        console.error('Admin login error:', error);

        return res.status(500).json({
            success: false,
            message: 'An unexpected login error occurred.'
        });
    }
});

// Check whether the current session is authenticated
router.get('/me', (req, res) => {
    if (req.session && req.session.isAdmin === true) {
        return res.json({
            success: true,
            isAdmin: true,
            admin: {
                email: req.session.adminEmail
            }
        });
    }

    return res.status(401).json({
        success: false,
        isAdmin: false
    });
});

// Admin logout
router.post('/logout', (req, res, next) => {
    if (!req.session) {
        return res.json({
            success: true,
            message: 'Logged out successfully.'
        });
    }

    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie('resilio.sid', {
            httpOnly: true,
            sameSite: 'lax',
            path: '/'
        });

        return res.json({
            success: true,
            message: 'Logged out successfully.'
        });
    });
});

module.exports = router;