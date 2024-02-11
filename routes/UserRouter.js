import { Router } from "express";
import { userController } from "../controllers/index.js";

const router = Router()

// Me route is for user that began a session with token
router.get('/me', userController.getUser)

router.get('/me/chats', userController.getChats)

router.post('/me/chats', userController.createChat)

// Get a specific chat a user selects
router.get('/me/chats/:chatId', userController.getChat)

router.get('/me/chats/:chatId/messages', userController.getMessages)

router.post('/me/chats/:chatId/messages', userController.createMessage)

export default router