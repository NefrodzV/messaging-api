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
app.use(cors(corsOptions))
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// TODO: Erase or leave this depending if its needed
app.get('/', (req, res) => {
    res.status(200).json({ msg: "Messaging api working"})
})
app.use('/api/session', SessionRouter)
app.use('/api/users',  UserRouter)
app.use('/api/chats', ChatRouter)
app.use('/api/messages', MessageRouter)

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

    console.log(req)
    console.log(err)
    // Any unhandled error
    res.status(500).json({
        message: "Something went wrong with the server"
    })
})

server.listen(process.env.PORT , () => console.log("Server started in port 3000"))
io.on('connection', (socket) => {
    console.log(socket.id)
    console.log('user has connected')
    socket.on('join', (roomId) => {
        socket.join(roomId)
        console.log('Someone join room : ' + roomId)
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