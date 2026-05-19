import { Router } from 'express';
import { postController } from './post.controller.js';
import {
  createPostSchema,
  updatePostSchema,
  pinPostSchema,
  reactPostSchema,
  createCommentSchema,
} from './post.validation.js';
import { singleMedia } from './post.upload.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { catchAsync } from '../../utils/catch-async.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

// Every post route is viewer-relative (create as me, edit/delete only mine,
// feed for a logged-in user) → auth required for all of them.
const router = Router();
router.use(requireAuth);

router.get('/', catchAsync(postController.list));
router.post('/', validateBody(createPostSchema), catchAsync(postController.create));

// Static segments BEFORE '/:id' so "upload" isn't swallowed as an :id.
// multer parses multipart itself (bypasses express.json's 5mb limit).
router.post('/upload', singleMedia, catchAsync(postController.uploadMedia));

router.patch('/:id', validateBody(updatePostSchema), catchAsync(postController.update));
router.post('/:id/pin', validateBody(pinPostSchema), catchAsync(postController.pin));
router.delete('/:id', catchAsync(postController.remove));

// Reactions (any authed user). DELETE = remove my reaction.
router.post('/:id/react', validateBody(reactPostSchema), catchAsync(postController.react));
router.delete('/:id/react', catchAsync(postController.unreact));

// Comments (any authed user).
router.get('/:id/comments', catchAsync(postController.listComments));
router.post(
  '/:id/comments',
  validateBody(createCommentSchema),
  catchAsync(postController.addComment),
);

export default router;
