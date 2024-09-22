import { User } from '../models/index.js';
import { validationResult, body } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { configDotenv } from 'dotenv';
configDotenv();

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

    async (req, res, next) => {
        const result = validationResult(req);
        if (!result.isEmpty()) {
            const mappedResult = result.mapped();
            const errors = {};
            for (const key of Object.keys(mappedResult)) {
                errors[`${key}`] = mappedResult[`${key}`].msg;
            }
            res.status(422).json({ errors: errors });
            return;
        }

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
                .json({ msg: 'Account created successfully' });
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

    async (req, res) => {
        const result = validationResult(req);
        if (!result.isEmpty()) {
            const mappedResult = result.mapped();
            const errors = {};
            for (const key of Object.keys(mappedResult)) {
                errors[`${key}`] = mappedResult[`${key}`].msg;
            }
            res.status(422).json({
                errors: errors,
            });
            return;
        }

        try {
            const user = await User.findOne({ email: req.body.email });
            // User doesnt exist in db
            if (!user) {
                res.status(400).json({
                    errors: {
                        auth: 'Incorrect username or password',
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
                        auth: 'Incorrect username or password',
                    },
                });
                return;
            }

            const payload = {
                id: user._id,
                username: user.username,
            };

            jwt.sign(payload, process.env.TOKEN_SECRET, (err, token) => {
                if (err) {
                    return res.status(500).json({
                        msg: 'Something went wrong with the server',
                    });
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
                    sameSite: true,
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
                msg: 'Uh Oh! Something went wrong',
            });
            console.error(e);
        }
    },
];

export default {
    signup,
    login,
};
