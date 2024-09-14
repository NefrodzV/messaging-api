import { Router } from 'express';
import { sessionController } from '../controllers/index.js';

const router = Router();

router.post('/signup', sessionController.signup);

router.post('/login', sessionController.login);

export default router;
