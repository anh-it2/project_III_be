import { Router } from 'express';
import userRoutes from '../modules/user/user.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';

const router = Router();

// Mount each feature module under its own prefix.
router.use('/users', userRoutes);
router.use('/auth', authRoutes);

export default router;
