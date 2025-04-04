import express from 'express';
import authController from '../controllers/authController';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = express.Router();

// Public routes
router.post('/callback', authController.handleCallback);

// Protected routes
router.get('/user', authenticate, authController.getUserInfo);
router.get('/users', authenticate, requireAdmin, authController.getAllUsers);

export default router;
