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

            // If still not found, check in cookie
            if (!token && req.cookies) {
                token = req.cookies.token
            }

            // No token found, return unauthorized
            if (!token) {
                return unauthorized(res, "No authentication token provided")
            }

            // Check if token is in blacklist
            const isBlacklisted = await tokenBlacklist.isBlacklisted(token)
            if (isBlacklisted) {
                return unauthorized(res, "Token has been revoked")
            }

            try {
                // 只进行本地解析验证，确保token是由Casdoor签发的
                const decodedToken = authService.parseJwtToken(token)
                
                // 验证基本的token结构
                if (!decodedToken || !decodedToken.payload) {
                    return unauthorized(res, "Invalid token format")
                }
                
                // 验证token是否过期
                const currentTime = Math.floor(Date.now() / 1000)
                if (decodedToken.payload.exp && decodedToken.payload.exp < currentTime) {
                    return unauthorized(res, "Token has expired")
                }
                
                // 不再进行远程验证，只依赖本地验证结果

                // 远程验证 token 是否被撤销或仍然有效。
                // 重要：不要因为 Casdoor 返回的非标准 body 而盲目把 token 加入黑名单。
                // 只有在明确收到 401 时才将 token 加入本地黑名单；其他异常情况根据 TOKEN_VALIDATION_FALLBACK 决定是否降级为仅本地验证。
                try {
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

                    // 如果 CASDOOR 返回 200，优先检查返回体中的 status 字段；
                    // 若该字段存在且等于 "ok" 则视为通过；
                    // 若该字段存在但不为 "ok"，不要立即加入黑名单 —— 可能是 Casdoor 的响应格式差异或临时问题。
                    if (response.status === 200) {
                        if (response.data && typeof response.data.status !== 'undefined') {
                            if (response.data.status === 'ok') {
                                // 远程验证通过
                            } else {
                                console.warn('Remote validation returned non-ok status:', response.data);
                                if (process.env.TOKEN_VALIDATION_FALLBACK !== 'true') {
                                    return unauthorized(res, 'Token validation failed');
                                }
                                // 否则继续使用本地解析的结果（降级模式）
                                console.log('Proceeding with local token validation due to fallback policy');
                            }
                        } else {
                            // 如果返回体没有 status 字段，但 HTTP 200 成功，认为远程可达且不明确拒绝。
                            // 在非降级情况下，我们仍然接受 200 响应；如果需要更严格的校验，可打开 TOKEN_VALIDATION_FALLBACK 控制。
                            console.log('Remote validation returned 200 without explicit status field; accepting remote check');
                        }
                    }
                } catch (validationError) {
                    console.error('Remote token validation error in middleware:', validationError);

                    // 只有在 Casdoor 明确返回 401（token 被撤销或无效）时，才将 token 加入本地黑名单并拒绝请求。
                    if (axios.isAxiosError(validationError) && validationError.response && validationError.response.status === 401) {
                        await tokenBlacklist.addToBlacklist(token, decodedToken.payload.exp);
                        console.log('Token was revoked or invalid (401 from Casdoor), adding to local blacklist');
                        return unauthorized(res, 'Token is invalid or has been revoked');
                    }

                    // 其他类型的远程验证错误（网络问题、非401响应等）
                    if (process.env.TOKEN_VALIDATION_FALLBACK !== 'true') {
                        console.log('Remote validation failed and fallback disabled, rejecting token');
                        return unauthorized(res, 'Token validation failed');
                    }

                    console.log('Remote validation failed but fallback enabled — continuing with local validation only');
                }

                // Attach decoded token and user information to request object
                req.decodedToken = decodedToken
                req.user = decodedToken.payload
                req.token = token

                next()
            } catch (tokenError) {
                console.error("Token parsing error:", tokenError)
                return unauthorized(res, `Invalid token: ${(tokenError as Error).message}`)
            }
        } catch (error) {
            console.error("Token verification error:", error)
            return unauthorized(res, "Failed to verify token")
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
