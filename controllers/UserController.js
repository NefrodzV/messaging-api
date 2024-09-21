import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { validateHeaders } from './index.js';
import { validationResult, matchedData, body } from 'express-validator';
import { configDotenv } from 'dotenv';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import mongoose from 'mongoose';
const upload = multer();
configDotenv();

function UserController() {
    // Returns the auth user
    const getUser = [
        // Validating and Sanitizing
        validateHeaders(),
        async (req, res, next) => {
            // Processing the token data
            const result = validationResult(req);
            if (!result.isEmpty()) {
                const mappedResult = result.mapped();
                const errors = {};
                for (const key of Object.keys(mappedResult)) {
                    errors[`${key}`] = mappedResult[`${key}`].msg;
                }
                res.status(403).json({
                    errors: errors,
                });
                return;
            }

            try {
                const data = matchedData(req);

                const decode = jwt.verify(data.jwt, process.env.TOKEN_SECRET);

                const userAggregation = await User.aggregate([
                    {
                        $match: {
                            _id: mongoose.mongo.ObjectId.createFromHexString(
                                decode.id
                            ),
                        },
                    },
                    {
                        $lookup: {
                            from: 'chats',
                            localField: '_id',
                            foreignField: 'users',
                            as: 'chats',
                        },
                    },
                    {
                        $project: {
                            username: 1,
                            image: 1,
                            email: 1,
                            chats: {
                                $map: {
                                    input: '$chats',
                                    as: 'chat',
                                    in: {
                                        _id: '$$chat._id',
                                        users: {
                                            $filter: {
                                                input: '$$chat.users',
                                                as: 'user',
                                                cond: {
                                                    $ne: [
                                                        '$$user',
                                                        mongoose.mongo.ObjectId.createFromHexString(
                                                            decode.id
                                                        ),
                                                    ],
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    {
                        $project: {
                            username: 1,
                            image: 1,
                            email: 1,
                            chats: {
                                $map: {
                                    input: '$chats',
                                    as: 'chat',
                                    in: {
                                        _id: '$$chat._id',
                                        user: { $first: '$$chat.users' },
                                    },
                                },
                            },
                        },
                    },
                ]);

                await User.populate(userAggregation, {
                    path: 'chats.user',
                    select: '-_id -password -email',
                });
                console.log('user agregation');
                console.log(userAggregation[0].chats);

                // TODO: ADD THE CHAT LIST OF THIS USER HERE
                res.status(200).json({
                    message: 'User found',
                    user: userAggregation[0],
                });
            } catch (e) {
                next(e);
            }
        },
    ];

    // Should returns all users except the user in session
    const getUsers = [
        validateHeaders(),
        async (req, res, next) => {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                const mappedResult = result.mapped();
                const errors = {};
                for (const key of Object.keys(mappedResult)) {
                    errors[`${key}`] = mappedResult[`${key}`].msg;
                }
                res.status(403).json({
                    errors: errors,
                });
                return;
            }

            try {
                const data = matchedData(req);
                const decode = jwt.verify(data.jwt, process.env.TOKEN_SECRET);

                const users = await User.find(
                    {
                        _id: { $ne: decode.id },
                    },
                    {
                        _id: 1,
                        username: 1,
                        image: 1,
                    }
                );

                res.status(200).json({ users: users });
            } catch (e) {
                next(e);
            }
        },
    ];
    const changePassword = [
        validateHeaders(),
        body('password', 'Password cannot be empty or not defined')
            .trim()
            .exists({ values: 'falsy' })
            .bail()
            .escape(),
        body('newPassword', 'New password cannot be empty')
            .trim()
            .exists({ values: 'falsy' })
            .bail()
            .isLength({})
            .escape(),
        body('confirmPassword', 'Password confirmation cannot be empty')
            .trim()
            .exists({ values: 'falsy' })
            .bail(),
        body('confirmPassword', 'Confirm password not equal password')
            .custom((input, { req }) => {
                return input === req.body.newPassword;
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
                const requestData = matchedData(req);
                const tokenData = jwt.verify(
                    requestData.authorization,
                    process.env.TOKEN_SECRET
                );

                const user = await User.findById(tokenData.id);

                if (!user) {
                    return res.status(409).json({
                        errors: {
                            database: 'User doesnt exist in database',
                        },
                    });
                }
                const isCorrectPassword = await bcrypt.compare(
                    requestData.password,
                    user.profile.password
                );

                if (!isCorrectPassword) {
                    return res.status(409).json({
                        errors: {
                            auth: 'incorrect password',
                        },
                    });
                }

                const newHashedPassword = await bcrypt.hash(
                    requestData.newPassword,
                    10
                );

                // Change the password and save it to db
                user.password = newHashedPassword;
                await user.save();

                return res.status(200).json({
                    message: 'password updated',
                });
            } catch (e) {
                next(e);
            }
        },
    ];

    const uploadProfileImage = [
        upload.single('image'),
        validateHeaders(),
        // Checks that a file has been sent
        // Image for variable and the custom validator to check the correct obj
        body('image', 'No image specified')
            .custom((val, { req }) => {
                return req.file !== undefined;
            })
            .bail(),

        async (req, res, next) => {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                const mappedResult = result.mapped();
                const errors = {};
                for (const key of Object.keys(mappedResult)) {
                    errors[`${key}`] = mappedResult[`${key}`].msg;
                }
                console.log(errors);
                res.status(422).json({ errors: errors });
                return;
            }
            try {
                const reqData = matchedData(req);
                const dataToken = jwt.verify(
                    reqData.authorization,
                    process.env.TOKEN_SECRET
                );

                const user = await User.findById(dataToken.id);
                if (!user) {
                    return res.status(409).json({
                        errors: {
                            database: 'Couldnt find user in database',
                        },
                    });
                }

                const image = req.file;
                // console.log('Image of uploaded profile image')
                // console.log(image)
                // console.log(image.buffer)
                user.image = {
                    name: image.originalname,
                    mimeType: image.mimetype,
                    binData: image.buffer,
                };

                await user.save();

                return res.status(200).json({
                    message: 'image uploaded',
                });
            } catch (e) {
                next(e);
            }
        },
    ];

    return {
        getUser,
        getUsers,
        changePassword,
        uploadProfileImage,
    };
}

export default UserController;
