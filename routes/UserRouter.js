import { Router } from 'express';
import { UserController } from '../controllers/index.js';

const router = Router();

router.get('/', UserController.getUsers);
// Me route is for user that began a session with token
router.get('/me', UserController.getUser);
router.put('/me/password', UserController.changePassword);
router.put('/me/image', UserController.uploadProfileImage);

export default router;
