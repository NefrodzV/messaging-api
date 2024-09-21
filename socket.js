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
        // console.log('socket connecting with id: ' + socket.id);
        /**When there is a successful connection make the user be
         * in a room with their email then we can
         * send event to that room with the email as its id
         */
        // const user = socket.request.user;
        // socket.join(user.email);

        // io.to(user.email).emit(
        //     'error',
        //     'error sent to specific user'
        // );

        const user = socket.request.user;
        socket.join(user._id);
        io.to(user._id).emit(
            'error',
            'error to a specific user with username: ' + user.username
        );

        socket.on('join', async (roomId) => {
            console.log('user joined a room');
            const chatExistence = null;
            const user = socket.request.user;
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
