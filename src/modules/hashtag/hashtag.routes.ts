import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { catchAsync } from '../../utils/catch-async.js';
import { hashtagController } from './hashtag.controller.js';

// Auth required: trending/posts-by-tag list posts the viewer can see (and
// the controller reads req.user!.sub for "my reaction" scoping).
const router = Router();
router.use(requireAuth);

// Static segment before '/:tag/posts' (no '/:tag' wildcard above).
router.get('/trending', catchAsync(hashtagController.trending));
router.get('/:tag/posts', catchAsync(hashtagController.postsByTag));

export default router;
