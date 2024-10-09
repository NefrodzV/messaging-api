export { default as UserController } from './UserController.js';
export { default as SessionController } from './SessionController.js';
export { default as ChatController } from './ChatController.js';
export { default as MessageController } from './MessageController.js';
import { cookie, validationResult } from 'express-validator';

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
        .withMessage('Unauthorized')
        .escape();
}

function sendErrors(req, res, next) {
    const result = validationResult(req);
    if (!result.isEmpty()) {
        const mappedResult = result.mapped();
        console.log(mappedResult);
        const errors = {};
        // If error is an authorization error
        if (Object.hasOwn(mappedResult, 'jwt')) {
            errors['jwt'] = mappedResult['jwt'].msg;
            return res.status(403).json({
                errors,
            });
        } else {
            for (const key of Object.keys(mappedResult)) {
                errors[`${key}`] = mappedResult[`${key}`].msg;
            }
        }
        return res.status(422).json({
            errors: errors,
        });
    }
    next();
}

export { validateHeaders, sendErrors };
