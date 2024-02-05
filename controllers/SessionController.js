import { User } from '../models/index.js'
import { validationResult, body } from 'express-validator'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

function SessionController() {

    const register = [
        body('username', 'Username cannot be empty')
            .trim()
            .isLength({ min:1 })
            .escape(),

        body('email', 'E-mail cannot be empty')
            .trim()
            .isLength({ min: 3, max: 256 })
            .withMessage('Email must be between 3 - 256 characters')
            .isEmail()
            .withMessage('Incorrect E-mail format')
            .escape(),

        body('password', 'Password must be at least 8 characters')
            .trim()
            .isLength({ min: 8 })
            .escape(),
        body('confirmPassword', 'Password confirmation cannot be empty')
            .trim()
            .isLength({ min: 1})
            .escape(),

        body('confirmPassword', 'Confirm password not equal password')
            .custom((input, { req }) => {
                return input === req.body.password
            }),
        
        async (req, res) => {
            const result = validationResult(req)
            if(!result.isEmpty()) {
                const mappedResult = result.mapped()
                const errors = {}
                for(const key of Object.keys(mappedResult)) {
                    errors[`${key}`] = mappedResult[`${key}`].msg

                }
                res.status(422).json({ errors: errors })
                return
            }

            try {
                const encryptedPassword = await bcrypt.hash(
                    req.body.password, 
                    10
                )
                const user = new User({
                    profile: {
                        username: req.body.username,
                        email: req.body.email,
                        password: encryptedPassword
                    }
                })

                await user.save()
                res.status(201).json({ msg: "Account created successfully" })

            } catch(e) {
                if(e instanceof mongoose.mongo.MongoServerError 
                    && e.code === 11000) {
                    res.status(409).json({
                        msg: "E-mail already in use"
                    })
                    return
                }
                res.status(500).json({ 
                    msg: "Something went wrong with the database"
                })
            }
        
    }]

    const login = (req, res) => {
        res.send('login user not implemeted')
    }

    

    return {
        register, 
        login
    }
}

export default SessionController