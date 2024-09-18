import { Server } from 'socket.io';
import { createServer } from 'node:http';

export function initializeSocket(app) {
    const server = new createServer(app);
    const io = new Server(server, {
        cors: {
            origin: 'http://localhost:5173',
            credentials: true,
        },
    });

    io.on('connection', (socket) => {
        // console.log(socket.id);
        // console.log(socket.id);
        // io.to(socket.id).emit('update', 'Update for a certain data');
        console.log('connecting to socket');
        console.log(socket.request.headers);
        // console.log('user has connected');
        socket.on('join', (roomId) => {
            socket.join(roomId);
            console.log('Someone join room : ' + roomId);
            // io.to(roomId).emit('message', {
            //     _id: 'post101',
            //     user: {
            //         username: 'john_doe',
            //     },
            //     text: 'Just had a great day at the park!',
            //     date: '2024-09-04T10:30:00Z',
            //     imgs: [
            //         'https://example.com/images/park1.jpg',
            //         'https://example.com/images/park2.jpg',
            //     ],
            // },)
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

        socket.on('message', (roomId, text) => {
            console.log(socket.request);
            console.log('Message from roomId: ' + roomId + ' text: ' + text);
            socket.broadcast.to(roomId).emit('foo', text);
            // io.emit('foo',text)
            console.log(socket.id);
        });
    });

    return server;
}
