import jwt from 'jsonwebtoken';
import { Chat, Message } from '../models/index.js';
import {
    body,
    validationResult,
    matchedData,
    param,
    query,
} from 'express-validator';
import { configDotenv } from 'dotenv';
import { sendErrors, validateHeaders } from './index.js';
import mongoose from 'mongoose';
import config from '../config.js';
configDotenv();

const getChats = [
    validateHeaders(),
    sendErrors,
    async (req, res, next) => {
        try {
            const data = matchedData(req);
            const decode = jwt.verify(data.authorization, config.TOKEN_SECRET);

            if (data.userId) {
                // Look up chat with the other user with his id
                const chat = await Chat.findOne(
                    {
                        users: { $all: [data.userId, decode.id] },
                    },
                    {
                        _id: 1,
                        users: 1,
                        messages: 1,
                    }
                )
                    .populate('users')
                    .populate('messages');
                // If nothing was found
                if (!chat)
                    return res.status(409).json({
                        message:
                            'Another chat with this user could not be found',
                    });

                return res.status(200).json({
                    message: 'Chat with this user found',
                    chat: chat,
                });
            }

            const chats = await Chat.find(
                {
                    users: decode.id,
                },
                {
                    // Returns the first user that is not with the specified id
                    users: { $elemMatch: { $ne: decode.id } },
                    lastMessage: 1,
                }
            )
                .populate('lastMessage')
                .populate('users');

            res.status(200).json({
                chats: chats,
            });
        } catch (e) {
            next(e);
        }
    },
];

const createChat = [
    validateHeaders(),
    // Represents the other user to send
    body('userId', 'Specify id of other user')
        .exists({ values: 'falsy' })
        .bail()
        .isMongoId()
        .withMessage('userId must be a mongo id')
        .escape(),
    // body('message', 'Require message to create chat')
    //     .exists({ values: 'falsy' })
    //     .bail()
    //     .trim()
    //     .escape(),
    sendErrors,
    async (req, res, next) => {
        try {
            const data = matchedData(req);
            const decode = jwt.verify(data.jwt, config.TOKEN_SECRET);

            // Finding a chat if its already with these users
            const existingChat = await Chat.findOne({
                users: [data.userId, decode.id],
            });
            if (existingChat) {
                return res.status(200).json({
                    message: 'chat with these users already exist',
                    chatId: existingChat._id,
                });
            }

            const chat = new Chat({
                users: [data.userId, decode.id],
            });

            await chat.save();
            await chat.populate('users', 'username _id image');

            console.log(chat);
            return res.status(201).json({
                message: 'chat created successfully',
                chatId: chat._id,
                chat: {
                    _id: chat._id,
                    user: chat.users.filter(
                        (user) => user._id.toString() != decode.id.toString()
                    )[0],
                },
            });
        } catch (e) {
            console.log(e);
            next(e);
        }
    },
];

const getChat = [
    validateHeaders(),
    param('chatId', 'Require chat id')
        .exists({ values: 'falsy' })
        .bail()
        .isMongoId()
        .withMessage('Invalid id format')
        .escape(),

    sendErrors,
    async (req, res, next) => {
        try {
            const data = matchedData(req);
            const decode = jwt.verify(data.jwt, config.TOKEN_SECRET);

            const chatAggregation = await Chat.aggregate([
                {
                    $match: {
                        _id: mongoose.Types.ObjectId.createFromHexString(
                            data.chatId
                        ),
                    },
                },
                {
                    $lookup: {
                        from: 'messages',
                        localField: '_id',
                        foreignField: 'chatId',
                        as: 'messages',
                    },
                },
                {
                    $project: {
                        messages: 1,
                        users: {
                            $filter: {
                                input: '$users',
                                as: 'user',
                                cond: {
                                    $ne: [
                                        '$$user',
                                        mongoose.Types.ObjectId.createFromHexString(
                                            decode.id
                                        ),
                                    ],
                                },
                            },
                        },
                    },
                },
                {
                    $project: {
                        messages: 1,
                        user: { $arrayElemAt: ['$users', 0] },
                    },
                },
            ]);

            await Chat.populate(chatAggregation, {
                path: 'user',
                model: 'User',
                select: 'username image',
            });

            await Chat.populate(chatAggregation, {
                path: 'messages.user',
                model: 'User',
                select: '-password',
            });
            return res.status(200).json({
                message: 'Chat found with id',
                chat: chatAggregation[0],
            });
        } catch (e) {
            next(e);
        }
    },
];

export default {
    getChats,
    getChat,
    createChat,
};
