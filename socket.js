import { Server } from 'socket.io';
import { createServer } from 'node:http';
import { validateAuthCookie } from './utils.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { configDotenv } from 'dotenv';
import User from './models/User.js';
import Chat from './models/Chat.js';
import Message from './models/Message.js';
import mongoose from 'mongoose';
configDotenv();
export function initializeSocket(app) {
    async function checkAuthorization(socket) {
        const cookies = cookie.parse(socket.request.headers.cookie);
        const jwtCookie = cookies.jwt;
        const jwtArr = jwtCookie.split(' ');
        const authToken = jwtArr[1];
        try {
            const decode = jwt.verify(authToken, process.env.TOKEN_SECRET);

            return decode;
        } catch (e) {
            console.error(e);
            return null;
        }
    }
    const server = new createServer(app);
    const io = new Server(server, {
        cors: {
            origin: 'http://localhost:5173',
            credentials: true,
        },
    });

    io.use(async (socket, next) => {
        const decode = await checkAuthorization(socket);
        if (!decode) {
            const error = new Error('unauthorized');
            return next(error);
        }

        const user = await User.findById(decode.id, { password: 0 });
        if (!user) {
            const error = new Error('not found');
            return next(error);
        }

        socket.request.user = user;
        return next();
    });
    io.on('connection', (socket) => {
        // Set a room with user id to be able to send messages to the user
        const user = socket.request.user;
        socket.join(user._id);

        socket.on('join', async (roomId) => {
            // Join a user to an id in this case im using
            //  the chat id sent from the frondend
            console.log('user joined a room');
            socket.join(roomId);
        });

        socket.on('edit', (roomId, message) => {
            // console.log('editing message from roomId: ' + roomId);
            // console.log(message);
            io.to(roomId).emit('edit', message);
        });

        socket.on('delete', (roomId, message) => {
            // console.log('deleting message on roomId: ' + roomId);
            // console.log(message);
            io.to(roomId).emit('delete', message);
        });

        socket.on('message', async (roomId, text) => {
            console.log('Message from roomId: ' + roomId + ' text: ' + text);
            const user = socket.request.user;
            const message = await new Message({
                chatId: roomId,
                text: text,
                user: user._id,
            }).save();

            await message.populate('user');

            io.to(roomId).emit('message', message);
        });
    });

    return server;
}
