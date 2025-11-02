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

            // 透明代理到 Casdoor 验证 token（优先），成功后使用 Casdoor 返回的数据作为 req.user
            try {
                const incomingCookies = (req.headers.cookie || "").toString();
                const hasCasdoorToken = incomingCookies.includes("casdoor-token=");
                const cookieHeader = hasCasdoorToken ? incomingCookies : `${incomingCookies ? incomingCookies + '; ' : ''}casdoor-token=${token}`;

                const response = await axios.get(
                    `${casdoorConfig.endpoint}/api/user`,
                    {
                        timeout: 3000,
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json",
                            "Cookie": cookieHeader
                        }
                    }
                );

                // 如果 Casdoor 明确通过，使用返回的数据构建 req.user
                if (response.status === 200 && (response.data?.status === 'ok' || response.data)) {
                    let payload: any = response.data?.data || response.data || {};

                    // If Casdoor returned an array (e.g. data: [ { user } ]), take first element
                    if (Array.isArray(payload) && payload.length > 0) {
                        payload = payload[0];
                    }

                    // Normalize user object safely
                    const user = {
                        id: payload.sub || payload.id || payload.userId || payload.account || payload.name || '',
                        name: payload.name || payload.displayName || payload.username || '',
                        email: payload.email || payload.data?.email || payload.properties?.oauth_Google_email || '',
                        username: payload.preferred_username || payload.username || payload.name || '',
                        displayName: payload.data?.displayName || payload.displayName || payload.name || '',
                        avatar: payload.data?.avatar || payload.avatar || payload.properties?.oauth_Google_avatarUrl || '',
                        isAdmin: payload.isAdmin === true || payload.data?.isAdmin === true || payload.tag === 'admin' || false,
                        groups: payload.groups || payload.data?.groups || payload.properties?.groups || [],
                        role: payload.role || payload.data?.role || '',
                        owner: payload.owner || payload.data?.owner || casdoorConfig.orgName,
                        raw: payload
                    } as any;

                    req.user = user;
                    req.token = token;
                    req.decodedToken = { payload };

                    return next();
                }
            } catch (validationError: any) {
                // 如果 Casdoor 明确返回 401，加入黑名单并拒绝。
                if (axios.isAxiosError(validationError) && validationError.response && validationError.response.status === 401) {
                    try {
                        // 尝试解析 exp 用于黑名单过期时间
                        const decoded = authService.parseJwtToken(token)
                        await tokenBlacklist.addToBlacklist(token, decoded.payload?.exp)
                        console.log('Token added to blacklist, expires at:', new Date((decoded.payload?.exp || 0) * 1000).toISOString())
                    } catch (e) {
                        // ignore parse errors
                    }
                    return unauthorized(res, 'Token is invalid or has been revoked')
                }

                // 其他错误（网络、超时等）根据 TOKEN_VALIDATION_FALLBACK 决定是否回退到本地解析
                console.error('Remote validation error:', validationError)
                if (process.env.TOKEN_VALIDATION_FALLBACK === 'true') {
                    try {
                        const decodedToken = authService.parseJwtToken(token)
                        const currentTime = Math.floor(Date.now() / 1000)
                        if (decodedToken.payload && decodedToken.payload.exp && decodedToken.payload.exp < currentTime) {
                            return unauthorized(res, 'Token has expired')
                        }

                        req.decodedToken = decodedToken
                        req.user = decodedToken.payload
                        req.token = token

                        console.log('Using local token parsing due to remote validation failure')
                        return next()
                    } catch (parseErr) {
                        console.error('Local parse fallback failed:', parseErr)
                        return unauthorized(res, 'Token validation failed')
                    }
                }

                return unauthorized(res, 'Token validation failed')
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
            // Debug: print a concise snapshot of the user for troubleshooting admin checks
            try {
                const snapshot = {
                    isAdmin: req.user?.isAdmin,
                    tag: req.user?.tag || req.user?.raw?.tag,
                    groups: req.user?.groups || req.user?.raw?.groups,
                    role: req.user?.role || req.user?.raw?.role,
                    keys: Object.keys(req.user || {}).slice(0, 20)
                }
                console.warn('requireAdmin: rejected user snapshot:', JSON.stringify(snapshot))
            } catch (e) {
                console.warn('requireAdmin: failed to serialize user for debug')
            }

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

            // 尝试使用 Casdoor 验证 token（非阻塞），如果失败则回退到本地解析或继续不认证
            try {
                const incomingCookies = (req.headers.cookie || "").toString();
                const hasCasdoorToken = incomingCookies.includes("casdoor-token=");
                const cookieHeader = hasCasdoorToken ? incomingCookies : `${incomingCookies ? incomingCookies + '; ' : ''}casdoor-token=${token}`;

                const response = await axios.get(
                    `${casdoorConfig.endpoint}/api/user`,
                    {
                        timeout: 3000,
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json",
                            "Cookie": cookieHeader
                        }
                    }
                );

                if (response.status === 200 && (response.data?.status === 'ok' || response.data)) {
                    let payload: any = response.data?.data || response.data || {}
                    if (Array.isArray(payload) && payload.length > 0) payload = payload[0]
                    req.user = payload
                    req.decodedToken = { payload }
                    return next()
                }
            } catch (err: any) {
                // 如果远程验证失败且启用降级，回退到本地解析，否则直接继续不认证
                console.error('Optional remote validation failed:', err)
                if (process.env.TOKEN_VALIDATION_FALLBACK === 'true') {
                    try {
                        const decodedToken = authService.parseJwtToken(token)
                        const currentTime = Math.floor(Date.now() / 1000)
                        if (decodedToken.payload && decodedToken.payload.exp && decodedToken.payload.exp < currentTime) {
                            return next()
                        }
                        req.decodedToken = decodedToken
                        req.user = decodedToken.payload
                        return next()
                    } catch (parseErr) {
                        console.error('Optional local parse fallback failed:', parseErr)
                    }
                }
            }

            next()
        } catch (error) {
            // In case of any error, continue without authentication
            console.error("Optional auth error:", error)
            next()
        }
    }
]
