import type { Request, Response, NextFunction } from "express"
import authService from "../services/authService"

// Extend Express Request type to include user information
declare global {
    namespace Express {
        interface Request {
            user?: any
            token?: string
            decodedToken?: any
        }
    }
}

/**
 * Middleware to verify JWT token
 */
export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    try {
        let token: string | undefined;
        
        // First try to get token from authorization header
        const authHeader = req.headers.authorization
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1]
        }
        
        // If not found in authorization header, try from query parameters
        if (!token) {
            token = req.query.token as string
        }

        // If not found in query parameters, check if already set in request object
        if (!token && req.token) {
            token = req.token
        }

        // If token not found by any method, return unauthorized error
        if (!token) {
            return res.status(401).json({ message: "No token provided" })
        }

        // Set token to request object
        req.token = token

        // Parse and verify token
        try {
            const decodedToken = authService.parseJwtToken(token)
            
            // Check if token is expired
            const currentTime = Math.floor(Date.now() / 1000)
            if (decodedToken.payload && decodedToken.payload.exp && decodedToken.payload.exp < currentTime) {
                return res.status(401).json({ message: "Token expired" })
            }

            // Attach decoded token and user information to request object
            req.decodedToken = decodedToken
            req.user = decodedToken.payload
            
            next()
        } catch (tokenError) {
            console.error("Token parsing error:", tokenError)
            return res.status(401).json({ message: "Invalid token", error: (tokenError as Error).message })
        }
    } catch (error) {
        console.error("Token verification error:", error)
        return res.status(500).json({ message: "Verification failed", error: (error as Error).message })
    }
}

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" })
        }

        const isAdmin =
            req.user.role === "admin" || req.user.isAdmin === true || (req.user.groups && req.user.groups.includes("admin"))

        if (!isAdmin) {
            return res.status(403).json({ message: "Admin privileges required" })
        }

        next()
    } catch (error) {
        console.error("Admin check error:", error)
        return res.status(500).json({ message: "Failed to verify admin privileges" })
    }
}
