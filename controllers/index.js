import UserController from "./UserController.js";
import SessionController from "./SessionController.js";
import ChatController from "./ChatController.js";
import { header } from 'express-validator'

const userController = UserController()
const sessionController = SessionController()
const chatController = ChatController()

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

export { userController, sessionController, chatController, validateHeaders }