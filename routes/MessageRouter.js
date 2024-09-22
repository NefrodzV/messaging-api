import { Router } from 'express';
import { MessageController } from '../controllers/index.js';

const router = new Router();

router.get('/', MessageController.getMessages);

router.post('/', MessageController.createMessage);

export default router;
