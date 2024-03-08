import { Router } from "express";
import { userController } from "../controllers/index.js";

const router = Router()

router.get('/', userController.getUsers)
// Me route is for user that began a session with token
router.get('/me', userController.getUser)
router.put('/me/password', userController.changePassword)
router.put("/me/image", userController.uploadProfileImage)

export default router