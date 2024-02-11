import { User } from '../models/index.js'
import { validationResult, body } from 'express-validator'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { configDotenv } from 'dotenv'
configDotenv()

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

    const login = [
        body('email', 'E-mail cannot be empty')
            .trim()
            .isLength({ min: 1 })
            .isEmail()
            .withMessage('Incorrect E-mail format')
            .escape(),
        body('password', "Password has a minimum of 8 characters")
            .trim()
            .isLength({ min: 8})
            .escape(),
        

        async (req, res) => {
            const result = validationResult(req)
            if(!result.isEmpty()) {
                const mappedResult = result.mapped()
                const errors = {}
                for(const key of Object.keys(mappedResult)) {
                    errors[`${key}`] = mappedResult[`${key}`].msg
                }
                res.status(422).json({
                    errors: errors
                })
                return
            }

            try {
                const user = await User.findOne({ "profile.email": req.body.email })
                // User doesnt exist in db
                if(!user) {
                    res.status(400).json({
                        msg: "Incorrect username or password. Please try again"
                    })
                    return
                }
                const correctPassword = await bcrypt.compare(req.body.password, user.profile.password)
                // Incorrect user password
                if(!correctPassword) {
                    res.status(400).json({
                        msg: "Incorrect username or password. Please try again"
                    })
                    return
                }

                const payload = {
                    id: user._id,
                    username: user.profile.username
                }
                console.log(process.env.TOKEN_SECRET)
                jwt.sign(
                    payload, 
                    process.env.TOKEN_SECRET,
                    (err, token) => {
                        if(err) {
                            console.log(err)
                            res.status(500).json({ 
                                msg: 'Something went wrong with the server'
                            })
                            return
                        }
                        res.status(200).json({ token: token})
                    }
                )

            } catch(e) {
                res.status(500).json({
                    msg: 'Uh Oh! Something went wrong'
                })
                console.log(e)
            }
            
        }
    ]

    

    return {
        register, 
        login
    }
}

export default SessionController