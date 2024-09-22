import { Server } from 'socket.io';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { configDotenv } from 'dotenv';
import User from './models/User.js';
import { MessageController } from './controllers/index.js';

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
            const error = new Error('forbidden');
            return next(error);
        }

        socket.request.user = user;
        return next();
    });
    io.on('connection', (socket) => {
        // Join the authorized user to a room to send messages to him
        const user = socket.request.user;
        socket.join(user._id);
        socket.on('join', (roomId) => {
            socket.join(roomId);
        });

        socket.on('edit', async (roomId, data, resCb) => {
            MessageController.onSocketEditMessage(
                io,
                socket,
                roomId,
                data,
                resCb
            );
        });

        socket.on('delete', async (roomId, message, resCb) => {
            MessageController.onSocketDeleteMessage(
                io,
                socket,
                roomId,
                message,
                resCb
            );
        });

        socket.on('message', async (roomId, text, resCb) => {
            MessageController.onSocketMessage(io, socket, roomId, text, resCb);
        });

        socket.on('leave', (roomId) => {
            socket.leave(roomId);
        });
    });

    return server;
}
