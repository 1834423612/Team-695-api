import { Router } from 'express';
import assignmentController from '../controllers/assignmentController';
import { verifyToken } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(verifyToken);

// Create a new assignment (admin only)
router.post('/', assignmentController.createAssignment);

// Update an existing assignment (admin only)
router.put('/:id', assignmentController.updateAssignment);

// Get all assignments for an event (admin only)
router.get('/events/:eventKey', assignmentController.getEventAssignments);

// Get assignments for current user
router.get('/user/:eventKey', assignmentController.getUserAssignments);

// Delete an assignment (admin only)
router.delete('/:id', assignmentController.deleteAssignment);

export default router;
