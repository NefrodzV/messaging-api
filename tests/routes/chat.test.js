import express from 'express';
import { UserRouter, SessionRouter, ChatRouter } from '../../routes/index.js';
import request from 'supertest/index.js';
import { afterAll, describe, beforeAll, it, expect } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mongoose, mongo } from 'mongoose';
import { JsonWebTokenError } from 'jsonwebtoken';
import { configDotenv } from 'dotenv';
configDotenv();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/api/users', UserRouter);
app.use('/api/session', SessionRouter);
app.use('/api/chats', ChatRouter);
app.use((err, req, res, next) => {
    if (err instanceof JsonWebTokenError) {
        res.status(403).json({
            errors: {
                authorization: 'Forbidden',
            },
        });
        return;
    }

    if (err instanceof mongo.MongoServerError) {
        res.status(500).json({
            errors: {
                database: 'Something went wrong with the database',
            },
        });
        return;
    }

    // Any unhandled error
    res.status(500).json({
        message: 'Something went wrong with the server',
    });
});

describe('Test user route', () => {
    const api = request(app);
    let server;
    let conn;
    let tokenMock;

    beforeAll(async () => {
        server = await MongoMemoryServer.create();
        await mongoose.connect(server.getUri());
        conn = mongoose.connection;

        // Creating some mocks in database and a token mock
        await api.post('/api/session/register').type('form').send({
            username: 'User1',
            email: 'user1@gmail.com',
            password: '123456789',
            confirmPassword: '123456789',
        });

        await api.post('/api/session/register').type('form').send({
            username: 'User2',
            email: 'user2@gmail.com',
            password: '123456789',
            confirmPassword: '123456789',
        });

        const tokenRes = await api
            .post('/api/session/login')
            .type('form')
            .send({
                email: 'user2@gmail.com',
                password: '123456789',
            });
        tokenMock = tokenRes.body;
    });

    afterAll(async () => {
        if (conn) {
            await conn.close();
        }

        if (server) {
            await server.stop();
        }
    });

    it('Creates a chat with another user', async () => {
        const userRes = await api
            .get('/api/users/me')
            .set('authorization', 'Bearer ' + tokenMock.token);
        expect(userRes.body.user).not.toBeUndefined();
        expect(userRes.body.user.id).not.toBeUndefined();

        const usersRes = await api
            .get('/api/users')
            .set('authorization', 'Bearer ' + tokenMock.token);
        expect(usersRes.body.users).not.toBeUndefined();
        expect(usersRes.body.users.length).toBe(1);
        // Single user of a list
        const user = usersRes.body.users[0];
        expect(user).not.toBeUndefined();

        const createChatRes = await api
            .post('/api/chats')
            .set('authorization', 'Bearer ' + tokenMock.token)
            .send({
                userId: user._id,
                message: 'Hello there!',
            });
        expect(createChatRes.body.message).toBe('New chat created');
        expect(createChatRes.status).toBe(201);
    });

    it('Gets a chat with id', async () => {
        //Set up
        const userRes = await api
            .get('/api/users/me')
            .set('authorization', 'Bearer ' + tokenMock.token);
        expect(userRes.body.user).not.toBeUndefined();
        expect(userRes.body.user.id).not.toBeUndefined();

        // Get list of users
        const usersRes = await api
            .get('/api/users')
            .set('authorization', 'Bearer ' + tokenMock.token);
        expect(usersRes.body.users).not.toBeUndefined();
        expect(usersRes.body.users.length).toBe(1);
        // Single user of a list
        const user = usersRes.body.users[0];
        expect(user).not.toBeUndefined();

        // Create a chat with said user
        const createChatRes = await api
            .post('/api/chats')
            .set('authorization', 'Bearer ' + tokenMock.token)
            .send({
                userId: user._id,
                message: 'Hello there!',
            });
        expect(createChatRes.body.message).toBe('New chat created');
        expect(createChatRes.status).toBe(201);

        // Getting chat with id
        const chatId = createChatRes.body.chat.id;
        expect(chatId).not.toBeUndefined();
        const chatRes = await api
            .get('/api/chats/' + chatId)
            .set('authorization', 'Bearer ' + tokenMock.token);

        expect(chatRes.status).toBe(200);
        expect(chatRes.body).not.toBeUndefined();
        expect(chatRes.body).toHaveProperty('chat');
        expect(chatRes.body.chat).toHaveProperty('messages');
        expect(chatRes.body.chat.messages.length).toBe(1);
    });

    it('Gets a chat with other user id', async () => {
        //Set up
        const userRes = await api
            .get('/api/users/me')
            .set('authorization', 'Bearer ' + tokenMock.token);
        expect(userRes.body.user).not.toBeUndefined();
        expect(userRes.body.user.id).not.toBeUndefined();

        // Get list of users
        const usersRes = await api
            .get('/api/users')
            .set('authorization', 'Bearer ' + tokenMock.token);
        expect(usersRes.body.users).not.toBeUndefined();
        expect(usersRes.body.users.length).toBe(1);
        // Single user of a list
        const user = usersRes.body.users[0];
        expect(user).not.toBeUndefined();

        // Create a chat with said user
        const createChatRes = await api
            .post('/api/chats')
            .set('authorization', 'Bearer ' + tokenMock.token)
            .send({
                userId: user._id,
                message: 'Hello there!',
            });
        expect(createChatRes.body.message).toBe('New chat created');
        expect(createChatRes.status).toBe(201);

        const getChatWithUserIdRes = await api
            .get('/api/chats?userId=' + user._id)
            .set('authorization', 'Bearer ' + tokenMock.token);

        expect(getChatWithUserIdRes.body).not.toBeUndefined();
        expect(getChatWithUserIdRes.body.chat).not.toBeUndefined();
        expect(getChatWithUserIdRes.body.chat.messages[0].text).toBe(
            'Hello there!'
        );
    });
});
