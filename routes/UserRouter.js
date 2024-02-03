import { Router } from "express";
import { userController } from "../controllers/index.js";

const router = Router()

// Gets all users in database except the logged in user
router.get('/', (req, res) => {
    res.status(200).json({ msg: "Getting users not implemented"})
})

router.post('/', (req, res) => {
    res.status(200).json({ 
        msg: "success", 
        username: req.body.username, 
        password: req.body.password
    })
})

router.get('/:userId', userController.getUser)

router.get('/:userId/profile', (req, res) => {
    res.send('Gets the user profile not implemented')
})

router.post('/:userId/profile', (req, res) => {
    res.send('update the user profile not implemented')
})

router.get('/:userId/chats', userController.getChats)

// Create a new chat with other user
router.post('/userId/chats', userController.createChat)

router.get('/:userId/chats/:chatId', userController.getChat)

// Send a new message in chat
router.post('/:userId/chats/:chatId', userController.createMessage)

export default router