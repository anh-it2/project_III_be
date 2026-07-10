import { Router } from 'express';
import { userController } from './user.controller.js';
import { createUserSchema, updateProfileSchema } from './user.validation.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { singleImage } from '../../middleware/upload.middleware.js';
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
// Multipart image uploads (multer parses the body, bypassing express.json).
// Static '/me/*' segments stay before '/:id' so they're not read as an :id.
router.patch(
  '/me/avatar',
  requireAuth,
  singleImage,
  catchAsync(userController.updateMyAvatar),
);
router.patch(
  '/me/cover',
  requireAuth,
  singleImage,
  catchAsync(userController.updateMyCover),
);
router.get('/:id', catchAsync(userController.getById));

export default router;
