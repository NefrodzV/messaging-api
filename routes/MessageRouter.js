import { Router } from 'express';
import { messageController } from '../controllers/index.js';

const router = new Router();

router.get('/', messageController.getMessages);

router.post('/', messageController.createMessage);

export default router;
