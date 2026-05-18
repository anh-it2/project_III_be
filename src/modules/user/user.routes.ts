import { Router } from 'express';
import { userController } from './user.controller.js';
import { createUserSchema, updateProfileSchema } from './user.validation.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { catchAsync } from '../../utils/catch-async.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', validateBody(createUserSchema), catchAsync(userController.create));
router.get('/', catchAsync(userController.list));
router.get('/me', requireAuth, catchAsync(userController.me));
// Registered before '/:id' so "profile" is never swallowed as an :id.
router.get('/me/profile', requireAuth, catchAsync(userController.getMyProfile));
router.patch(
  '/me/profile',
  requireAuth,
  validateBody(updateProfileSchema),
  catchAsync(userController.updateMyProfile),
);
router.get('/:id', catchAsync(userController.getById));

export default router;
