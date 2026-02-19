import { Router } from 'express';
import scoutifyController from '../controllers/scoutifyController';
import { verifyToken, requireAdmin } from '../middlewares/auth';

const router = Router();

router.use(verifyToken);

router.get('/user/me', scoutifyController.getCurrentUserBinding);
router.get('/user/me/android-device', scoutifyController.getCurrentAndroidDeviceBinding);
router.patch('/user/me/android-device', scoutifyController.updateCurrentAndroidDeviceBinding);

router.get('/game-matchups', scoutifyController.getGameMatchups);
router.get('/game-details', scoutifyController.getGameDetails);

router.get('/event-assignments', scoutifyController.getEventAssignments);
router.get('/event-tasks', scoutifyController.getEventTasks);

router.patch('/admin/users/:teamNumber/:scoutifyUserId/android-device', requireAdmin, scoutifyController.adminUpdateAndroidDeviceBinding);

router.post('/admin/game-details', requireAdmin, scoutifyController.createGameDetail);
router.put('/admin/game-details', requireAdmin, scoutifyController.updateGameDetail);
router.delete('/admin/game-details', requireAdmin, scoutifyController.deleteGameDetail);

router.post('/admin/event-assignments', requireAdmin, scoutifyController.createEventAssignment);
router.delete('/admin/event-assignments', requireAdmin, scoutifyController.deleteEventAssignment);

router.post('/admin/event-tasks', requireAdmin, scoutifyController.createEventTask);
router.put('/admin/event-tasks/:taskId', requireAdmin, scoutifyController.updateEventTask);
router.delete('/admin/event-tasks/:taskId', requireAdmin, scoutifyController.deleteEventTask);

export default router;
