import { ChatController, sendErrors, validateHeaders } from './index.js';
import { Chat, Message } from '../models/index.js';
import jwt from 'jsonwebtoken';
import { body, validationResult, matchedData, query } from 'express-validator';
import mongoose from 'mongoose';
import sanitize from 'mongo-sanitize';
import config from '../config.js';
import { v2 as cloudinary } from 'cloudinary';

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
            return res.json({ data });
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

const onSocketMessage = async (io, socket, roomId, data, resCb) => {
    const { user } = socket.request;
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

    try {
        const cleanId = sanitize(roomId);
        const message = await new Message({
            chatId: cleanId,
            text: data.text,
            user: user._id,
        }).save();

        await message.populate('user', '-password');
        socket.to(roomId).emit('message', message);
        // Updating the chat last message field
        const chat = await Chat.findByIdAndUpdate(
            {
                _id: cleanId,
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

        io.to(cleanId).emit('image', {
            messageId: message._id,
            totalLoadingImages: data?.images?.length ?? 0,
        });
        const imagePromises = data?.images?.map((imageBuffer) =>
            createImageInCloudinary(imageBuffer, message._id, io, cleanId)
        );

        const images = imagePromises
            ? await Promise.all(imagePromises)
            : undefined;
        console.log('imags created in cloud', images);
        await Message.findByIdAndUpdate(message._id, {
            images: images,
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
    const cleanRoomId = sanitize(roomId);
    try {
        // This returns the old message doc after the update
        const oldMessage = await Message.findByIdAndUpdate(cleanId, {
            text: data?.text,
            images: data?.images,
        });

        const updatedMessage = await Message.findById(cleanId).populate('user');
        // Maybe not need this populate because I
        // can pass the user from the original here
        socket.to(roomId).emit('edit', updatedMessage);
        resCb({
            status: 200,
            statusText: 'ok',
            message: updatedMessage,
        });

        // removing images in cloudinary that were deleted
        const deletePromises = oldMessage.images.map((oldImage) => {
            const foundMatch = updatedMessage.images.find(
                (image) =>
                    image.cloudinary_public_id === oldImage.cloudinary_public_id
            );

            if (!foundMatch) {
                return cloudinary.uploader.destroy(
                    oldImage.cloudinary_public_id,
                    {
                        invalidate: true,
                    }
                );
            }
        });

        await Promise.all(deletePromises);
        io.to(cleanRoomId).emit('image', {
            messageId: updatedMessage._id,
            totalLoadingImages: data?.imageFiles.length,
            images: data?.images,
        });
        // Check if there is a need to process images to cloud
        if (data?.imageFiles?.length === 0) return;

        const imageFilePromises = data?.imageFiles?.map((file) =>
            createImageInCloudinary(file, updatedMessage._id, io, cleanRoomId)
        );

        const savedImages = await Promise.all(imageFilePromises);

        await Message.findByIdAndUpdate(cleanId, {
            images: [...updatedMessage.images, ...savedImages],
        });

        // Updating again the messages
        const chat = await Chat.findById(cleanRoomId);
        // Check if the updated message is the last one and send update to ui
        if (chat.lastMessage.toString() == updatedMessage._id.toString()) {
            chat.users.forEach((user) => {
                io.to(user.toString()).emit('lastMessage', updatedMessage);
            });
        }
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
    const cleanRoomId = sanitize(roomId);
    try {
        const deleteMessage = await Message.findByIdAndDelete(cleanId);
        socket.to(roomId).emit('delete', deleteMessage);
        const chat = await Chat.findById(cleanRoomId);
        // Check if the message is the last one
        if (deleteMessage._id.toString() == chat.lastMessage.toString()) {
            // Get the last message and send a ui update to users
            const lastMessage = await Message.findOne({
                chatId: cleanRoomId,
            })
                .sort({ _id: -1 })
                .limit(1)
                .populate('user');
            console.log('lastMesssagge');
            console.log(lastMessage);
            // send an update to each user
            chat.users.forEach((user) =>
                io.to(user.toString()).emit(
                    'lastMessage',
                    lastMessage
                        ? lastMessage
                        : {
                              chatId: roomId,
                              text: null,
                          }
                )
            );

            // saving the new last message if its not null
            if (lastMessage) {
                chat.lastMessage = lastMessage._id;
                await chat.save();
            }
        }
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

async function createImageInCloudinary(imageBuffer, messageId, io, roomId) {
    try {
        const result = await new Promise((resolve) => {
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
                .end(imageBuffer);
        });
        const url = cloudinary.url(result.public_id, {
            width: 250,
            height: 250,
        });
        // Sending the image updates back to the user

        io.in(roomId).emit('image', {
            messageId,
            image: {
                cloudinary_public_id: result.public_id,
                url: url,
            },
        });

        return {
            cloudinary_public_id: result.public_id,
            url: url,
        };
    } catch (e) {
        console.error(e);
        return null;
    }
}
export default {
    createMessage,
    getMessages,
    onSocketMessage,
    onSocketEditMessage,
    onSocketDeleteMessage,
};
