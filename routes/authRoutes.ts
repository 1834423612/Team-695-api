import { Router } from "express"
import authController from "../controllers/authController"
import { verifyToken } from "../middlewares/auth"

const router = Router()

// Public routes
router.post("/callback", authController.handleCallback)
router.get("/user-info", authController.getUserInfoFromToken)
router.post("/refresh-token", authController.refreshToken)

// Routes that handle their own authentication
router.get("/me", authController.getCurrentUser)

// Protected routes
router.get("/validate", verifyToken, authController.validateToken)
router.post("/logout", verifyToken, authController.logout)

export default router
