import { Server } from 'socket.io';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import User from './models/User.js';
import { MessageController, UserController } from './controllers/index.js';
import config from './config.js';

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
            origin: 'https://serene-babka-69b0e2.netlify.app',
            credentials: true,
        },
        transports: ['websocket'],
        maxHttpBufferSize: 1e8,
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
        socket.join(user._id.toString());

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

        socket.on('message', async (roomId, message, resCb) => {
            await MessageController.onSocketMessage(
                io,
                socket,
                roomId,
                message,
                resCb
            );
        });
        socket.on('join', (roomId) => {
            UserController.onUserJoinRoom(socket, roomId);
            socket.join(roomId);
        });

        socket.on('leave', (roomId) => {
            socket.leave(roomId);
        });

        socket.on('disconnect', (reason) => {
            console.log('A disconnection happened : ', reason);
        });

        socket.on('disconnecting', (reason) => {
            console.log(
                'A socket is disconnecting but its room are :',
                socket.rooms
            );
        });
    });

    return server;
}
