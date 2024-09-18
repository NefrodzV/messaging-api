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
import { validateHeaders } from './index.js';
import mongoose from 'mongoose';
configDotenv();

function ChatController() {
    const getChats = [
        validateHeaders(),
        // Getting a chat with another user with id
        query('userId')
            .optional()
            .trim()
            .isMongoId()
            .withMessage('Invalid id format')
            .escape(),
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
            }
            try {
                const data = matchedData(req);
                const decode = jwt.verify(
                    data.authorization,
                    process.env.TOKEN_SECRET
                );

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
                const decode = jwt.verify(
                    data.authorization,
                    process.env.TOKEN_SECRET
                );

                // Finding a chat if its already with these users
                const existingChat = await Chat.findOne({
                    users: [data.userId, decode.id],
                });
                if (existingChat) {
                    return response.status(409).json({
                        message: 'chat with these users already exist',
                        chatId: existingChat._id,
                    });
                }

                const chat = new Chat({
                    users: [data.userId, decode.id],
                });

                await chat.save();

                res.status(201).json({
                    message: 'chat created successfully',
                    chatId: chat._id,
                });
            } catch (e) {
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

        async (req, res, next) => {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                const mappedResult = result.mapped();
                const errors = {};
                for (const key of Object.keys(mappedResult)) {
                    errors[`${key}`] = mappedResult[`${key}`].msg;
                }
                return res.status(403).json({
                    errors: errors,
                });
            }

            try {
                const data = matchedData(req);
                const decode = jwt.verify(data.jwt, process.env.TOKEN_SECRET);

                const chatAggregation = await Chat.aggregate([
                    {
                        $match: {
                            _id: mongoose.Types.ObjectId.createFromHexString(
                                decode.id
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
                                $elemMatch: {
                                    $ne: mongoose.Types.ObjectId.createFromHexString(
                                        decode.id
                                    ),
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
                //                 const chat = await Chat.findById(data.chatId, {
                //                     users: { $elemMatch: { $ne: decode.id } },
                //                 }).populate('users');
                //
                //                 const id = mongoose.Types.ObjectId.createFromHexString(
                //                     decode.id
                //                 );
                //                 const messages = await Message.find(
                //                     {
                //                         chatId: data.chatId,
                //                     },
                //                     {
                //                         myself: { $eq: ['$user', id] },
                //                         date: 1,
                //                         text: 1,
                //                     }
                //                 );

                // console.log('Messags of chat');
                // console.log(messages);
                console.log('chat agregation');
                console.log(chatAggregation);
                return res.status(200).json({
                    message: 'Chat found with id',
                    chat: chatAggregation[0],
                });
            } catch (e) {
                next(e);
            }
        },
    ];

    return {
        getChat,
        getChats,
        createChat,
    };
}

export default ChatController;
