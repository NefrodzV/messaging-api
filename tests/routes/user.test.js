import express from 'express'
import { UserRouter, SessionRouter } from '../../routes/index.js'
import request from 'supertest/index.js'
import { afterAll, describe, beforeAll ,it , expect} from '@jest/globals'
import { MongoMemoryServer } from 'mongodb-memory-server'
import {mongoose, mongo } from 'mongoose'
import jwt, { JsonWebTokenError } from 'jsonwebtoken'
import { configDotenv } from 'dotenv'
configDotenv()

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use('/api/users', UserRouter)
app.use('/api/session', SessionRouter)
app.use((err, req, res, next) => {
    if(err instanceof JsonWebTokenError) {
        res.status(403).json({ errors: {
            authorization: 'Forbidden'
        }})
        return
    }

    if(err instanceof mongo.MongoServerError) {
        res.status(500).json({ 
            errors: {
                database: "Something went wrong with the database"
            }
        })
        return
    }
    
    // Any unhandled error
    res.status(500).json({
        message: "Something went wrong with the server"
    })
})


describe('Test user route', () => { 
    const api = request(app)
    let server;
    let conn;
    let tokenMock;

    beforeAll(async () => {
        server = await MongoMemoryServer.create()
        await mongoose.connect(server.getUri())
        conn = mongoose.connection

        // Creating some mocks in database and a token mock
        await api.post('/api/session/register')
        .type('form')
        .send({
            username: "User1",
            email: 'user1@gmail.com',
            password: '123456789',
            confirmPassword: '123456789'
        })

        await api.post('/api/session/register')
        .type('form')
        .send({
            username: "User2",
            email: 'user2@gmail.com',
            password: '123456789',
            confirmPassword: '123456789'
        })

        const tokenRes = await api.post('/api/session/login')
        .type('form')
        .send({
            email: 'user2@gmail.com',
            password: '123456789',
        })
        tokenMock = tokenRes.body
    })

    afterAll(async () => {
        if(conn) {
            await conn.close()
        }

        if(server) {
            await server.stop()
        }
    })


    it('Error with undefined auth header', async() => {
        const res = await api.get('/api/users/me')
        expect(res.status).toBe(403)
        expect(res.body).toStrictEqual({
            errors: {authorization: "Requires authorization"}
        })
    })

    it('Error when doesnt contain Bearer', async () => {
        const res  = await api.get('/api/users/me')
            .set('authorization', "ariauuobgfe")
        expect(res.status).toBe(403)
        expect(res.body).toStrictEqual({ 
            errors: { authorization: "Authorization doesnt contain Bearer"
        }})
    })

    it('Forbidden when invalid jwt format', async() => {
        const res = await api.get('/api/users/me')
            .set('authorization', 'Bearer aiubfuieabufbaufaubafu')
        expect(res.status).toBe(403)
        expect(res.body).toStrictEqual({
            errors: {
                authorization: 'Forbidden'
            }
        })
    })

    
    /**
     * TODO TESTS: 
     * Responds with user -> DONE
     * Gets all users except the one in session DONE
     * Gets all chats of user in session DONE
     * Get a chat with all the messages DONE
     * Create a chat DONE 50%
     * Create a message DONE
     */

    it('Returns the user in session data', async() => {
        expect(tokenMock).not.toBeUndefined()
        const meRes = await api.get('/api/users/me')
        .set('authorization', "Bearer " + tokenMock.token)
        expect(meRes.status).toBe(200)
        expect(meRes.body).not.toBeUndefined()
        expect(meRes.body).toHaveProperty('user')
        expect(meRes.body.user.username).toBe('User2')
    })

    it('Returns user list except the one in session', async () => {
        expect(tokenMock).not.toBeUndefined()
        const usersRes = await api.get('/api/users')
            .set('authorization', "Bearer " + tokenMock.token)
        expect(usersRes.status).toBe(200)
        expect(usersRes.body).toHaveProperty('users')
        expect(usersRes.body.users).not.toBeUndefined()
        
        // Checking that the user in session is not in list
        usersRes.body.users.forEach((user) => {
            expect(user.username).not.toBe('User2')
        })
    })

    it('Creates a chat with another user', async () => {
        const userRes = await api.get('/api/users/me')
            .set('authorization', "Bearer " + tokenMock.token)
        expect(userRes.body.user).not.toBeUndefined()
        expect(userRes.body.user.id).not.toBeUndefined()

        const usersRes = await api.get('/api/users')
            .set('authorization', "Bearer " + tokenMock.token)
        expect(usersRes.body.users).not.toBeUndefined()
        expect(usersRes.body.users.length).toBe(1)
        // Single user of a list
        const user = usersRes.body.users[0]
        expect(user).not.toBeUndefined()

        const createChatRes = await api.post('/api/users/me/chats')
            .set('authorization', "Bearer " + tokenMock.token)
            .send({
                userId: user._id,
                message: "Hello there!"
            })
        expect(createChatRes.body.message).toBe("New chat created")
        expect(createChatRes.status).toBe(201) 
    })

    it('Gets a chat with id', async () => {
        //Set up
        const userRes = await api.get('/api/users/me')
            .set('authorization', "Bearer " + tokenMock.token)
        expect(userRes.body.user).not.toBeUndefined()
        expect(userRes.body.user.id).not.toBeUndefined()

        // Get list of users
        const usersRes = await api.get('/api/users')
            .set('authorization', "Bearer " + tokenMock.token)
        expect(usersRes.body.users).not.toBeUndefined()
        expect(usersRes.body.users.length).toBe(1)
        // Single user of a list
        const user = usersRes.body.users[0]
        expect(user).not.toBeUndefined()

        // Create a chat with said user
        const createChatRes = await api.post('/api/users/me/chats')
            .set('authorization', "Bearer " + tokenMock.token)
            .send({
                userId: user._id,
                message: "Hello there!"
            })
        expect(createChatRes.body.message).toBe("New chat created")
        expect(createChatRes.status).toBe(201)

        // Getting chat with id
        const chatId = createChatRes.body.chat.id
        expect(chatId).not.toBeUndefined()
        const chatRes = await api
        .get('/api/users/me/chats/' +  chatId)
        .set('authorization', "Bearer " + tokenMock.token)

        expect(chatRes.status).toBe(200)
        expect(chatRes.body).not.toBeUndefined()
        expect(chatRes.body).toHaveProperty('chat')
        expect(chatRes.body.chat).toHaveProperty('messages')
        expect(chatRes.body.chat.messages.length).toBe(1)
    })

    it('Get all the messages of a chat', async() => {
        const userRes = await api.get('/api/users/me')
        .set('authorization', "Bearer " + tokenMock.token)
        expect(userRes.body.user).not.toBeUndefined()
        expect(userRes.body.user.id).not.toBeUndefined()

        // Get list of users
        const usersRes = await api.get('/api/users')
        .set('authorization', "Bearer " + tokenMock.token)
        expect(usersRes.body.users).not.toBeUndefined()
        expect(usersRes.body.users.length).toBe(1)
        // Single user of a list
        const user = usersRes.body.users[0]
        expect(user).not.toBeUndefined()

        // Create a chat with said user
        const createChatRes = await api.post('/api/users/me/chats')
            .set('authorization', "Bearer " + tokenMock.token)
            .send({
                userId: user._id,
                message: "Hello there!"
            })
        expect(createChatRes.body.message).toBe("New chat created")
        expect(createChatRes.status).toBe(201)

        // Getting chat with id
        const chatId = createChatRes.body.chat.id
        expect(chatId).not.toBeUndefined()

        const getMessagesRes = await api
            .get(`/api/users/me/chats/${chatId}/messages`)
        expect(getMessagesRes.status).toBe(200)
        expect(getMessagesRes.body).toHaveProperty('messages')
        expect(getMessagesRes.body.messages).not.toBeUndefined()
    })

    it('Creates a new message in a chat', async() => {
        const userRes = await api.get('/api/users/me')
        .set('authorization', "Bearer " + tokenMock.token)
        expect(userRes.body.user).not.toBeUndefined()
        expect(userRes.body.user.id).not.toBeUndefined()

        // Get list of users
        const usersRes = await api.get('/api/users')
        .set('authorization', "Bearer " + tokenMock.token)
        expect(usersRes.body.users).not.toBeUndefined()
        expect(usersRes.body.users.length).toBe(1)
        // Single user of a list
        const user = usersRes.body.users[0]
        expect(user).not.toBeUndefined()

        // Create a chat with said user
        const createChatRes = await api.post('/api/users/me/chats')
            .set('authorization', "Bearer " + tokenMock.token)
            .send({
                userId: user._id,
                message: "Hello there!"
            })
        expect(createChatRes.body.message).toBe("New chat created")
        expect(createChatRes.status).toBe(201)

        // Creating another message with chatId
        const chatId = createChatRes.body.chat.id
        expect(chatId).not.toBeUndefined()

        const createMessage = await api
            .post(`/api/users/me/chats/${chatId}/messages`)
            .set('authorization', 'Bearer ' + tokenMock.token)
            .send({
                message: 'Hello!'
            })
        expect(createMessage.status).toBe(201)
        
        const getMessagesRes = await api
            .get(`/api/users/me/chats/${chatId}/messages`)
        expect(getMessagesRes.status).toBe(200)
        expect(getMessagesRes.body).toHaveProperty('messages')
        expect(getMessagesRes.body.messages).not.toBeUndefined()
        expect(getMessagesRes.body.messages.length).toBe(2)
    })

//     it('Responds with the authorized user', done => {
//         // Simulates registration
//         api.post('/api/session/register').send({
//             username: "My user",
//             email: "1234user@gmail.com",
//             password: "123456789",
//             confirmPassword: '123456789'
//         }).end((err, res) => {
//             if(err) return done(err)
//             expect(res.status).toBe(201)
//             // Simulates login to get the token
//             api.post('/api/session/login').send({
//                 email: "1234user@gmail.com",
//                 password: '123456789'
//             }).end((err, res) => {
//                 if(err) return done(err)
//                 // Simulates call with authorization header
//                 const formatToken = 'Bearer ' + res.body.token
//                 expect(res.status).toBe(200)
//                 expect(formatToken).not.toBeUndefined()
//                 api.get('/api/users/me').set('authorization', formatToken)
//                     .end((err, res) => {
//                         if(err) return done(err)
//                         expect(res.body).toHaveProperty('user')
//                         expect(res.body.user.profile.username).toBe("My user")
//                         done()
//                     })
//             })
//         })
//     })
// 
//     it('Responds with forbidden with no header', done => {
//         api.get('/api/users/me')
//             .expect({ errors: { authorization: 'Requires authorization' } })
//             .expect(403, done)
//     })
// 
//     it('Responds with forbidden if token is incorrect', done => {
//         // Simulates login to get the token
//         api.post('/api/session/login').send({
//             email: "1234user@gmail.com",
//             password: '123456789'
//         }).end((err, res) => {
//             if(err) return done(err)
//             // Simulates call with authorization header
//             const formatToken = res.body.token
//             api.get('/api/users/me').set('authorization', formatToken)
//                 .expect( { errors: { authorization: 'Forbidden' } })
//                 .expect(403, done)
//         })
//        
//     })
// 
//     it('Returns a list a users except user in session', async() => {
//         // Register user
//         const registerRequest = await api
//             .post('/api/session/register')
//             .send({
//                 username: "User2",
//                 email: 'user2@gmail.com',
//                 password: '123456789',
//                 confirmPassword: '123456789'
//             })
//         const registerAnotherRequest = await api
//         .post('/api/session/register')
//         .send({
//             username: "User1",
//             email: 'user1@gmail.com',
//             password: '123456789',
//             confirmPassword: '123456789'
//         })
//         
//         expect(registerRequest.status).toBe(201)
//         // Logged in user returns the token
//         const loginRequest = await api
//             .post('/api/session/login')
//             .send({
//                 email: 'user2@gmail.com',
//                 password: '123456789'
//             })
//         expect(loginRequest.status).toBe(200)
//         expect(loginRequest.body).toHaveProperty('token')
//         expect(loginRequest.body.token).not.toBeUndefined()
// 
//         const authHeader = 'Bearer ' + loginRequest.body.token
//         
//         // Returns list of users except the user in session
//         const getUsersRequest = await api
//             .get('/api/users')
//             .set('authorization', authHeader)
//         
//         expect(getUsersRequest.status).toBe(200)
//         expect(getUsersRequest.body.users).not.toBeUndefined()
//         // Checking each and that the session user is not in list
//         getUsersRequest.body.users.forEach(user => {
//             // Getting the username from the token
//             const decode = jwt.verify(
//                 loginRequest.body.token,
//                 process.env.TOKEN_SECRET
//             )
//             expect(user.profile.username).not.toBe(decode.username)
//         })
//     })
// 
//     it('/users returns error when incorrect authorization', async () => {
//         const incorrectToken = '112337583nmbculfnkaiuf'
//         const getUsersRequest = await api.get('/api/users').set(
//             "authorization",
//             incorrectToken
//         )
//         expect(getUsersRequest.status).toBe(403)
//         expect(getUsersRequest.body.errors).toHaveProperty('authorization')
//         expect(getUsersRequest.body.errors.authorization).toBe('Forbidden')
//     })

    
})