import { Router } from 'express';
import { ChatController } from '../controllers/index.js';

const router = new Router();

router.get('/', ChatController.getChats);

router.post('/', ChatController.createChat);

router.get('/:chatId', ChatController.getChat);

export default router;
