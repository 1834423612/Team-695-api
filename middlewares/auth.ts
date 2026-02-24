import type { Request, Response, NextFunction } from "express"
import axios from "axios"
import { casdoorConfig } from "../config/casdoor"
import authService from "../services/authService"
import tokenBlacklist from "../services/tokenBlacklistService"
import { unauthorized } from "../utils/responses"
import { verifyApiKey } from "./apiKeyAuth"
import { sanitizeLatin1IfString } from "../utils/sanitizeLatin1"

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
 * Combined authentication middleware - tries API Key first, falls back to JWT
 */
export const verifyToken = [
    verifyApiKey,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // If already authenticated via API Key, continue
            if (req.apiAuthenticated) {
                return next()
            }

            let token: string | undefined;

            // First try to get token from authorization header
            const authHeader = req.headers.authorization
            if (authHeader && authHeader.startsWith("Bearer ")) {
                token = sanitizeLatin1IfString(authHeader.split(" ")[1])
            }

            // If not found in authorization header, try from query parameters
            if (!token) {
                token = sanitizeLatin1IfString(req.query.token as string)
            }

            // If still not found, check in cookie
            if (!token && req.cookies) {
                token = sanitizeLatin1IfString(req.cookies.token)
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

            // Proxy to Casdoor for token verification (preferred), use Casdoor's response data as req.user
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

                // If Casdoor validates successfully, build req.user from response data
                if (response.status === 200 && (response.data?.status === 'ok' || response.data)) {
                    let payload: any = response.data?.data || response.data || {};

                    // If Casdoor returned an array (e.g. data: [ { user } ]), take first element
                    if (Array.isArray(payload) && payload.length > 0) {
                        payload = payload[0];
                    }

                    // If payload lacks admin/groups info, try to fetch full account via /api/get-user
                    const needsFullAccount = !(payload.isAdmin === true) && (!payload.groups || payload.groups.length === 0);
                    if (needsFullAccount) {
                        try {
                            // determine username and owner
                            let userName = payload.name || payload.preferred_username || payload.username || payload.sub;
                            const userOwner = payload.owner || payload.data?.owner || casdoorConfig.orgName;
                            if (userName) {
                                const fullId = `${userOwner}/${userName}`;
                                const accountRes = await axios.get(
                                    `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(fullId)}`,
                                    {
                                        headers: {
                                            Authorization: `Bearer ${token}`,
                                            "Content-Type": "application/json"
                                        }
                                    }
                                );

                                if (accountRes.status === 200 && accountRes.data?.status === 'ok' && accountRes.data.data) {
                                    let accountPayload = accountRes.data.data;
                                    if (Array.isArray(accountPayload) && accountPayload.length > 0) accountPayload = accountPayload[0];
                                    payload = { ...payload, ...accountPayload };
                                    // log for debug
                                    console.log('Fetched full account info for user:', fullId);
                                }
                            }
                        } catch (e: any) {
                            console.warn('Failed to fetch full account info from Casdoor:', e?.message || e);
                        }
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
                // If Casdoor returns 401, add to blacklist and reject
                if (axios.isAxiosError(validationError) && validationError.response && validationError.response.status === 401) {
                    try {
                        // Parse exp for blacklist expiration time
                        const decoded = authService.parseJwtToken(token)
                        await tokenBlacklist.addToBlacklist(token, decoded.payload?.exp)
                        console.log('Token added to blacklist, expires at:', new Date((decoded.payload?.exp || 0) * 1000).toISOString())
                    } catch (e) {
                        // ignore parse errors
                    }
                    return unauthorized(res, 'Token is invalid or has been revoked')
                }

                // For other errors (network, timeout, etc.), fallback to local parsing based on TOKEN_VALIDATION_FALLBACK
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

        // For API Key authentication
        if (req.apiAuthenticated) {
            isAdmin = req.user.isAdmin === true || 
                (req.user.groups && (
                    req.user.groups.includes("admin") || 
                    req.user.groups.includes("Team695/admin")
                ));
        } 
        // For JWT authentication
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
        // If already authenticated via API Key, continue
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

            // Try Casdoor token validation (non-blocking), fallback to local parsing or continue without auth if failed
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
                // If remote validation fails and fallback enabled, use local parsing; otherwise continue without auth
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
