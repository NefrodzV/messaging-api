import { validateHeaders } from './index.js';
import { Chat, Message } from '../models/index.js';
import jwt from 'jsonwebtoken';
import { body, validationResult, matchedData, query } from 'express-validator';
import mongoose from 'mongoose';

const createMessage = [
    validateHeaders(),
    query('chatId', 'Require chat id')
        .trim()
        .exists({ values: 'falsy' })
        .bail()
        .isMongoId(),
    body('message', 'Message is empty')
        .trim()
        .exists({ values: 'falsy' })
        .bail()
        .isLength({ max: 500 })
        .withMessage('Maximum of 500 characters'),

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

            const message = await Message.create({
                chatId: data.chatId,
                user: decode.id,
                text: data.message,
            }).catch((e) => console.log(e));
            await Chat.findByIdAndUpdate(data.chatId, {
                lastMessage: message._id,
            });
            res.status(201).json({
                message: 'New message created in chat',
            });
        } catch (e) {
            next(e);
        }
    },
];
const getMessages = [
    validateHeaders(),
    query('chatId', 'Require chat id')
        .trim()
        .exists({ values: 'falsy' })
        .bail()
        .isMongoId()
        .withMessage('Invalid mongo id format')
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
            return;
        }

        try {
            const data = matchedData(req);
            const decode = jwt.decode(
                data.authorization,
                process.env.TOKEN_SECRET
            );

            const id = mongoose.Types.ObjectId.createFromHexString(decode.id);

            const messages = await Message.find(
                {
                    chatId: data.chatId,
                },
                {
                    myself: { $eq: ['$user', id] },
                    text: 1,
                    date: 1,
                }
            );
            res.status(200).send({
                messages: messages,
            });
        } catch (e) {
            console.log(e);
            next(e);
        }
    },
];

export default {
    createMessage,
    getMessages,
};
