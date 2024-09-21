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
            const error = new Error('Forbidden');
            return next(error);
        }

        socket.request.user = user;
        return next();
    });
    io.on('connection', (socket) => {
        // Join the user authorized to a room to send messages to him
        const user = socket.request.user;
        socket.join(user._id);
        // console.log('user has connected');
        socket.on('join', (roomId) => {
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
