import jwt from 'jsonwebtoken'
import { Chat, Message } from '../models/index.js'
import { 
    body,  
    validationResult , 
    matchedData, 
    param,
    query} from 'express-validator'
import { configDotenv } from 'dotenv'
import { validateHeaders } from './index.js'
configDotenv()

function ChatController() {
    const getChats = [
        validateHeaders(),
        // Getting a chat with another user with id
        query('userId')
            .optional()
            .trim()
            .isMongoId()
            .withMessage('Invalid id format')
            .escape(),
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

                if(data.userId) {
                    // Look up chat with the other user with his id
                    const chat = await Chat.findOne({
                        users: { $all: [data.userId, decode.id]}
                    },{
                        _id: 1,
                        users: 1,
                        messages: 1
                    }).populate('users').populate('messages')

                    // If nothing was found
                    if(!chat) return res.status(409).json({
                        message: "Another chat with this user could not be found"
                    })

                    return res.status(200).json({
                        message: "Chat with this user found",
                        chat: chat
                    })
                }

                const chats = await Chat.find({
                    users: decode.id
                }, {
                    // Returns the first user that is not with the specified id
                    users: { $elemMatch: { $ne: decode.id }},
                    lastMessage: 1
                }).populate('lastMessage').populate("users")

                
                res.status(200).json({
                    chats: chats
                })
            } catch(e) {
                next(e)
            }
        }

        
    ]

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

                // Find a chat that the two users have initiated
                const message = new Message({
                    text: data.message,
                    user: data.userId
                })

                const chat = new Chat({
                    users: [data.userId, decode.id],
                    lastMessage: message._id,
                    messages: [message._id]
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
            .withMessage('Invalid id format')
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

                const chat = await Chat.findById(data.chatId, {
                    users: { $elemMatch: { $ne: decode.id }},
                    
                }).populate('users')

                console.log("Specific chat")
                console.log(chat)
                const messages = await Message.find({
                    chatId: data.chatId
                })

                res.status(200).json({
                    chat,
                    messages
                })
            } catch(e) {
                next(e)
            }
        }
    ]

    return {
        getChat,
        getChats,
        createChat
    }
}

export default ChatController