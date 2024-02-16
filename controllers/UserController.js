import jwt, { JsonWebTokenError } from 'jsonwebtoken'
import { User, Chat, Message } from '../models'
import { validateHeaders } from '.'
import { 
    header, 
    body,  
    validationResult , 
    matchedData, 
    param,
    query} from 'express-validator'
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
    
    const createMessage = [
        validateHeaders(),
        param('chatId', 'Require chat id')
            .trim()
            .exists({ values: 'falsy'})
            .bail()
            .isMongoId(),
        body('message', 'Message is empty')
        .trim()
        .exists({values: 'falsy'})
        .bail()
        .isLength({ max: 500 })
        .withMessage('Maximum of 500 characters'),

        async (req, res, next) => {
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

                await Message.create({
                    chatId: data.chatId,
                    user: decode.id,
                    text: data.message
                })

                res.status(201).json({
                    message: "New message created in chat"
                })
            } catch(e) {
                next(e)
            }
        }
            
    ]
    const getMessages = [
        // validateHeaders(),
        param('chatId', 'Require chat id')
            .trim()
            .exists({ values: 'falsy'})
            .bail()
            .isMongoId()
            .withMessage('Invalid mongo id format')
            .escape(),
        async (req, res, next) =>{
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
                // const decode = jwt.decode(
                //     data.authorization,
                //     process.env.TOKEN_SECRET
                // )

                const messages = await Message.find({
                    chatId: data.chatId
                })
                res.status(200).send({
                    messages: messages
                })

            } catch(e) {
                next(e)
            }
        }
    ]

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

    return {
        getUser,
        getUsers,
        getMessages,
        createMessage
    }

}

export default UserController

