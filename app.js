import express from 'express'
import { 
    ChatRouter, MessageRouter, SessionRouter, UserRouter
 } from './routes/index.js'
import {mongoose, mongo} from 'mongoose'
import cors from  'cors'
import { configDotenv } from 'dotenv'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import { createServer } from 'node:http'
import cookieParser from 'cookie-parser'
configDotenv()

const app = express()
const server = new createServer(app)
const io = new Server(server,{
    cors: {
        origin: 'http://localhost:5173'
    }
})
main().catch(e => console.log('Connecting to database error: '+ e))
const db = mongoose.connection
db.on('error', () => console.log('db connection failed'))

const corsOptions = {
    origin: 'https://serene-babka-69b0e2.netlify.app',
    optionSuccessStatus: 200

}
app.use(cookieParser())
app.use(cors())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// TODO: Erase or leave this depending if its needed
app.get('/', (req, res) => {
    res.status(200).json({ msg: "Messaging api working"})
})
app.use('/session', SessionRouter)
app.use('/users',  UserRouter)
app.use('/chats', ChatRouter)
app.use('/messages', MessageRouter)

// Error handling globally
app.use((err, req, res, next) => {
    if(err instanceof mongo.MongoServerError) {
        console.log("Mongo server error is true")
        if(err.code === 11000) {
            res.status(409).json({ 
                errors: {
                    email: "Email is already in use"
                }
            })

            return
        }
    }

    if(err instanceof jwt.JsonWebTokenError) {
        res.status(403).json({ errors: {
            authorization: 'Forbidden'
        }})
        return
    }

    // Any unhandled error
    res.status(500).json({
        message: "Something went wrong with the server"
    })
})

server.listen(process.env.PORT , () => console.log("Server started in port 3000"))
io.on('connection', (socket) => {
    console.log(socket.id)
    console.log(socket.request)
    console.log('user has connected')
    socket.on('join', (roomId) => {
        socket.join(roomId)
        console.log('Someone join room : ' + roomId)
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
    })

    socket.on('edit',(roomId, message) => {
        console.log('editing message from roomId: ' + roomId )
        console.log(message)
        io.to(roomId).emit('edit', message)
    })

    socket.on('delete',(roomId, message) => {
        console.log('deleting message on roomId: ' + roomId)
        console.log(message)
        io.to(roomId).emit('delete', message)

    })

    socket.on('message',(roomId, text) => {
        console.log('Message from roomId: ' + roomId + ' text: ' + text)
        socket.broadcast.to(roomId).emit('foo',text)
        // io.emit('foo',text)
        console.log(socket.id)
    })
})
async function main() {
    await mongoose.connect(process.env.DB_URL)
}