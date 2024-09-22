export { default as UserController } from './UserController.js';
export { default as SessionController } from './SessionController.js';
export { default as ChatController } from './ChatController.js';
export { default as MessageController } from './MessageController.js';
import { cookie } from 'express-validator';

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

export { validateHeaders };
