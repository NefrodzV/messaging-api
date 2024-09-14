import { Router } from 'express';
import { chatController } from '../controllers/index.js';

const router = new Router();

router.get('/', chatController.getChats);

router.post('/', chatController.createChat);

router.get('/:chatId', chatController.getChat);

export default router;
