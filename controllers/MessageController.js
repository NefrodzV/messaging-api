import { ChatController, sendErrors, validateHeaders } from './index.js';
import { Chat, Message } from '../models/index.js';
import jwt from 'jsonwebtoken';
import { body, validationResult, matchedData, query } from 'express-validator';
import mongoose from 'mongoose';
import sanitize from 'mongo-sanitize';
import config from '../config.js';

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
    sendErrors,
    async (req, res, next) => {
        try {
            const data = matchedData(req);
            const decode = jwt.verify(data.jwt, config.TOKEN_SECRET);

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
    sendErrors,
    async (req, res, next) => {
        try {
            const data = matchedData(req);
            const decode = jwt.decode(data.jwt, config.TOKEN_SECRET);

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
    let errors = null;
    // Check if room id is valid
    if (!mongoose.isObjectIdOrHexString(roomId)) {
        errors['id'] = 'invalid mongo id';
    }

    if (typeof text != 'string') {
        errors['text'] = 'message text must be a string';
    }
    if (text.length === 0) {
        errors['text'] = 'message text cannot be empty';
    }

    if (errors) {
        return resCb({
            status: 422,
            statusText: 'Unprocessable Content',
            errors: errors,
        });
    }

    try {
        const message = await new Message({
            chatId: roomId,
            text: text,
            user: user._id,
        }).save();

        await message.populate('user');
        socket.to(roomId).emit('message', message);
        // Updating the chat last message field
        const chat = await Chat.findByIdAndUpdate(
            {
                _id: roomId,
            },
            { lastMessage: message._id }
        );

        const users = chat.users;
        users.forEach((user) =>
            io.to(user.toString()).emit('lastMessage', message)
        );
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
    let errors = null;
    // Check if room id is valid
    if (!mongoose.isObjectIdOrHexString(roomId)) {
        errors['id'] = 'invalid mongo id';
    }

    if (typeof data.text != 'string') {
        errors['text'] = 'message text must be a string';
    }
    if (data.text.length === 0) {
        errors['text'] = 'message text cannot be empty';
    }

    if (errors) {
        return resCb({
            status: 422,
            statusText: 'Unprocessable Content',
            errors: errors,
        });
    }

    const cleanId = sanitize(data._id);

    try {
        const updatedMessage = await Message.findByIdAndUpdate(
            cleanId,
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
    let errors = null;
    if (!mongoose.isObjectIdOrHexString(roomId)) {
        errors['id'] = 'invalid mongo id';
    }

    if (errors) {
        return resCb({
            status: 422,
            statusText: 'Unprocessable Content',
            errors: errors,
        });
    }

    const cleanId = sanitize(data._id);
    try {
        const deleteMessage = await Message.findByIdAndDelete(cleanId);
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
