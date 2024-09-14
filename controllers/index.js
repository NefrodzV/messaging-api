import UserController from './UserController.js';
import SessionController from './SessionController.js';
import ChatController from './ChatController.js';
import MessageController from './MessageController.js';
import { cookie } from 'express-validator';

const userController = UserController();
const sessionController = SessionController();
const chatController = ChatController();
const messageController = MessageController();

function validateHeaders() {
    return cookie('jwt', 'Requires authorization')
        .exists({ values: 'falsy' })
        .bail()
        .contains('Bearer ')
        .withMessage('Authorization doesnt contain Bearer')
        .customSanitizer((input) => {
            const authHeader = input.split(' ');
            const token = authHeader[1];
            return token;
        })
        .isJWT()
        .withMessage('Forbidden')
        .escape();
}

export {
    userController,
    sessionController,
    chatController,
    messageController,
    validateHeaders,
};
