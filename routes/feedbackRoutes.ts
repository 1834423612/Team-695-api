import express from 'express';
import { submitFeedback } from '../controllers/feedbackController';
import rateLimiter from '../middleware/rateLimiter';

const router = express.Router();

router.post('/feedback', rateLimiter, submitFeedback);

export default router;
