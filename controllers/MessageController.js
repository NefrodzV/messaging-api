import { validateHeaders } from "./index.js";
import { Message } from "../models/index.js";
import jwt from 'jsonwebtoken'
import { 
    header, 
    body,  
    validationResult , 
    matchedData, 
    param,
    query
} from 'express-validator'

function MessageController() {
    const createMessage = [
        validateHeaders(),
        query('chatId', 'Require chat id')
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
                }).catch(e => console.log(e))

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
        query('chatId', 'Require chat id')
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

    return {
        createMessage,
        getMessages
    }
}

export default MessageController