import jwt, { JsonWebTokenError } from 'jsonwebtoken'
import { User } from '../models'
import { mongo } from 'mongoose'
import { 
    header, 
    body, 
    params, 
    validationResult , 
    matchedData } from 'express-validator'
import { configDotenv } from 'dotenv'
configDotenv()

function UserController() {

    // Handles the chat creation of user and 
    const getUser = [
        verifyToken,
        async (req, res) => {
            // Processing the token data
            jwt.verify(req.token, process.env.TOKEN_SECRET, async (err, data) => {
                if(err) throw new Error('Decode error')
                if(!data) {
                    res.status(403).json({ msg: "Forbidden" })
                }

                const user = await User.findById(data.id, {
                    "profile.username": 1,
                    "profile.image": 1
                }
                )
                res.status(200).json({user: user})
            })
        }
    ]
    
    const getChats = (req, res) => {
        res.send("Get all user chats not implemented")
    }

    // Create a new chat with other user
    const createChat = (req, res) => {
        res.send('create new chat not implemented')
    }

    const getChat = (req, res) => {
        res.send('Get a specific user chat with chatId not implemented')
    }

    const createMessage = (req, res) => {
        res.send('Send a message in a specific chat not implemented')
    }

    const getMessages = (req, res) => {
        res.send('Get all messages in a chat not implemented')
    }

    // Should returns all users except the user in session
    const getUsers = [
        // Sanitizing and validating
        header('authorization', 'Require authorization')
            .notEmpty()
            .customSanitizer((input) => {
                const headers = input.split(' ')
                const token = headers[1]
                return token
            })
            .isJWT()
            .withMessage('Forbidden')
            .escape(),

        async(req, res) => {
            const result = validationResult(req)
            if(!result.isEmpty()) {
                const mappedResult = result.mapped()
                const errors = {}
                for(const key of Object.keys(mappedResult)) {
                    errors[`${key}`] = mappedResult[`${key}`].msg
                }
                res.status(403).json({
                    errors: errors
                })
                return
            }

            try {
                const header = matchedData(req)
                const decode = jwt.verify(
                    header.authorization, 
                    process.env.TOKEN_SECRET
                )

                console.log(decode)
                const users = await User.find({
                    _id: { $ne: decode.id }
                }, { 
                    "profile.username": 1,
                    "profile.email": 1
                })
                console.log(users)

                res.status(200).json({ users: users })
            } catch(e) {
                if(err instanceof JsonWebTokenError) {
                    console.log('Verify token error: ' + e.message)
                    res.status(403).json({ errors: {
                        authorization: 'Forbidden'
                    }})
                    return
                }

                if(e instanceof mongo.MongoServerError) {
                    res.status(500).json({ errors: {
                        database: "Something went wrong with database"
                    }})
                    return
                }
                console.log("Unhandled error: " + e)
                res.status(500).json({
                    errors: {
                        server: "Something went wrong with the server"
                    }
                })
            }
        }
        
    ]

    // Helper functions
    async function verifyToken(req, res, next) {
        const bearerHeader = req.headers['authorization']
        if(bearerHeader) {
            const bearer = bearerHeader.split(' ')
            const token = bearer[1]
            if(!token){
                res.status(403).json({ msg: "Forbidden"})
                return
            }
            req.token = token
            next()
        } else {
            res.status(403).json({ msg: "Forbidden" })
        }
    }

    return {
        getUser,
        getUsers,
        getChats,
        getChat,
        getMessages,
        createChat,
        createMessage
    }

}

export default UserController

