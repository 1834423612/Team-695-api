import express from "express"
import { submitFeedback } from "../controllers/feedbackController"
import rateLimiter from "../middlewares/rateLimiter"
import { optionalAuth } from "../middlewares/auth"

const router = express.Router()

// Apply rate limiter and optional authentication to feedback submission
router.post("/feedback", rateLimiter, optionalAuth, submitFeedback)

export default router
