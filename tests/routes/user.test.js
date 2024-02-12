import express from 'express'
import { UserRouter, SessionRouter } from '../../routes/index.js'
import request from 'supertest/index.js'
import { afterAll, describe, beforeAll ,it , expect} from '@jest/globals'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use('/api/users', UserRouter)
app.use('/api/session', SessionRouter)


describe('Test user route', () => { 
    const api = request(app)
    let server;
    let conn;

    beforeAll(async () => {
        server = await MongoMemoryServer.create()
        await mongoose.connect(server.getUri())
        conn = mongoose.connection
    })

    afterAll(async () => {
        if(conn) {
            await conn.close()
        }

        if(server) {
            await server.stop()
        }
    })

    it('Responds with the authorized user', done => {
        // Simulates registration
        api.post('/api/session/register').send({
            username: "My user",
            email: "1234user@gmail.com",
            password: "123456789",
            confirmPassword: '123456789'
        }).end((err) => {
            if(err) return done(err)
            // Simulates login to get the token
            api.post('/api/session/login').send({
                email: "1234user@gmail.com",
                password: '123456789'
            }).end((err, res) => {
                if(err) return done(err)
                // Simulates call with authorization header
                const formatToken = 'Bearer ' + res.body.token
                api.get('/api/users/me').set('authorization', formatToken)
                    .end((err, res) => {
                        expect(res.body).toHaveProperty('user')
                        done()
                    })
            })
        })
    })

    it('Responds with forbidden with no header', done => {
        api.get('/api/users/me')
            .expect({ msg: "Forbidden"})
            .expect(403, done)
    })

    it('Responds with forbidden if token is incorrect', done => {
        // Simulates registration
        api.post('/api/session/register').send({
            username: "My user",
            email: "1234user@gmail.com",
            password: "123456789",
            confirmPassword: '123456789'
        }).end((err) => {
            if(err) return done(err)
            // Simulates login to get the token
            api.post('/api/session/login').send({
                email: "1234user@gmail.com",
                password: '123456789'
            }).end((err, res) => {
                if(err) return done(err)
                // Simulates call with authorization header
                const formatToken = res.body.token
                api.get('/api/users/me').set('authorization', formatToken)
                    .expect({ msg: "Forbidden"})
                    .expect(403, done)
            })
        })
    })

    it('Returns a list a users except user in session', async() => {
        // Register user
        const registerRequest = await api
            .post('/api/session/register')
            .send({
                username: "User2",
                email: 'user2@gmail.com',
                password: '123456789',
                confirmPassword: '123456789'
            })
        const registerAnotherRequest = await api
        .post('/api/session/register')
        .send({
            username: "User1",
            email: 'user1@gmail.com',
            password: '123456789',
            confirmPassword: '123456789'
        })
        
        expect(registerRequest.status).toBe(201)
        // Logged in user returns the token
        const loginRequest = await api
            .post('/api/session/login')
            .send({
                email: 'user2@gmail.com',
                password: '123456789'
            })
        expect(loginRequest.status).toBe(200)
        expect(loginRequest.body).toHaveProperty('token')
        expect(loginRequest.body.token).not.toBeUndefined()

        const authHeader = 'Bearer ' + loginRequest.body.token
        
        // Returns list of users except the user in session
        const getUsersRequest = await api
            .get('/api/users')
            .set('authorization', authHeader)
        
        expect(getUsersRequest.status).toBe(200)
        expect(getUsersRequest.body.users).not.toBeUndefined()
        // Checking each and that the session user is not in list
        getUsersRequest.body.users.forEach(user => {
            expect(user.profile.email).not.toBe("user2@gmail.com")
        })
    })

    it('Creates a chat with the another user sucessfully', async() => {
        const loginRequest = await api
            .post('/api/session/login')
            .send({
                email: "1234user@gmail.com",
                password: '123456789'
            })
        
        expect(loginRequest.status).toBe(200)
        
    })
})