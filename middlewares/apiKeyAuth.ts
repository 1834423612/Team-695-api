import type { Request, Response, NextFunction } from "express"
import axios from "axios"
import { casdoorConfig } from "../config/casdoor"
import { unauthorized } from "../utils/responses"

/**
 * 使用 API Key 和 API Secret 验证用户身份
 * 这允许不使用 JWT token 而通过 API Key 访问 API
 */
export const verifyApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // 从请求头或URL参数获取 API Key 和 Secret
        const apiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
        const apiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;

        // 如果没有提供 API Key 或 Secret，继续下一个中间件（可能是 JWT 验证）
        if (!apiKey || !apiSecret) {
            console.log("No API Key/Secret found, continuing to next middleware");
            return next();
        }

        console.log("API Key auth attempted with:", apiKey.substring(0, 5) + "...");
        console.log("Request path:", req.path);

        // 使用 Casdoor API 获取用户信息（使用 URL 参数方式认证）
        const url = `${casdoorConfig.endpoint}/api/get-account?accessKey=${encodeURIComponent(apiKey)}&accessSecret=${encodeURIComponent(apiSecret)}`;
        console.log("Requesting Casdoor API at:", url);

        const response = await axios.get(url);

        // 检查响应状态
        if (response.status !== 200 || response.data.status !== "ok") {
            console.log("API Key auth failed: Invalid API credentials");
            console.log("Casdoor response:", response.data);
            return unauthorized(res, "Invalid API credentials");
        }

        console.log("API Key auth successful");
        console.log("Casdoor response:", JSON.stringify(response.data).substring(0, 200) + "...");

        // 从响应中获取用户信息
        const userData = response.data;
        
        // 创建用户对象 - 处理 Casdoor 的数据结构
        const user = {
            id: userData.sub || userData.id || '',
            name: userData.name || '',
            email: userData.data?.email || userData.email || '',
            username: userData.name || '',
            displayName: userData.data?.displayName || userData.name || '',
            avatar: userData.data?.avatar || '',
            // 检查多种可能的管理员标识方式
            isAdmin: 
                userData.data?.isAdmin === true || 
                (userData.data?.roles && userData.data.roles.some((r: any) => r.name === "admin")) ||
                (userData.data?.groups && userData.data.groups.includes("Team695/admin")),
            groups: userData.data?.groups || [],
            owner: userData.data?.owner || casdoorConfig.orgName,
            // 添加额外信息，确保匹配 JWT 验证中的用户对象结构
            role: userData.data?.role || '',
            permissions: userData.data?.permissions || [],
        };

        console.log("Created user object:", user);

        // 将用户信息添加到请求对象
        req.user = user;
        req.apiAuthenticated = true;

        // 继续处理请求
        next();
    } catch (error) {
        console.error("API Key verification error:", error);
        
        // 添加具体错误信息的日志
        if (axios.isAxiosError(error)) {
            if (error.response) {
                console.error("Casdoor API responded with:", {
                    status: error.response.status,
                    data: error.response.data
                });
            } else if (error.request) {
                console.error("No response received from Casdoor API");
            } else {
                console.error("Error setting up request:", error.message);
            }
        }
        
        // 如果是API Key验证的错误，不应该直接返回401，而是继续尝试JWT验证
        // 因为用户可能同时提供了API Key和JWT
        if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
            console.log("API Key auth failed with 401, continuing to JWT auth...");
            return next();
        }
        
        // 对于其他类型的错误，也继续尝试JWT验证
        console.log("API Key auth failed with error, continuing to JWT auth...");
        return next();
    }
};
