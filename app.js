import express from 'express'
import { 
    ChatRouter, MessageRouter, SessionRouter, UserRouter
 } from './routes/index.js'
import {mongoose, mongo} from 'mongoose'
import cors from  'cors'
import { configDotenv } from 'dotenv'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
configDotenv()
import { initializeSocket }from './socket.js'
const app = express()

main().catch(e => console.log('Connecting to database error: '+ e))
const db = mongoose.connection
db.on('error', () => console.log('db connection failed'))

const corsOptions = {
    origin: 'https://serene-babka-69b0e2.netlify.app',
    optionSuccessStatus: 200

}
app.use(cookieParser())
app.use(cors({
    origin: process.env.APP_URL,
    optionsSuccessStatus: 200,
    credentials: true
}))
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
async function main() {
    await mongoose.connect(process.env.DB_URL)
    
}

const server = initializeSocket(app)
    server.listen(process.env.PORT , () => console.log("Server started in port 3000"))

