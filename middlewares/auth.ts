import type { Request, Response, NextFunction } from "express"
import authService from "../services/authService"
import tokenBlacklist from "../services/tokenBlacklistService"
import { unauthorized } from "../utils/responses"

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
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
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
            return unauthorized(res, "No token provided")
        }

        // Check if token is blacklisted
        const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
        if (isBlacklisted) {
            return unauthorized(res, "Token has been revoked")
        }

        // Set token to request object
        req.token = token

        // Parse and verify token
        try {
            const decodedToken = authService.parseJwtToken(token)

            // Check if token is expired
            const currentTime = Math.floor(Date.now() / 1000)
            if (decodedToken.payload && decodedToken.payload.exp && decodedToken.payload.exp < currentTime) {
                return unauthorized(res, "Token expired")
            }

            // Attach decoded token and user information to request object
            req.decodedToken = decodedToken
            req.user = decodedToken.payload

            next()
        } catch (tokenError) {
            console.error("Token parsing error:", tokenError)
            return unauthorized(res, `Invalid token: ${(tokenError as Error).message}`)
        }
    } catch (error) {
        console.error("Token verification error:", error)
        return res.status(500).json({
            success: false,
            message: "Verification failed",
            error: (error as Error).message
        })
    }
}

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return unauthorized(res, "Authentication required")
        }

        const isAdmin =
            req.user.role === "admin" ||
            req.user.isAdmin === true ||
            (req.user.groups && (
                req.user.groups.includes("admin") ||
                req.user.groups.includes("Team695/admin")
            ))

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Admin privileges required"
            })
        }

        next()
    } catch (error) {
        console.error("Admin check error:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to verify admin privileges"
        })
    }
}

/**
 * Optional authentication middleware
 * Will attach user info if token is provided and valid, but won't block the request if not
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
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

        // If token is not provided, continue without authentication
        if (!token) {
            return next()
        }

        // Check if token is blacklisted
        const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
        if (isBlacklisted) {
            // Token is blacklisted, but we'll continue without authentication
            return next()
        }

        // Set token to request object
        req.token = token

        // Parse and verify token
        try {
            const decodedToken = authService.parseJwtToken(token)

            // Check if token is expired
            const currentTime = Math.floor(Date.now() / 1000)
            if (decodedToken.payload && decodedToken.payload.exp && decodedToken.payload.exp < currentTime) {
                // Token is expired, but we'll continue without authentication
                return next()
            }

            // Attach decoded token and user information to request object
            req.decodedToken = decodedToken
            req.user = decodedToken.payload
        } catch (tokenError) {
            // Token is invalid, but we'll continue without authentication
            console.error("Optional auth token parsing error:", tokenError)
        }

        next()
    } catch (error) {
        // In case of any error, continue without authentication
        console.error("Optional auth error:", error)
        next()
    }
}
