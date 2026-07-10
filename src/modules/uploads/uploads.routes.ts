import { Router } from 'express';
import { uploadsController } from './uploads.controller.js';
import { singleImage } from '../../middleware/upload.middleware.js';
import { catchAsync } from '../../utils/catch-async.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

// Uploading is always done as the logged-in user → auth required.
const router = Router();
router.use(requireAuth);

router.post('/single', singleImage, catchAsync(uploadsController.single));

export default router;
