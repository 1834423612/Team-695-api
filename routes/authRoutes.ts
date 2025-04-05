import { Router } from "express"
import authController from "../controllers/authController"
import { verifyToken } from "../middlewares/auth"

const router = Router()

// Public routes
router.post("/callback", authController.handleCallback)
router.get("/user-info", authController.getUserInfoFromToken)

// `/me` endpoint - won't use token verification middleware
router.get("/me", authController.getCurrentUser)

// `/validate` endpoint 
router.get("/validate", verifyToken, authController.validateToken)

export default router
