import { User } from '../models/index.js';
import { validationResult, body } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendErrors } from './index.js';
import config from '../config.js';

const signup = [
    body('username', 'Username cannot be empty')
        .trim()
        .isLength({ min: 1 })
        .escape(),

    body('email', 'E-mail cannot be empty')
        .trim()
        .isLength({ min: 3, max: 256 })
        .withMessage('Email must be between 3 - 256 characters')
        .isEmail()
        .withMessage('Incorrect E-mail format')
        .escape()
        .normalizeEmail(),

    body('password', 'Password must be at least 8 characters')
        .trim()
        .isLength({ min: 8 })
        .escape(),

    body('confirmPassword', 'Password confirmation cannot be empty')
        .trim()
        .isLength({ min: 1 })
        .escape(),

    body('confirmPassword', 'Confirm password not equal password')
        .custom((input, { req }) => {
            return input === req.body.password;
        })
        .escape(),

    sendErrors,
    async (req, res, next) => {
        try {
            const encryptedPassword = await bcrypt.hash(req.body.password, 10);
            const user = new User({
                username: req.body.username,
                email: req.body.email,
                password: encryptedPassword,
            });

            await user.save();
            return res
                .status(201)
                .json({ message: 'Account created successfully' });
        } catch (e) {
            next(e);
        }
    },
];

const login = [
    body('email', 'E-mail cannot be empty')
        .trim()
        .isLength({ min: 1 })
        .isEmail()
        .withMessage('Incorrect E-mail format')
        .escape(),
    body('password', 'Password has a minimum of 8 characters')
        .trim()
        .isLength({ min: 8 })
        .escape(),
    sendErrors,
    async (req, res) => {
        try {
            const user = await User.findOne({ email: req.body.email });
            // User doesnt exist in db
            if (!user) {
                res.status(400).json({
                    errors: {
                        auth: 'Authentication failed',
                    },
                });
                return;
            }

            const correctPassword = await bcrypt.compare(
                req.body.password,
                user.password
            );
            // Incorrect user password
            if (!correctPassword) {
                res.status(400).json({
                    errors: {
                        auth: 'Authentication failed',
                    },
                });
                return;
            }

            const payload = {
                id: user._id,
                username: user.username,
            };

            jwt.sign(payload, config.TOKEN_SECRET, (err, token) => {
                if (err) {
                    throw new Error(err);
                }

                const formattedToken = 'Bearer ' + token;
                const today = new Date();
                const cookieExpiration = new Date(
                    today.getTime() + 1000 * 60 * 60 * 24 * 365
                );

                res.cookie('jwt', formattedToken, {
                    expires: cookieExpiration,
                    httpOnly: true,
                    secure: true,
                    sameSite: 'Strict',
                    domain: config.APP_URL,
                });

                return res.status(200).json({
                    message: 'sucessful login',
                    user: {
                        username: user.username,
                        image: user?.image,
                    },
                });
            });
        } catch (e) {
            res.status(500).json({
                message: e.message,
            });
        }
    },
];

const signout = (req, res, next) => {
    res.clearCookie('jwt', {
        httpOnly: true,
        secure: true,
        sameSite: true,
    });

    res.sendStatus(200);
};

export default {
    signup,
    login,
    signout,
};
