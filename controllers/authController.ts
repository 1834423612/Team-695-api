import type { Request, Response } from "express"
import axios from "axios"
import { casdoorConfig } from "../config/casdoor"
import authService from "../services/authService"
import tokenBlacklist from "../services/tokenBlacklistService"
import { success, error, unauthorized } from "../utils/responses"
import { v4 as uuidv4 } from "uuid"

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

            // 检查 API Key 授权 - 先查看是否已由中间件验证过
            if (req.apiAuthenticated && req.user) {
                console.log("User authenticated via API Key middleware");
                return success(res, req.user);
            }

            // 直接从请求中检查 API Key
            const apiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
            const apiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;

            if (apiKey && apiSecret) {
                console.log("Found API Key in request, attempting direct authentication");
                try {
                    // 使用 API Key 和 Secret 从 Casdoor 获取用户信息
                    const userData = await authService.getUserInfoWithApiKey(apiKey, apiSecret);
                    return success(res, userData);
                } catch (apiErr) {
                    console.error("API Key direct authentication failed:", apiErr);
                }
            }
            
            // 如果没有 API Key 或 API Key 验证失败，则尝试 JWT 验证
            
            // First check if middleware has already set user information via JWT
            if (req.user) {
                console.log("User authenticated via JWT middleware");
                return success(res, req.user);
            }

            // Try to get token from different sources
            let token: string | undefined;

            // Get from Authorization header
            const authHeader = req.headers.authorization;
            if (authHeader) {
                // Support tokens with or without Bearer prefix
                token = authHeader.startsWith("Bearer ")
                    ? authHeader.slice(7) // Remove "Bearer " prefix
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

            if (!token) {
                return unauthorized(res, "Please provide a valid JWT token or API Key/Secret");
            }

            // Check if token is blacklisted
            const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
            if (isBlacklisted) {
                return unauthorized(res, "Token has been revoked");
            }

            // Try to parse the token
            try {
                const decodedToken = authService.parseJwtToken(token);

                // Validate token content
                if (!decodedToken || !decodedToken.payload) {
                    return unauthorized(res, "Token content is invalid");
                }

                // Set user information to request object for future use
                req.user = decodedToken.payload;
                req.token = token;
                req.decodedToken = decodedToken;

                return success(res, decodedToken.payload);
            } catch (tokenError) {
                console.error("Token parsing error:", tokenError);
                return unauthorized(res, (tokenError as Error).message);
            }
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
     * Checks not only token format but also verifies with Casdoor that the token is still valid
     */
    async validateToken(req: Request, res: Response) {
        try {
            // 如果我们通过了 verifyToken 中间件，意味着基本认证有效
            let isAdmin = false;
            let tokenIsActive = false;
            
            // 检查 API Key 认证
            if (req.apiAuthenticated && req.user) {
                console.log("API Key authentication detected in validateToken");
                
                // 验证API Key是否仍然有效（调用Casdoor API）
                try {
                    const apiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
                    const apiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;
                    
                    if (apiKey && apiSecret) {
                        // 尝试使用API Key获取账户信息来验证其仍然有效
                        const accountResponse = await axios.get(
                            `${casdoorConfig.endpoint}/api/get-account?accessKey=${encodeURIComponent(apiKey)}&accessSecret=${encodeURIComponent(apiSecret)}`
                        );
                        
                        tokenIsActive = accountResponse.status === 200 && accountResponse.data?.status === "ok";
                        console.log(`API Key validation result: ${tokenIsActive ? 'valid' : 'invalid'}`);
                    }
                } catch (error) {
                    console.error("Error validating API key with Casdoor:", error);
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
                
                // 调用Casdoor验证令牌是否仍然有效
                try {
                    // 使用令牌调用 Casdoor 的 get-account 端点来验证令牌有效性
                    const response = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-account`,
                        {
                            headers: {
                                Authorization: `Bearer ${req.token}`,
                                "Content-Type": "application/json"
                            }
                        }
                    );
                    
                    tokenIsActive = response.status === 200 && response.data?.status === "ok";
                    console.log(`JWT validation result with Casdoor: ${tokenIsActive ? 'valid' : 'invalid'}`);
                } catch (error) {
                    console.error("Error validating JWT with Casdoor:", error);
                    tokenIsActive = false;
                }
                
                isAdmin = authService.isUserAdmin(req.decodedToken);
            } else {
                console.log("No authentication detected in validateToken");
                return unauthorized(res, "Authentication required");
            }
            
            if (!tokenIsActive) {
                return unauthorized(res, "Token/API Key is no longer valid");
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
