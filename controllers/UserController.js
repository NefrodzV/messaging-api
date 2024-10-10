import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { sendErrors, validateHeaders } from './index.js';
import { validationResult, matchedData, body } from 'express-validator';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import mongoose from 'mongoose';
import sanitize from 'mongo-sanitize';
import config from '../config.js';
import { v2 as cloudinary } from 'cloudinary';
const upload = multer();

// Returns the auth user
const getUser = [
    // Validating and Sanitizing
    validateHeaders(),
    sendErrors,
    async (req, res, next) => {
        // Processing the token data
        try {
            const data = matchedData(req);
            const decode = jwt.verify(data.jwt, config.TOKEN_SECRET);

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
                        lastChat: 1,
                        chats: {
                            $map: {
                                input: '$chats',
                                as: 'chat',
                                in: {
                                    _id: '$$chat._id',
                                    lastMessage: '$$chat.lastMessage',
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
                        lastChat: 1,
                        chats: {
                            $map: {
                                input: '$chats',
                                as: 'chat',
                                in: {
                                    _id: '$$chat._id',
                                    lastMessage: '$$chat.lastMessage',
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

            await User.populate(userAggregation, {
                path: 'chats.lastMessage',
                model: 'Message',
                populate: {
                    path: 'user',
                    select: '-_id -password -email -image',
                },
            });
            // console.log('user agregation');
            // console.log(userAggregation[0].chats);

            // TODO: ADD THE CHAT LIST OF THIS USER HERE
            res.status(200).json({
                message: 'User found',
                user: userAggregation[0],
            });
        } catch (e) {
            console.log(e);
        }
    },
];

// Should returns all users except the user in session
const getUsers = [
    validateHeaders(),
    sendErrors,
    async (req, res, next) => {
        try {
            const data = matchedData(req);
            const decode = jwt.verify(data.jwt, config.TOKEN_SECRET);

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
    sendErrors,
    async (req, res, next) => {
        try {
            const requestData = matchedData(req);
            const tokenData = jwt.verify(
                requestData.authorization,
                config.TOKEN_SECRET
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
    sendErrors,
    async (req, res, next) => {
        try {
            const data = matchedData(req);
            const payload = jwt.verify(data.jwt, config.TOKEN_SECRET);

            const file = req.file;
            const buffer = Buffer.from(file.buffer, file.encoding);
            const uploadResult = await new Promise((resolve) => {
                cloudinary.uploader
                    .upload_stream(
                        {
                            folder: 'messaging_app',
                        },
                        (error, uploadResult) => {
                            if (error) console.error(error);
                            return resolve(uploadResult);
                        }
                    )
                    .end(buffer);
            });
            console.log(uploadResult);
            console.log('transforming image');
            // Needs to be with the public id of the image
            // Widths: 56, 72, 150
            const url56 = cloudinary.url(uploadResult.public_id, {
                width: 56,
                height: 56,
            });

            const url72 = cloudinary.url(uploadResult.public_id, {
                width: 72,
                height: 72,
            });

            const url150 = cloudinary.url(uploadResult.public_id, {
                width: 150,
                height: 150,
            });

            const user = await User.findById(payload.id);

            // If there is a previous clodinary id
            if (user.image.cloudinary_public_id) {
                await cloudinary.uploader.destroy(
                    user.image.cloudinary_public_id,
                    {
                        invalidate: true,
                    }
                );
            }

            user.image = {
                cloudinary_public_id: uploadResult.public_id,
                original: uploadResult.url,
                w56: url56,
                w72: url72,
                w150: url150,
            };

            await user.save();

            return res.status(200).json({
                message: 'image uploaded',
                image: user.image,
            });
        } catch (e) {
            console.log(e);
            next(e);
        }
    },
];

const onUserJoinRoom = async (socket, roomId) => {
    try {
        const cleanChatId = sanitize(roomId);
        const user = await User.findByIdAndUpdate(socket.request.user._id, {
            lastChat: cleanChatId,
        });

        console.log('user updated with last chat', user);
    } catch (e) {
        console.error(e);
    }
};
export default {
    getUser,
    getUsers,
    changePassword,
    uploadProfileImage,
    onUserJoinRoom,
};
