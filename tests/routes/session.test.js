import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import { SessionRouter } from '../../routes/index.js';
import request from 'supertest';
import { beforeAll, afterAll, describe, it } from '@jest/globals';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/session', SessionRouter);

app.use((err, req, res, next) => {
    if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
        res.status(409).json({
            msg: 'E-mail already in use',
        });
        return;
    }
    res.status(500).json({
        msg: 'Something went wrong with the database',
    });
});

describe('Test session route', () => {
    let conn;
    let mongoServer;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
        conn = mongoose.connection;
    });

    afterAll(async () => {
        if (conn) {
            conn.close();
        }
        if (mongoServer) {
            mongoServer.stop();
        }
    });

    it('signups user successfully', (done) => {
        request(app)
            .post('/session/signup')
            .type('form')
            .send({
                username: 'My user',
                email: 'myuser123@gmail.com',
                password: '123456789',
                confirmPassword: '123456789',
            })
            // .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect({ msg: 'Account created successfully' })
            .expect(201, done);
    });

    it('Sends errors when fields are incorrect', (done) => {
        request(app)
            .post('/session/signup')
            .type('form')
            .send({
                username: '',
                email: '',
                password: '',
                confirmPassword: '',
            })
            .expect('Content-Type', /json/)
            .expect({
                errors: {
                    username: 'Username cannot be empty',
                    email: 'Email must be between 3 - 256 characters',
                    password: 'Password must be at least 8 characters',
                    confirmPassword: 'Password confirmation cannot be empty',
                },
            })
            .expect(422, done);
    });

    it('Send error when password and confirmation arent the same', (done) => {
        request(app)
            .post('/session/signup')
            .type('form')
            .send({
                username: 'My user',
                email: 'user1234@gmail.com',
                password: '123456789',
                confirmPassword: '12345678',
            })
            .expect('Content-Type', /json/)
            .expect({
                errors: {
                    confirmPassword: 'Confirm password not equal password',
                },
            })
            .expect(422, done);
    });

    it('Replies with email already', (done) => {
        request(app)
            .post('/session/signup')
            .type('form')
            .send({
                username: 'My user',
                email: 'user1234@gmail.com',
                password: '123456789',
                confirmPassword: '123456789',
            })
            .then((response) => {
                request(app)
                    .post('/session/signup')
                    .type('form')
                    .send({
                        username: 'My user',
                        email: 'user1234@gmail.com',
                        password: '123456789',
                        confirmPassword: '123456789',
                    })
                    .expect({ msg: 'E-mail already in use' })
                    .expect(409, done);
            });
    });

    // it('Replies when error in database', done => {
    //     conn.close()
    //     mongoServer.stop()
    //     request(app)
    //         .post('/session/signup')
    //         .type('form')
    //         .send({
    //             username: "My user",
    //             email: "user1234@gmail.com",
    //             password:"123456789",
    //             confirmPassword: "123456789"
    //         })
    //         .expect('Content-Type', /json/)
    //         .expect({ msg: 'Something went wrong with the database' })
    //         .expect(500, done)
    // })

    it('Responds with errors when login with empty fields', (done) => {
        request(app)
            .post('/session/login')
            .type('form')
            .send({
                email: '',
                password: '',
            })
            .expect('Content-Type', /json/)
            .expect({
                errors: {
                    email: 'E-mail cannot be empty',
                    password: 'Password has a minimum of 8 characters',
                },
            })
            .expect(422, done);
    });

    it('Login responds with incorrect credentials', (done) => {
        // In this request user doesnt exist
        request(app)
            .post('/session/login')
            .type('form')
            .send({
                email: 'user123@gmail.com',
                password: '123456789',
            })
            .expect('Content-Type', /json/)
            .expect({ errors: { auth: 'Incorrect username or password' } })
            .expect(400, done);
    });

    it('Login responds with incorrect credentials when email exist', (done) => {
        request(app)
            .post('/session/login')
            .type('form')
            .send({
                email: 'user1234@gmail.com',
                password: '12345678', // Incorrect password
            })
            .expect('Content-Type', /json/)
            .expect({ errors: { auth: 'Incorrect username or password' } })
            .expect(400, done);
    });

    it('Responds with json webtoken', (done) => {
        request(app)
            .post('/session/signup')
            .type('form')
            .send({
                username: 'My user',
                email: 'user1234@gmail.com',
                password: '123456789',
                confirmPassword: '123456789',
            })
            .then((res) => {
                request(app)
                    .post('/session/login')
                    .type('form')
                    .send({
                        email: 'user1234@gmail.com',
                        password: '123456789',
                    })
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .then((res) => {
                        console.log(res);

                        expect(res.header).toHaveProperty('set-cookie');
                        expect(
                            res.header['set-cookie'][0].includes('jwt')
                        ).toBe(true);
                        done();
                    });
            });
    });
});
