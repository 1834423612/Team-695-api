import { Router } from 'express';
import scoutifyController from '../controllers/scoutifyController';
import { verifyToken, requireAdmin } from '../middlewares/auth';
import { scoutifyPublicPerMinuteLimiter, scoutifyPublicPerSecondLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.get('/game-matchups', scoutifyPublicPerSecondLimiter, scoutifyPublicPerMinuteLimiter, scoutifyController.getGameMatchups);
router.get('/game-details', scoutifyPublicPerSecondLimiter, scoutifyPublicPerMinuteLimiter, scoutifyController.getGameDetails);
router.get('/game-comments', scoutifyPublicPerSecondLimiter, scoutifyPublicPerMinuteLimiter, scoutifyController.getGameComments);
router.get('/game-constants', scoutifyPublicPerMinuteLimiter, scoutifyPublicPerMinuteLimiter, scoutifyController.getGameConstants);
router.post('/game-comments', verifyToken, scoutifyController.createGameComment);

router.get('/user/me', verifyToken, scoutifyController.getCurrentUserBinding);
router.get('/user/me/android-device', verifyToken, scoutifyController.getCurrentAndroidDeviceBinding);
router.patch('/user/me/android-device', verifyToken, scoutifyController.updateCurrentAndroidDeviceBinding);

router.get('/event-assignments', verifyToken, scoutifyController.getEventAssignments);
router.get('/event-tasks', verifyToken, scoutifyController.getEventTasks);

router.patch('/admin/users/:teamNumber/:scoutifyUserId/android-device', verifyToken, requireAdmin, scoutifyController.adminUpdateAndroidDeviceBinding);

router.post('/admin/game-details', verifyToken, scoutifyController.createGameDetail);
router.put('/admin/game-details', verifyToken, requireAdmin, scoutifyController.updateGameDetail);
router.delete('/admin/game-details', verifyToken, requireAdmin, scoutifyController.deleteGameDetail);

router.post('/admin/event-assignments', verifyToken, requireAdmin, scoutifyController.createEventAssignment);
router.delete('/admin/event-assignments', verifyToken, requireAdmin, scoutifyController.deleteEventAssignment);

router.post('/admin/event-tasks', verifyToken, requireAdmin, scoutifyController.createEventTask);
router.put('/admin/event-tasks/:taskId', verifyToken, requireAdmin, scoutifyController.updateEventTask);
router.delete('/admin/event-tasks/:taskId', verifyToken, requireAdmin, scoutifyController.deleteEventTask);

export default router;
