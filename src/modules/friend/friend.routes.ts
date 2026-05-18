import { Router } from 'express';
import { friendController } from './friend.controller.js';
import { catchAsync } from '../../utils/catch-async.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

// Every friend route is viewer-relative → auth required for all of them.
const router = Router();
router.use(requireAuth);

// My friends + pending requests (both directions) in one snapshot.
router.get('/', catchAsync(friendController.snapshot));
// Relationship to one user: none | requested | incoming | friends.
router.get('/status/:userId', catchAsync(friendController.getStatus));

// Outgoing request lifecycle.
router.post('/requests/:userId', catchAsync(friendController.sendRequest));
router.delete('/requests/:userId', catchAsync(friendController.cancelRequest));

// Incoming request lifecycle.
router.post('/requests/:userId/accept', catchAsync(friendController.acceptRequest));
router.post('/requests/:userId/reject', catchAsync(friendController.rejectRequest));

// Drop an existing (ACCEPTED) friendship.
router.delete('/:userId', catchAsync(friendController.unfriend));

export default router;
