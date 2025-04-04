import express from "express"
import { verifyToken } from "./authRoutes"

const router = express.Router()

// This route is protected and requires authentication
router.get("/protected-data", verifyToken, (req, res) => {
    // The user info is available in req.user
    const user = (req as any).user

    res.json({
        message: `Hello, ${user.name || user.sub}! This is protected data.`,
        user: user,
    })
})

export default router

