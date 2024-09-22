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

const onSocketMessage = async (io, socket, roomId, text, resCb) => {
    const { user } = socket.request;
    try {
        const message = await new Message({
            chatId: roomId,
            text: text,
            user: user._id,
        }).save();

        await message.populate('user');
        socket.to(roomId).emit('message', message);
        // After everything is successful send the message back
        resCb({
            status: 201,
            statusText: 'created',
            message: message,
        });
    } catch (e) {
        resCb({
            status: 500,
            statusText: 'bad request',
        });
        console.error(e);
    }
};

const onSocketEditMessage = async (io, socket, roomId, data, resCb) => {
    try {
        const updatedMessage = await Message.findByIdAndUpdate(
            data._id,
            { text: data.text },
            {
                returnDocument: 'after',
            }
        ).populate('user');
        // Maybe not need this populate because I
        // can pass the user from the original here
        socket.to(roomId).emit('edit', updatedMessage);
        resCb({
            status: 200,
            statusText: 'ok',
            message: updatedMessage,
        });
    } catch (error) {
        resCb({
            status: 500,
            statusText: 'bad request',
        });
        console.error(error);
    }
};

const onSocketDeleteMessage = async (io, socket, roomId, data, resCb) => {
    try {
        const deleteMessage = await Message.findByIdAndDelete(data._id);
        socket.to(roomId).emit('delete', deleteMessage);
        resCb({
            status: 200,
            statusText: 'ok',
        });
    } catch (error) {
        resCb({
            status: 500,
            statusText: 'bad request',
        });
        console.error(error);
    }
};

export default {
    createMessage,
    getMessages,
    onSocketMessage,
    onSocketEditMessage,
    onSocketDeleteMessage,
};
