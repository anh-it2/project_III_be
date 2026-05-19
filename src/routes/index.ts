import { Router } from 'express';
import userRoutes from '../modules/user/user.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import friendRoutes from '../modules/friend/friend.routes.js';
import postRoutes from '../modules/post/post.routes.js';

const router = Router();

// Mount each feature module under its own prefix.
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/friends', friendRoutes);
router.use('/posts', postRoutes);

export default router;
