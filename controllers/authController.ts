import type { Request, Response } from "express"
import authService from "../services/authService"
import tokenBlacklist from "../services/tokenBlacklistService"
import { success, error, unauthorized } from "../utils/responses"

class AuthController {
    /**
     * Handle OAuth callback and exchange code for tokens
     */
    async handleCallback(req: Request, res: Response) {
        try {
            const code = req.query.code as string

            if (!code) {
                return error(res, 400, "Authorization code required")
            }

            const tokenResponse = await authService.getAuthToken(code)
            return success(res, tokenResponse)
        } catch (err) {
            console.error("Callback error:", err)
            return error(res, 500, "Authentication failed", err)
        }
    }

    /**
     * Get current user information
     */
    async getCurrentUser(req: Request, res: Response) {
        try {
            // First check if middleware has already set user information
            if (req.user) {
                return success(res, req.user)
            }

            // Try to get token from different sources
            let token: string | undefined

            // Get from Authorization header
            const authHeader = req.headers.authorization
            if (authHeader) {
                // Support tokens with or without Bearer prefix
                token = authHeader.startsWith("Bearer ")
                    ? authHeader.slice(7) // Remove "Bearer " prefix
                    : authHeader
            }

            // Get from query parameters
            if (!token && req.query.token) {
                token = req.query.token as string
            }

            // Get from request object
            if (!token && req.token) {
                token = req.token
            }

            if (!token) {
                return unauthorized(res, "Please provide a valid JWT token")
            }

            // Check if token is blacklisted
            const isBlacklisted = await tokenBlacklist.isBlacklisted(token)
            if (isBlacklisted) {
                return unauthorized(res, "Token has been revoked")
            }

            // Try to parse the token
            try {
                const decodedToken = authService.parseJwtToken(token)

                // Validate token content
                if (!decodedToken || !decodedToken.payload) {
                    return unauthorized(res, "Token content is invalid")
                }

                // Set user information to request object for future use
                req.user = decodedToken.payload
                req.token = token
                req.decodedToken = decodedToken

                return success(res, decodedToken.payload)
            } catch (tokenError) {
                return unauthorized(res, (tokenError as Error).message)
            }
        } catch (err) {
            return error(res, 500, "Failed to get user information", err)
        }
    }

    /**
     * Get user information from token
     */
    async getUserInfoFromToken(req: Request, res: Response) {
        try {
            const token = req.query.token as string

            if (!token) {
                return error(res, 400, "Token required")
            }

            // Check if token is blacklisted
            const isBlacklisted = await tokenBlacklist.isBlacklisted(token)
            if (isBlacklisted) {
                return unauthorized(res, "Token has been revoked")
            }

            const userInfo = authService.parseJwtToken(token)
            return success(res, userInfo)
        } catch (err) {
            return error(res, 500, "Failed to get user information", err)
        }
    }

    /**
     * Validate token
     */
    validateToken(req: Request, res: Response) {
        // If we passed the verifyToken middleware, the token is valid
        const isAdmin = req.user ? authService.isUserAdmin(req.decodedToken) : false
        return success(res, { valid: true, isAdmin })
    }

    /**
     * Refresh access token
     */
    async refreshToken(req: Request, res: Response) {
        try {
            const { refreshToken } = req.body

            if (!refreshToken) {
                return error(res, 400, "Refresh token required")
            }

            const tokenResponse = await authService.refreshToken(refreshToken)
            return success(res, tokenResponse)
        } catch (err) {
            return error(res, 500, "Failed to refresh token", err)
        }
    }

    /**
     * Logout user by revoking token
     * This will invalidate the token on Casdoor server and add it to our local blacklist
     */
    async logout(req: Request, res: Response) {
        try {
            const token = req.token

            if (!token) {
                return error(res, 400, "Token required")
            }

            // Check if token is already blacklisted
            const isBlacklisted = await tokenBlacklist.isBlacklisted(token)
            if (isBlacklisted) {
                return success(res, { message: "Already logged out" })
            }

            // Revoke the token on Casdoor server and add to blacklist
            const revokeResult = await authService.revokeToken(token)

            // Log detailed information about the revocation process
            console.log("Token revocation details:", revokeResult)

            return success(res, {
                message: "Logged out successfully",
                details: process.env.NODE_ENV === 'development' ? revokeResult.details : undefined
            })
        } catch (err) {
            // Even if there's an error, we should return success to the client
            // as we want them to clear their local token storage
            console.error("Logout error:", err)
            return success(res, { message: "Logged out successfully" })
        }
    }

    /**
     * Force revoke a specific token (admin only)
     * This can be used by administrators to revoke tokens for other users
     */
    async revokeSpecificToken(req: Request, res: Response) {
        try {
            // Check if the current user is an admin
            if (!req.user || !authService.isUserAdmin(req.decodedToken)) {
                return error(res, 403, "Admin privileges required")
            }

            const { token } = req.body

            if (!token) {
                return error(res, 400, "Token required")
            }

            // Check if token is already blacklisted
            const isBlacklisted = await tokenBlacklist.isBlacklisted(token)
            if (isBlacklisted) {
                return success(res, { message: "Token already revoked" })
            }

            // Revoke the specified token
            const revokeResult = await authService.revokeToken(token)

            return success(res, {
                message: "Token revoked successfully",
                details: revokeResult.details
            })
        } catch (err) {
            return error(res, 500, "Failed to revoke token", err)
        }
    }

    /**
     * Get all users in the organization (admin only)
     */
    async getAllUsers(req: Request, res: Response) {
        try {
            const token = req.token
            const { pageSize, pageNumber, sortField, sortOrder } = req.query

            if (!token) {
                return error(res, 400, "Token required")
            }

            // Check if user is admin directly from token
            if (!req.user || !req.user.isAdmin) {
                return error(res, 403, "Admin privileges required")
            }

            // Call service to get users with pagination support
            const result = await authService.getAllUsers(
                token, 
                pageSize ? Number(pageSize) : undefined,
                pageNumber ? Number(pageNumber) : undefined,
                sortField ? String(sortField) : undefined,
                sortOrder ? String(sortOrder) : undefined
            )

            if (!result.success) {
                return error(res, 500, result.message, result.error)
            }

            return success(res, result.data)
        } catch (err) {
            return error(res, 500, "Failed to get users", err)
        }
    }
}

export default new AuthController()
