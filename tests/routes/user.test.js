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
        
        const agent = request(app)

        // Simulates registration
        agent.post('/api/session/register').send({
            username: "My user",
            email: "1234user@gmail.com",
            password: "123456789",
            confirmPassword: '123456789'
        }).end(() => {
            // Simulates login to get the token
            agent.post('/api/session/login').send({
                email: "1234user@gmail.com",
                password: '123456789'
            }).end((err, res) => {
                // Simulates call with authorization header
                const formatToken = 'Bearer ' + res.body.token
                agent.get('/api/users/me').set('authorization', formatToken)
                    .end((err, res) => {
                        expect(res.body).toHaveProperty('user')
                        done()
                    })
            })
        })
    })

    it('Responds with forbidden with no header', done => {
        request(app)
            .get('/api/users/me')
            .expect({ msg: "Forbidden"})
            .expect(403, done)
    })

    it('Responds with forbidden if token is incorrect', done => {
        const agent = request(app)

        // Simulates registration
        agent.post('/api/session/register').send({
            username: "My user",
            email: "1234user@gmail.com",
            password: "123456789",
            confirmPassword: '123456789'
        }).end(() => {
            // Simulates login to get the token
            agent.post('/api/session/login').send({
                email: "1234user@gmail.com",
                password: '123456789'
            }).end((err, res) => {
                // Simulates call with authorization header
                const formatToken = res.body.token
                agent.get('/api/users/me').set('authorization', formatToken)
                    .expect({ msg: "Forbidden"})
                    .expect(403, done)
            })
        })
    })
})