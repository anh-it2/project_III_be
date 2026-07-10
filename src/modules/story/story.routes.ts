import { Router } from 'express';
import { storyController } from './story.controller.js';
import { createStorySchema } from './story.validation.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { catchAsync } from '../../utils/catch-async.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

// Mounted under '/posts' (see routes/index.ts) so paths resolve to
// '/posts/stories' — the exact path the FE contract requires. Auth is attached
// per-route (not router.use) so non-story '/posts/*' requests fall straight
// through to postRoutes without running requireAuth twice.
const router = Router();

router.get('/stories', requireAuth, catchAsync(storyController.list));
router.post(
  '/stories',
  requireAuth,
  validateBody(createStorySchema),
  catchAsync(storyController.create),
);

export default router;
