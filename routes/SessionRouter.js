import { Router } from 'express';
import { SessionController } from '../controllers/index.js';

const router = Router();

router.post('/signup', SessionController.signup);

router.post('/login', SessionController.login);

router.get('/signout', SessionController.signout);

export default router;
