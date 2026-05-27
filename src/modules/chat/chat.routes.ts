import { Router } from 'express';
import { chatController } from './chat.controller.js';
import { listMessagesQuerySchema } from './chat.validation.js';
import { validateQuery } from '../../middleware/validate.middleware.js';
import { catchAsync } from '../../utils/catch-async.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

// Chat history is viewer-relative (participant check in the service) → all
// routes need an authed user.
const router = Router();
router.use(requireAuth);

router.get(
  '/:conversationId/messages',
  validateQuery(listMessagesQuerySchema),
  catchAsync(chatController.listMessages),
);

export default router;
