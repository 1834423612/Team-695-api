import type { Request, Response } from "express"
import axios from "axios"
import { casdoorConfig } from "../config/casdoor"
import authService from "../services/authService"
import tokenBlacklist from "../services/tokenBlacklistService"
import { success, error, unauthorized } from "../utils/responses"
import { v4 as uuidv4 } from "uuid"

// 扩展 Request 类型，添加 tokenCache 属性
declare global {
    namespace Express {
        interface Request {
            tokenCache?: {
                [key: string]: {
                    isAdmin: boolean,
                    expiry: number
                }
            }
        }
    }
}

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
            console.log("getCurrentUser called with headers:", req.headers);
            console.log("API authenticated:", req.apiAuthenticated);

            // If already authenticated by middleware (JWT or API Key)
            if (req.user) {
                console.log("User already authenticated via middleware");
                return success(res, req.user);
            }

            // Try to get token from different sources
            let token: string | undefined;

            // Get from Authorization header
            const authHeader = req.headers.authorization;
            if (authHeader) {
                // Support tokens with or without Bearer prefix
                token = authHeader.startsWith("Bearer ")
                    ? authHeader.slice(7)
                    : authHeader;
            }

            // Get from query parameters
            if (!token && req.query.token) {
                token = req.query.token as string;
            }

            // Get from request object
            if (!token && req.token) {
                token = req.token;
            }

            if (token) {
                // Check local blacklist first
                const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
                if (isBlacklisted) {
                    return unauthorized(res, "Token has been revoked");
                }

                try {
                    const decodedToken = authService.parseJwtToken(token);

                    if (!decodedToken || !decodedToken.payload) {
                        return unauthorized(res, "Token content is invalid");
                    }

                    // Remote validation: only blacklist if Casdoor confirms token is invalid
                    try {
                        // Use /api/user endpoint to validate JWT (GET, not POST)
                        const axiosOptions = {
                            timeout: 3000,
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json"
                            }
                        };

                        const response = await axios.get(
                            `${casdoorConfig.endpoint}/api/user`,
                            axiosOptions
                        );

                        const tokenIsActive = response?.status === 200 && response.data?.status === "ok";

                        if (!tokenIsActive) {
                            // Only blacklist if Casdoor confirms token is invalid
                            await tokenBlacklist.addToBlacklist(token, decodedToken.payload.exp);
                            console.log("Token was revoked on Casdoor, adding to local blacklist");
                            return unauthorized(res, "Token has been revoked on authentication server");
                        }

                        // Token is valid, return user info
                        req.user = decodedToken.payload;
                        req.token = token;
                        req.decodedToken = decodedToken;

                        return success(res, decodedToken.payload);
                    } catch (validationError) {
                        console.error("Remote token validation error:", validationError);

                        // If fallback is enabled and it's a server error, use local validation
                        if (process.env.TOKEN_VALIDATION_FALLBACK === "true" && axios.isAxiosError(validationError)) {
                            console.log("Using fallback validation due to remote validation error");
                            req.user = decodedToken.payload;
                            req.token = token;
                            req.decodedToken = decodedToken;
                            return success(res, decodedToken.payload, "Warning: Using local validation only");
                        }

                        return unauthorized(res, "Token validation failed");
                    }

                } catch (tokenError) {
                    console.error("Token parsing error:", tokenError);
                    // If local parsing fails, continue to API Key check
                }
            }

            // If no valid token, try API Key
            const apiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
            const apiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;

            if (apiKey && apiSecret) {
                console.log("Found API Key in request, attempting authentication");
                try {
                    const userData = await authService.getUserInfoWithApiKey(apiKey, apiSecret);
                    return success(res, userData);
                } catch (apiErr) {
                    console.error("API Key authentication failed:", apiErr);
                }
            }

            return unauthorized(res, "Please provide a valid JWT token or API Key/Secret");
        } catch (err) {
            console.error("Error in getCurrentUser:", err);
            return error(res, 500, "Failed to get user information", err);
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
     * Always verifies with Casdoor that the token is still valid using methods that don't create new tokens
     */
    async validateToken(req: Request, res: Response) {
        try {
            // 如果我们通过了 verifyToken 中间件，意味着基本认证有效
            let isAdmin = false;
            let tokenIsActive = false;
            
            // 创建一个简单的缓存键
            const cacheKey = req.apiAuthenticated 
                ? `apikey:${req.headers["x-api-key"] || req.query.accessKey}`
                : `jwt:${req.token?.substring(0, 20)}`;
                
            // 检查是否需要绕过缓存（强制验证）
            const bypassCache = req.query.bypassCache === 'true';
                
            // 首先检查缓存 - 从 req 对象获取缓存，如果有的话且未要求绕过缓存
            const cachedResult = !bypassCache && req.tokenCache?.[cacheKey];
            if (cachedResult && cachedResult.expiry > Date.now()) {
                console.log(`Using cached token validation result for ${cacheKey}`);
                return success(res, {
                    valid: true,
                    isAdmin: cachedResult.isAdmin,
                    tokenStatus: "active",
                    fromCache: true
                });
            }
            
            // 检查 API Key 认证
            if (req.apiAuthenticated && req.user) {
                console.log("API Key authentication detected in validateToken");
                
                try {
                    const apiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
                    const apiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;
                    
                    if (apiKey && apiSecret) {
                        // 使用validate-credentials端点验证API Key，而不是生成新token的get-account
                        const axiosOptions = {
                            timeout: 3000, // 3秒超时
                            headers: {
                                "Content-Type": "application/json"
                            }
                        };
                        
                        // 执行验证
                        const response = await axios.post(
                            `${casdoorConfig.endpoint}/api/validate-credentials`,
                            { 
                                type: "api-key", 
                                key: apiKey, 
                                secret: apiSecret 
                            },
                            axiosOptions
                        );
                        
                        tokenIsActive = response?.status === 200 && response.data?.status === "ok";
                        console.log(`API Key validation result: ${tokenIsActive ? 'valid' : 'invalid'}`);
                    }
                } catch (error) {
                    console.error("Error validating API key with Casdoor:", error);
                    // 远程验证失败时，标记为无效
                    tokenIsActive = false;
                }
                
                // 检查是否为管理员
                isAdmin = req.user.isAdmin === true || 
                    (req.user.groups && (
                        req.user.groups.includes("admin") || 
                        req.user.groups.includes("Team695/admin")
                    ));
            }
            // 检查 JWT 认证
            else if (req.user && req.decodedToken && req.token) {
                console.log("JWT authentication detected in validateToken");
                
                try {
                    // 使用正确的Casdoor端点验证JWT，而不是不存在的validate-token
                    const axiosOptions = {
                        timeout: 3000, // 3秒超时
                        headers: {
                            "Authorization": `Bearer ${req.token}`,
                            "Content-Type": "application/json"
                        }
                    };
                    
                    // 使用/api/user端点验证token
                    const response = await axios.get(
                        `${casdoorConfig.endpoint}/api/user`,
                        axiosOptions
                    );
                    
                    // 只要能成功获取数据且状态是ok，就说明token有效
                    tokenIsActive = response?.status === 200 && response.data?.status === "ok";
                    console.log(`JWT validation result with Casdoor: ${tokenIsActive ? 'valid' : 'invalid'}`);
                } catch (error) {
                    console.error("Error validating JWT with Casdoor:", error);
                    // 返回401或其他错误，表示token无效
                    tokenIsActive = false;
                    
                    // 记录详细的错误信息
                    if (axios.isAxiosError(error) && error.response) {
                        console.log(`Casdoor response: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
                    }
                }
                
                isAdmin = authService.isUserAdmin(req.decodedToken);
            } else {
                console.log("No authentication detected in validateToken");
                return unauthorized(res, "Authentication required");
            }
            
            if (!tokenIsActive) {
                return unauthorized(res, "Token/API Key is no longer valid");
            }
            
            // 如果验证成功，在返回结果前将结果保存到缓存
            const cacheExpiry = Date.now() + (5 * 60 * 1000); // 5分钟有效期
            if (req.tokenCache) {
                req.tokenCache[cacheKey] = {
                    isAdmin,
                    expiry: cacheExpiry
                };
                console.log(`Cached token validation result for ${cacheKey} until ${new Date(cacheExpiry).toISOString()}`);
            }
            
            return success(res, { 
                valid: true, 
                isAdmin,
                tokenStatus: "active"
            });
        } catch (err) {
            console.error("Token validation error:", err);
            return error(res, 500, "Failed to validate token", err);
        }
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
            // 检查用户是否已通过身份验证
            if (!req.user) {
                return unauthorized(res, "Authentication required");
            }

            // 确定用户是否为管理员
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
            else if (req.decodedToken) {
                isAdmin = authService.isUserAdmin(req.decodedToken);
            }

            if (!isAdmin) {
                return error(res, 403, "Admin privileges required");
            }

            // 获取查询参数
            const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 100;
            const pageNumber = req.query.pageNumber ? parseInt(req.query.pageNumber as string) : 1;
            const sortField = req.query.sortField as string || '';
            const sortOrder = req.query.sortOrder as string || '';

            // 如果使用 API Key 认证，我们需要调用不同的方法
            let result;
            if (req.apiAuthenticated) {
                console.log("Getting users with API Key authentication");
                // 使用 API Key 和 Secret 执行 getAllUsers
                const apiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
                const apiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;
                result = await authService.getAllUsersWithApiKey(apiKey, apiSecret, pageSize, pageNumber, sortField, sortOrder);
            } else {
                console.log("Getting users with JWT authentication");
                // 使用标准 JWT 方法
                result = await authService.getAllUsers(req.token as string, pageSize, pageNumber, sortField, sortOrder);
            }

            if (!result.success) {
                return error(res, 500, result.message || "Failed to retrieve users");
            }

            return success(res, result.data);
        } catch (err) {
            console.error("Error getting users:", err);
            return error(res, 500, "Failed to retrieve users", err);
        }
    }

    /**
     * Generate API keys for the authenticated user
     */
    async generateApiKey(req: Request, res: Response) {
        try {
            if (!req.user) {
                return unauthorized(res, "Authentication required");
            }

            console.log("API Key generation request from user:", req.user.name || req.user.id);
            
            // Get authentication credentials
            const authToken = req.token;
            const authApiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
            const authApiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;
            
            if (!authToken && (!authApiKey || !authApiSecret)) {
                return error(res, 400, "No valid authentication provided");
            }

            try {
                // Call service to generate API keys
                const result = await authService.generateUserApiKeys(
                    authToken,
                    authApiKey, 
                    authApiSecret
                );
                
                console.log("API keys generated successfully");
                
                // Return the new API keys
                return success(res, { 
                    accessKey: result.accessKey, 
                    accessSecret: result.accessSecret,
                    userId: result.userId,
                    owner: result.owner,
                    message: "API Keys generated successfully"
                });
            } catch (err: any) {
                console.error("Error generating API keys:", err);
                
                // Provide detailed error information for debugging
                const errorMsg = err.response?.data?.msg || err.message || "Unknown error";
                return error(res, 500, `Failed to generate API keys: ${errorMsg}`, err);
            }
        } catch (err) {
            console.error("Error in API key generation process:", err);
            return error(res, 500, "Failed to generate API keys", err);
        }
    }
}

export default new AuthController();
