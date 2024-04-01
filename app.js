import express from 'express'
import { 
    ChatRouter, MessageRouter, SessionRouter, UserRouter
 } from './routes/index.js'
import {mongoose, mongo} from 'mongoose'
import cors from  'cors'
import { configDotenv } from 'dotenv'
import jwt from 'jsonwebtoken'

configDotenv()

const app = express()

main().catch(e => console.log('Connecting to database error: '+ e))
const db = mongoose.connection
db.on('error', () => console.log('db connection failed'))
app.use(cors())
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

    // Any unhandled error
    res.status(500).json({
        message: "Something went wrong with the server"
    })
})

app.listen(8080, () => console.log("Server started in port 3000"))

async function main() {
    await mongoose.connect(process.env.DB_URL)
}