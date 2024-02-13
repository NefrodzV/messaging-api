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
        // Validating and Sanitizing
        header('authorization', 'Requires authorization')
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
            .withMessage('Forbidden'),
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
                }
                )
                res.status(200).json({
                    user: {
                    username: user.profile.username,
                    image: user.profile.image
                }})
            } catch(e) {
                next(e)
            }
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
            .exists({ values: 'undefined' })
            .withMessage('authorization not defined')
            .customSanitizer((input) => {
                const headers = input.split(' ')
                const token = headers[1]
                return token
            })
            .isJWT()
            .withMessage('Forbidden')
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
                console.log("Handling error")
                next(e)
                
            }
        }
        
    ]

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

