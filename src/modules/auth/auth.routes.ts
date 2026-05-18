import { Router } from 'express';
import { authController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.validation.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { catchAsync } from '../../utils/catch-async.js';

const router = Router();

router.post('/login', validateBody(loginSchema), catchAsync(authController.login));
router.post('/register', validateBody(registerSchema), catchAsync(authController.register));

export default router;
