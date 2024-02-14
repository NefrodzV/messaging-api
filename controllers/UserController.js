import jwt, { JsonWebTokenError } from 'jsonwebtoken'
import { User, Chat, Message } from '../models'
import { mongo } from 'mongoose'
import { 
    header, 
    body,  
    validationResult , 
    matchedData, 
    param} from 'express-validator'
import { configDotenv } from 'dotenv'
configDotenv()

function UserController() {

    // Handles the chat creation of user and 
    const getUser = [
        // Validating and Sanitizing
        validateHeaders(),
        async (req, res, next) => {
            // Processing the token data
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
                const data = matchedData(req)
                const decode = jwt.verify(data.authorization, process.env.TOKEN_SECRET)
                const user = await User.findById(decode.id, {
                    "profile.username": 1,
                    "profile.image": 1
                })
                res.status(200).json({
                    user: {
                    id: user._id,
                    username: user.profile.username,
                    image: user.profile.image
                }})
            } catch(e) {
                next(e)
            }
        }
    ]
    
    const getChats = [
        validateHeaders(),
        async(req, res , next) => {
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
            }
            try {
                const data = matchedData(req)
                const decode = jwt.verify(
                    data.authorization,
                    process.env.TOKEN_SECRET
                )

                const chats = await Chat.find({
                    users: decode.id
                }, {
                    lastMessage: 1
                }).populate('lastMessage')

                res.status(200).json({
                    chats: chats
                })
            } catch(e) {
                next(e)
            }
        }
    ]

    // Create a new chat with other user
    /** TODO: Return a already made chat if there is already a 
    chat with the user and return the existing chat */
    const createChat = [
        validateHeaders(),
        // Represents the other user to send
        body('userId', 'Specify id of other user')
            .exists({ values: 'falsy' })
            .bail()
            .isMongoId()
            .withMessage("userId must be a mongo id")
            .escape(),
        body('message', 'Require message to create chat')
            .exists({ values: 'falsy'})
            .bail()
            .trim()
            .escape(),
        async(req, res, next) => {
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
                const data = matchedData(req)
                const decode = jwt.verify(
                    data.authorization,
                    process.env.TOKEN_SECRET
                )

                const message = new Message({
                    text: data.message
                })

                const chat = new Chat({
                    users: [data.userId, decode.id],
                    lastMessage: message._id
                })

                message.chatId = chat._id

                await Promise.all([
                    await chat.save(),
                    await message.save()
                ])

                res.status(201).json({
                    message: "New chat created",
                    chat:{ 
                        id: chat._id
                    }
                })  
            } catch(e) {
                next(e)
            }
        }
    ]

    const getChat = [
        validateHeaders(),
        param('chatId', "Require chat id")
        .exists({ values: 'falsy'})
        .bail()
        .isMongoId()
        .withMessage('Invalid mongo id format')
        .escape(),

        async(req, res, next) => {
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
            }

            try {
                const data = matchedData(req)
                const decode = jwt.verify(
                    data.authorization,
                    process.env.TOKEN_SECRET
                )

                const chat = await Chat.findById(data.chatId)
                const messages = await Message.find({
                    chatId: data.chatId
                })

                res.status(200).json({
                    chat: {
                        chat, 
                        messages: messages
                    }
                })
            } catch(e) {
                next(e)
            }
        }
    ]

    const createMessage = (req, res) => {
        res.send('Send a message in a specific chat not implemented')
    }

    const getMessages = (req, res) => {
        res.send('Get all messages in a chat not implemented')
    }

    // Should returns all users except the user in session
    const getUsers = [
        validateHeaders(),
        async(req, res, next) => {
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

                const users = await User.find({
                    _id: { $ne: decode.id }
                }, { 
                    _id: 1,
                    "profile.username": 1,
                })
                
                res.status(200).json({ users: users })
            } catch(e) { 
                next(e)
            }
        }
    ]

    function validateHeaders() {
        return header('authorization', 'Requires authorization')
        .exists({ values: 'falsy' })
        .bail()
        .contains('Bearer ')
        .withMessage('Authorization doesnt contain Bearer')
        .customSanitizer(input => {
            const authHeader = input.split(' ')
            const token = authHeader[1]
            return token
        })
        .isJWT()
        .withMessage('Forbidden')
        .escape()
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

