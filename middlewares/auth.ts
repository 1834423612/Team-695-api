import type { Request, Response, NextFunction } from "express"
import axios from "axios"
import { casdoorConfig } from "../config/casdoor"
import authService from "../services/authService"
import tokenBlacklist from "../services/tokenBlacklistService"
import { unauthorized } from "../utils/responses"
import { verifyApiKey } from "./apiKeyAuth"

// Extend Express Request type to include user information
declare global {
    namespace Express {
        interface Request {
            user?: any
            token?: string
            decodedToken?: any
            apiAuthenticated?: boolean
        }
    }
}

/**
 * 组合验证中间件 - 先尝试 API Key，如果失败则尝试 JWT
 */
export const verifyToken = [
    verifyApiKey,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // 如果已通过 API Key 验证，直接继续
            if (req.apiAuthenticated) {
                return next()
            }

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

                // 远程验证token是否被撤销
                try {
                    // 使用Casdoor的正确验证方式
                    const response = await axios.get(
                        `${casdoorConfig.endpoint}/api/user`,
                        { 
                            timeout: 3000,
                            headers: { 
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json" 
                            }
                        }
                    );
                    
                    const tokenIsActive = response?.status === 200 && response.data?.status === "ok";
                    
                    if (!tokenIsActive) {
                        // Token无效，添加到本地黑名单
                        await tokenBlacklist.addToBlacklist(token, decodedToken.payload.exp);
                        console.log("Token is invalid (response not ok), adding to local blacklist");
                        return unauthorized(res, "Token is invalid");
                    }
                } catch (validationError) {
                    console.error("Remote token validation error in middleware:", validationError);
                    
                    // 检查是否是401错误，表示token被撤销或无效
                    if (axios.isAxiosError(validationError) && validationError.response && validationError.response.status === 401) {
                        // 添加到本地黑名单
                        await tokenBlacklist.addToBlacklist(token, decodedToken.payload.exp);
                        console.log("Token was revoked or invalid (401 from Casdoor), adding to local blacklist");
                        return unauthorized(res, "Token is invalid or has been revoked");
                    }
                    
                    // 如果未设置降级验证，则认为token无效
                    if (process.env.TOKEN_VALIDATION_FALLBACK !== "true") {
                        return unauthorized(res, "Token validation failed");
                    }
                    
                    console.log("Using local validation only due to remote validation error");
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
]

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return unauthorized(res, "Authentication required")
        }

        let isAdmin = false;

        // 对于 API Key 认证
        if (req.apiAuthenticated) {
            isAdmin = req.user.isAdmin === true || 
                (req.user.groups && (
                    req.user.groups.includes("admin") || 
                    req.user.groups.includes("Team695/admin")
                ));
        } 
        // 对于 JWT 认证
        else {
            isAdmin =
                req.user.role === "admin" ||
                req.user.isAdmin === true ||
                (req.user.groups && (
                    req.user.groups.includes("admin") ||
                    req.user.groups.includes("Team695/admin")
                ));
        }

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
export const optionalAuth = [
    verifyApiKey,
    async (req: Request, res: Response, next: NextFunction) => {
        // 如果已通过 API Key 验证，直接继续
        if (req.apiAuthenticated) {
            return next()
        }

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
]
