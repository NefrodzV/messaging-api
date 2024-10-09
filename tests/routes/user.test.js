import express from 'express';
import { UserRouter, SessionRouter } from '../../routes/index.js';
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

    it('Error with undefined auth header', async () => {
        const res = await api.get('/api/users/me');
        expect(res.status).toBe(403);
        expect(res.body).toStrictEqual({
            errors: { authorization: 'Requires authorization' },
        });
    });

    it('Error when doesnt contain Bearer', async () => {
        const res = await api
            .get('/api/users/me')
            .set('authorization', 'ariauuobgfe');
        expect(res.status).toBe(403);
        expect(res.body).toStrictEqual({
            errors: { authorization: 'Authorization doesnt contain Bearer' },
        });
    });

    it('Forbidden when invalid jwt format', async () => {
        const res = await api
            .get('/api/users/me')
            .set('authorization', 'Bearer aiubfuieabufbaufaubafu');
        expect(res.status).toBe(403);
        expect(res.body).toStrictEqual({
            errors: {
                authorization: 'Forbidden',
            },
        });
    });

    /**
     * TODO TESTS:
     * Responds with user -> DONE
     * Gets all users except the one in session DONE
     * Gets all chats of user in session DONE
     * Get a chat with all the messages DONE
     * Create a chat DONE
     * Create a message DONE
     */

    it('Returns the user in session data', async () => {
        expect(tokenMock).not.toBeUndefined();
        const meRes = await api
            .get('/api/users/me')
            .set('authorization', 'Bearer ' + tokenMock.token);
        expect(meRes.status).toBe(200);
        expect(meRes.body).not.toBeUndefined();
        expect(meRes.body).toHaveProperty('user');
        expect(meRes.body.user.username).toBe('User2');
    });

    it('Returns user list except the one in session', async () => {
        expect(tokenMock).not.toBeUndefined();
        const usersRes = await api
            .get('/api/users')
            .set('authorization', 'Bearer ' + tokenMock.token);
        expect(usersRes.status).toBe(200);
        expect(usersRes.body).toHaveProperty('users');
        expect(usersRes.body.users).not.toBeUndefined();

        // Checking that the user in session is not in list
        usersRes.body.users.forEach((user) => {
            expect(user.username).not.toBe('User2');
        });
    });
});
