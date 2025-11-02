import type { Request, Response } from "express"
import axios from "axios"
import { casdoorConfig } from "../config/casdoor"
import authService from "../services/authService"
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
            return error(res, 500, "Authentication failed", err)
        }
    }

    /**
     * Get current user information
     * 只转发到Casdoor，不做本地鉴权
     */
    async getCurrentUser(req: Request, res: Response) {
        try {
            // 获取token或API Key/Secret
            let token: string | undefined;
            const authHeader = req.headers.authorization;
            if (authHeader) {
                token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
            }
            if (!token && req.query.token) {
                token = req.query.token as string;
            }
            if (!token && req.token) {
                token = req.token;
            }
            const apiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
            const apiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;

            // 优先 API Key - 透明代理：把 Casdoor 的响应原样返回
            if (apiKey && apiSecret) {
                try {
                    const casdoorRes = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-account?accessKey=${encodeURIComponent(apiKey)}&accessSecret=${encodeURIComponent(apiSecret)}`
                    );

                    // 将 Casdoor 的 Set-Cookie 转发给客户端（如果有）
                    const setCookie = casdoorRes.headers && (casdoorRes.headers['set-cookie'] || casdoorRes.headers['Set-Cookie']);
                    if (setCookie) {
                        res.setHeader('set-cookie', setCookie as string[])
                    }

                    return res.status(casdoorRes.status).json(casdoorRes.data)
                } catch (err: any) {
                    if (axios.isAxiosError(err) && err.response) {
                        // 转发 Casdoor 的错误响应
                        const setCookie = err.response.headers && (err.response.headers['set-cookie'] || err.response.headers['Set-Cookie']);
                        if (setCookie) {
                            res.setHeader('set-cookie', setCookie as string[])
                        }
                        return res.status(err.response.status).json(err.response.data)
                    }
                    return error(res, 500, "Failed to proxy to Casdoor", err)
                }
            }
            // JWT
            if (token) {
                try {
                    // Forward incoming cookies if present, and always include casdoor-token cookie
                    const incomingCookies = (req.headers.cookie || "").toString();
                    const hasCasdoorToken = incomingCookies.includes("casdoor-token=");
                    const cookieHeader = hasCasdoorToken ? incomingCookies : `${incomingCookies ? incomingCookies + '; ' : ''}casdoor-token=${token}`;

                    const casdoorRes = await axios.get(
                        `${casdoorConfig.endpoint}/api/user`,
                        {
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json",
                                "Cookie": cookieHeader
                            }
                        }
                    );

                    const setCookie = casdoorRes.headers && (casdoorRes.headers['set-cookie'] || casdoorRes.headers['Set-Cookie']);
                    if (setCookie) {
                        res.setHeader('set-cookie', setCookie as string[])
                    }

                    return res.status(casdoorRes.status).json(casdoorRes.data)
                } catch (err: any) {
                    if (axios.isAxiosError(err) && err.response) {
                        const setCookie = err.response.headers && (err.response.headers['set-cookie'] || err.response.headers['Set-Cookie']);
                        if (setCookie) {
                            res.setHeader('set-cookie', setCookie as string[])
                        }
                        return res.status(err.response.status).json(err.response.data)
                    }
                    return error(res, 500, "Failed to proxy to Casdoor", err)
                }
            }
            return unauthorized(res, "Please provide a valid JWT token or API Key/Secret");
        } catch (err) {
            return error(res, 500, "Failed to get user information", err);
        }
    }

    /**
     * Get user information from token
     * 只转发到Casdoor，不做本地鉴权
     */
    async getUserInfoFromToken(req: Request, res: Response) {
        try {
            const token = req.query.token as string
            if (!token) {
                return error(res, 400, "Token required")
            }
                try {
                    const incomingCookies = (req.headers.cookie || "").toString();
                    const hasCasdoorToken = incomingCookies.includes("casdoor-token=");
                    const cookieHeader = hasCasdoorToken ? incomingCookies : `${incomingCookies ? incomingCookies + '; ' : ''}casdoor-token=${token}`;

                    const casdoorRes = await axios.get(
                        `${casdoorConfig.endpoint}/api/user`,
                        {
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json",
                                "Cookie": cookieHeader
                            }
                        }
                    );

                    const setCookie = casdoorRes.headers && (casdoorRes.headers['set-cookie'] || casdoorRes.headers['Set-Cookie']);
                    if (setCookie) {
                        res.setHeader('set-cookie', setCookie as string[])
                    }

                    return res.status(casdoorRes.status).json(casdoorRes.data)
                } catch (err: any) {
                    if (axios.isAxiosError(err) && err.response) {
                        const setCookie = err.response.headers && (err.response.headers['set-cookie'] || err.response.headers['Set-Cookie']);
                        if (setCookie) {
                            res.setHeader('set-cookie', setCookie as string[])
                        }
                        return res.status(err.response.status).json(err.response.data)
                    }
                    return error(res, 500, "Failed to proxy to Casdoor", err)
                }
        } catch (err) {
            return error(res, 500, "Failed to get user information", err);
        }
    }

    /**
     * Validate token
     * 只转发到Casdoor，不做本地鉴权
     */
    async validateToken(req: Request, res: Response) {
        try {
            const apiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
            const apiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;
            const token = req.token || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer /, "") : undefined);

            if (apiKey && apiSecret) {
                try {
                    const response = await axios.post(
                        `${casdoorConfig.endpoint}/api/validate-credentials`,
                        { type: "api-key", key: apiKey, secret: apiSecret },
                        { timeout: 3000, headers: { "Content-Type": "application/json" } }
                    );
                    if (response.status === 200 && response.data.status === "ok") {
                        return success(res, { valid: true, tokenStatus: "active" });
                    } else {
                        return unauthorized(res, "Token/API Key is no longer valid");
                    }
                } catch (err) {
                    return unauthorized(res, "Token/API Key is no longer valid");
                }
            } else if (token) {
                try {
                    const incomingCookies = (req.headers.cookie || "").toString();
                    const hasCasdoorToken = incomingCookies.includes("casdoor-token=");
                    const cookieHeader = hasCasdoorToken ? incomingCookies : `${incomingCookies ? incomingCookies + '; ' : ''}casdoor-token=${token}`;

                    console.log('Proxying /api/user to Casdoor with Cookie:', cookieHeader)
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
                    if (response.status === 200 && response.data.status === "ok") {
                        return success(res, { valid: true, tokenStatus: "active" });
                    } else {
                        return unauthorized(res, "Token/API Key is no longer valid");
                    }
                } catch (err) {
                    return unauthorized(res, "Token/API Key is no longer valid");
                }
            } else {
                return unauthorized(res, "Authentication required");
            }
        } catch (err) {
            return error(res, 500, "Failed to validate token", err)
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
     * 只转发到Casdoor，不做本地黑名单
     */
    async logout(req: Request, res: Response) {
        try {
            const token = req.token
            if (!token) {
                return error(res, 400, "Token required")
            }
            const revokeResult = await authService.revokeToken(token)
            return success(res, {
                message: "Logged out successfully",
                details: process.env.NODE_ENV === 'development' ? revokeResult.details : undefined
            })
        } catch (err) {
            return success(res, { message: "Logged out successfully" })
        }
    }

    /**
     * Force revoke a specific token (admin only)
     * 只转发到Casdoor，不做本地黑名单
     */
    async revokeSpecificToken(req: Request, res: Response) {
        try {
            const { token } = req.body
            if (!token) {
                return error(res, 400, "Token required")
            }
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
     * 只转发到Casdoor，不做本地isAdmin判断
     */
    async getAllUsers(req: Request, res: Response) {
        try {
            const apiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
            const apiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;
            const token = req.token || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer /, "") : undefined);

            const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 100;
            const pageNumber = req.query.pageNumber ? parseInt(req.query.pageNumber as string) : 1;
            const sortField = req.query.sortField as string || '';
            const sortOrder = req.query.sortOrder as string || '';

            let result;
            if (apiKey && apiSecret) {
                result = await authService.getAllUsersWithApiKey(apiKey, apiSecret, pageSize, pageNumber, sortField, sortOrder);
            } else if (token) {
                result = await authService.getAllUsers(token, pageSize, pageNumber, sortField, sortOrder);
            } else {
                return unauthorized(res, "Authentication required");
            }
            if (!result.success) {
                return error(res, 500, result.message || "Failed to retrieve users");
            }
            return success(res, result.data);
        } catch (err) {
            return error(res, 500, "Failed to retrieve users", err);
        }
    }

    /**
     * Generate API keys for the authenticated user
     * 只转发到Casdoor
     */
    async generateApiKey(req: Request, res: Response) {
        try {
            const authToken = req.token;
            const authApiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
            const authApiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;
            if (!authToken && (!authApiKey || !authApiSecret)) {
                return error(res, 400, "No valid authentication provided");
            }
            try {
                const result = await authService.generateUserApiKeys(
                    authToken,
                    authApiKey, 
                    authApiSecret
                );
                return success(res, { 
                    accessKey: result.accessKey, 
                    accessSecret: result.accessSecret,
                    userId: result.userId,
                    owner: result.owner,
                    message: "API Keys generated successfully"
                });
            } catch (err: any) {
                const errorMsg = err.response?.data?.msg || err.message || "Unknown error";
                return error(res, 500, `Failed to generate API keys: ${errorMsg}`, err);
            }
        } catch (err) {
            return error(res, 500, "Failed to generate API keys", err);
        }
    }
}

export default new AuthController();
