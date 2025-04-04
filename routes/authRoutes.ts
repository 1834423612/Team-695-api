import express from "express"
import { parseJwtToken, getAuthToken } from "../services/authService"

const router = express.Router()

// Handle OAuth callback
router.post("/login", async (req, res) => {
    try {
        const code = req.query.code as string

        if (!code) {
            return res.status(400).json({ error: "Authorization code is required" })
        }

        const tokenResponse = await getAuthToken(code)
        return res.json({ token: tokenResponse.access_token })
    } catch (error) {
        console.error("Error in login endpoint:", error)
        return res.status(500).json({ error: "Failed to authenticate" })
    }
})

// Get user info from token
router.get("/user-info", (req, res) => {
    try {
        const token = req.query.token as string

        if (!token) {
            return res.status(400).json({ error: "Token is required" })
        }

        const userInfo = parseJwtToken(token)
        return res.json(userInfo)
    } catch (error) {
        console.error("Error getting user info:", error)
        return res.status(500).json({ error: "Failed to get user info" })
    }
})

// Verify token middleware
export const verifyToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Authentication required" })
        }

        const token = authHeader.split(" ")[1]
        const tokenInfo = parseJwtToken(token);

        if (!tokenInfo.payload || typeof tokenInfo.payload.exp !== "number") {
            return res.status(401).json({ error: "Invalid token structure" });
        }
        
        const currentTime = Math.floor(Date.now() / 1000);
        if (tokenInfo.payload.exp < currentTime) {
            return res.status(401).json({ error: "Token expired" });
        }
        // Add user info to request
        ; (req as any).user = tokenInfo.payload;
        next()
    } catch (error) {
        console.error("Token verification error:", error)
        return res.status(401).json({ error: "Invalid token" })
    }
}

export default router

