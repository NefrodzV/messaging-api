import jwt from 'jsonwebtoken'
import { User } from '../models'
function UserController() {

    // Handles the chat creation of user and 
    const getUser = [
        async function verifyToken(req, res, next) {
            const bearerHeader = req.headers['authorization']
            console.log(bearerHeader)
            if(bearerHeader) {
                const bearer = bearerHeader.split(' ')
                const token = bearer[1]
                if(!token){
                    res.status(403).json({ msg: "Forbidden"})
                    return
                }
                req.token = token
                next()
            } else {
                res.status(403).json({ msg: "Forbidden" })
            }
        },

        async (req, res) => {
            // Processing the token data
            jwt.verify(req.token, process.env.TOKEN_SECRET, async (err, data) => {
                if(err) throw new Error('Decode error')
                if(!data) {
                    res.status(403).json({ msg: "Forbidden" })
                }

                const user = await User.findById(data.id, {
                    "profile.username": 1,
                    "profile.image": 1
                }
                )
                res.status(200).json({user: user})
            })
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

    return {
        getUser,
        getChats,
        getChat,
        createChat,
        createMessage
    }

}

export default UserController

