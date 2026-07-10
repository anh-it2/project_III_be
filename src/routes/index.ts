import { Router } from 'express';
import userRoutes from '../modules/user/user.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import friendRoutes from '../modules/friend/friend.routes.js';
import postRoutes from '../modules/post/post.routes.js';
import hashtagRoutes from '../modules/hashtag/hashtag.routes.js';
import chatRoutes from '../modules/chat/chat.routes.js';
import uploadsRoutes from '../modules/uploads/uploads.routes.js';
import storyRoutes from '../modules/story/story.routes.js';

const router = Router();

// Mount each feature module under its own prefix.
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/friends', friendRoutes);
// Story routes graft onto the '/posts' prefix and MUST precede postRoutes so
// GET /posts/stories matches before postRoutes' '/:id' swallows "stories".
router.use('/posts', storyRoutes);
router.use('/posts', postRoutes);
router.use('/hashtags', hashtagRoutes);
router.use('/chat', chatRoutes);
router.use('/uploads', uploadsRoutes);

export default router;
