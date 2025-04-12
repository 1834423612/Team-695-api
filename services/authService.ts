import { SDK } from "casdoor-nodejs-sdk"
import axios from "axios"
import { casdoorConfig } from "../config/casdoor"
import type { DecodedToken } from "../types"
import tokenBlacklist from "./tokenBlacklistService"

class AuthService {
    private sdk: SDK

    constructor() {
        this.sdk = new SDK(casdoorConfig)
    }

    /**
     * Parse JWT token to get user information
     */
    parseJwtToken(token: string): DecodedToken {
        try {
            // Log the first 10 characters of the token for debugging
            console.log(`Attempting to parse token (first 10 chars): ${token.slice(0, 10)}...`)

            // SDK return type may not match our DecodedToken, need conversion
            const result = this.sdk.parseJwtToken(token) as any

            // Create an object conforming to our DecodedToken format
            const decodedToken: DecodedToken = {
                header: {
                    alg: result.header?.alg || "RS256",
                    kid: result.header?.kid || "default",
                    typ: result.header?.typ || "JWT"
                },
                payload: {
                    exp: typeof result.payload?.exp === 'number' ? result.payload.exp : Math.floor(Date.now() / 1000) + 3600,
                    sub: result.payload?.sub || result.id || result.name || '',
                    name: result.payload?.name || result.name || '',
                    email: result.payload?.email || result.email || '',
                    preferred_username: result.payload?.preferred_username || result.username || result.name || '',
                    owner: result.payload?.owner || result.owner || '',
                    role: result.payload?.role || result.role || '',
                    isAdmin: result.payload?.isAdmin || result.isAdmin || false,
                    // Add other possible fields
                    ...(result.payload || result)
                },
                signature: result.signature || ''
            }

            return decodedToken
        } catch (error) {
            console.error("Error parsing JWT token:", error)
            throw new Error(`Failed to parse token: ${(error as Error).message}`)
        }
    }

    /**
     * Get access token using authorization code
     */
    async getAuthToken(code: string) {
        try {
            return await this.sdk.getAuthToken(code)
        } catch (error) {
            console.error("Error getting access token:", error)
            throw error
        }
    }

    /**
     * Get user information from token
     */
    getUserInfo(token: string) {
        try {
            // Get user information from token
            const userInfo = this.parseJwtToken(token)
            return userInfo
        } catch (error) {
            console.error("Error getting user information:", error)
            throw error
        }
    }

    /**
     * 使用API Key和Secret从Casdoor获取用户信息
     * 这允许API客户端绕过JWT流程直接使用API Key进行认证
     */
    async getUserInfoWithApiKey(apiKey: string, apiSecret: string) {
        try {
            // 根据Casdoor文档，使用URL参数方式调用API
            const response = await axios.get(
                `${casdoorConfig.endpoint}/api/get-account?accessKey=${encodeURIComponent(apiKey)}&accessSecret=${encodeURIComponent(apiSecret)}`
            );

            if (response.status !== 200 || response.data.status !== "ok") {
                throw new Error("Invalid API credentials");
            }
            
            const userData = response.data;
            
            // 创建与JWT认证相似结构的用户对象
            const user = {
                id: userData.sub || userData.id || '',
                name: userData.name || '',
                email: userData.data?.email || userData.email || '',
                username: userData.name || '',
                displayName: userData.data?.displayName || userData.name || '',
                avatar: userData.data?.avatar || '',
                // 检查管理员权限
                isAdmin: 
                    userData.data?.isAdmin === true || 
                    (userData.data?.roles && userData.data.roles.some((r: any) => r.name === "admin")) ||
                    (userData.data?.groups && userData.data.groups.includes("Team695/admin")),
                role: userData.data?.role || '',
                groups: userData.data?.groups || [],
                permissions: userData.data?.permissions || [],
                owner: userData.data?.owner || casdoorConfig.orgName,
            };

            return user;
        } catch (error) {
            console.error("Error getting user info with API Key:", error);
            throw error;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(refreshToken: string) {
        try {
            const response = await axios.post(`${casdoorConfig.endpoint}/api/login/oauth/refresh_token`, {
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: casdoorConfig.clientId,
                client_secret: casdoorConfig.clientSecret,
            })

            if (response.status !== 200) {
                throw new Error(`Failed to refresh token: ${response.statusText}`)
            }

            return response.data
        } catch (error) {
            console.error("Error refreshing token:", error)
            throw error
        }
    }

    /**
     * Revoke token to log out user
     * This will invalidate the token on Casdoor server and add it to our local blacklist
     * It calls both logout and delete-token endpoints to ensure complete token revocation
     */
    async revokeToken(token: string) {
        try {
            // First try to get user info from token to ensure it's valid
            const decodedToken = this.parseJwtToken(token)

            // Add token to blacklist immediately to prevent reuse
            await tokenBlacklist.addToBlacklist(token, decodedToken.payload.exp)

            // Extract user information needed for token revocation
            const userId = decodedToken.payload.sub || decodedToken.payload.name || ''
            const owner = decodedToken.payload.owner || casdoorConfig.orgName
            const name = decodedToken.payload.name || decodedToken.payload.preferred_username || ''

            // Track success of each operation
            const results = {
                localBlacklist: true,
                casdoorLogout: false,
                casdoorDeleteToken: false
            }

            // 1. Call Casdoor's logout endpoint
            try {
                const logoutResponse = await axios.post(
                    `${casdoorConfig.endpoint}/api/logout`,
                    {
                        token: token,
                        clientId: casdoorConfig.clientId,
                        userId: userId
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json"
                        }
                    }
                )

                console.log("Casdoor logout response:", logoutResponse.data)
                results.casdoorLogout = true
            } catch (logoutError) {
                console.error("Error calling Casdoor logout endpoint:", logoutError)
            }

            // 2. Call Casdoor's delete-token endpoint with the exact format required by Casdoor
            try {
                // Prepare the delete token request according to Casdoor's API documentation
                const deleteTokenPayload = {
                    accessToken: token,
                    accessTokenHash: "", // Optional
                    application: casdoorConfig.appName,
                    code: "", // Optional
                    codeChallenge: "", // Optional
                    codeExpireIn: 0, // Optional
                    codeIsUsed: true, // Optional
                    createdTime: new Date().toISOString(), // Current time
                    expiresIn: decodedToken.payload.exp - Math.floor(Date.now() / 1000), // Time until expiration
                    name: name || userId, // Use name or userId
                    organization: casdoorConfig.orgName,
                    owner: owner,
                    refreshToken: "", // Optional
                    refreshTokenHash: "", // Optional
                    scope: "", // Optional
                    tokenType: "Bearer", // Standard token type
                    user: userId
                }

                // Log the payload for debugging
                console.log("Delete token payload:", JSON.stringify(deleteTokenPayload, null, 2))

                // Make the API call to delete the token
                const deleteTokenResponse = await axios.post(
                    `${casdoorConfig.endpoint}/api/delete-token`,
                    deleteTokenPayload,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json"
                        }
                    }
                )

                console.log("Casdoor delete-token response:", deleteTokenResponse.data)

                // Check if the token was actually deleted
                if (deleteTokenResponse.data && deleteTokenResponse.data.data !== "Unaffected") {
                    results.casdoorDeleteToken = true
                } else {
                    // If the response indicates "Unaffected", try an alternative approach
                    console.log("Token deletion reported 'Unaffected', trying alternative approach...")

                    // Try a simpler approach with just the token
                    const simpleDeleteResponse = await axios.post(
                        `${casdoorConfig.endpoint}/api/delete-token`,
                        { accessToken: token },
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "application/json"
                            }
                        }
                    )

                    console.log("Simple delete-token response:", simpleDeleteResponse.data)

                    if (simpleDeleteResponse.data && simpleDeleteResponse.data.data !== "Unaffected") {
                        results.casdoorDeleteToken = true
                    }
                }
            } catch (deleteTokenError) {
                console.error("Error calling Casdoor delete-token endpoint:", deleteTokenError)

                // Try one more approach - directly calling the token API
                try {
                    console.log("Trying direct token API approach...")

                    // Some Casdoor instances might use a different endpoint or format
                    const directTokenResponse = await axios.post(
                        `${casdoorConfig.endpoint}/api/token`,
                        {
                            owner: owner,
                            name: name || userId,
                            token: token,
                            action: "delete"
                        },
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "application/json"
                            }
                        }
                    )

                    console.log("Direct token API response:", directTokenResponse.data)

                    if (directTokenResponse.data && directTokenResponse.data.status === "ok") {
                        results.casdoorDeleteToken = true
                    }
                } catch (directTokenError) {
                    console.error("Error calling direct token API:", directTokenError)
                }
            }

            // Return success if at least the local blacklist worked
            return {
                success: true,
                message: "Token revoked",
                details: results
            }
        } catch (error) {
            console.error("Error revoking token:", error)

            // Try to blacklist the token even if parsing fails
            try {
                // Use a long expiry time if we can't parse the token
                const oneYearFromNow = Math.floor(Date.now() / 1000) + 31536000 // 1 year
                await tokenBlacklist.addToBlacklist(token, oneYearFromNow)
                return { success: true, message: "Token blacklisted locally despite parsing error" }
            } catch (blacklistError) {
                console.error("Failed to blacklist token:", blacklistError)
                return { success: false, error: (error as Error).message }
            }
        }
    }

    /**
     * Check if user is admin
     */
    isUserAdmin(decodedToken: DecodedToken): boolean {
        const payload = decodedToken.payload

        // Check for admin role in token
        if (payload.role === "admin" || payload.isAdmin === true) {
            return true
        }

        // Check if user is in admin group
        if (payload.groups && Array.isArray(payload.groups)) {
            return payload.groups.includes("admin") || payload.groups.includes("Team695/admin")
        }

        // Check if user has admin permissions
        if (payload.permissions && Array.isArray(payload.permissions)) {
            return payload.permissions.some(
                (p: string | any) => typeof p === "string" && (p.includes("admin") || p.includes("Admin") || p === "*")
            )
        }

        return false
    }

    /**
     * 安全地检查用户是否是管理员，可以处理不同格式的用户数据
     */
    isUserAdminSafe(userData: any): boolean {
        // 如果接收到的是 DecodedToken 类型
        if (userData && userData.payload) {
            return this.isUserAdmin(userData);
        }
        
        // 如果直接接收到用户数据
        if (userData) {
            // 检查管理员角色
            if (userData.role === "admin" || userData.isAdmin === true) {
                return true;
            }

            // 检查用户是否在管理员组中
            if (userData.groups && Array.isArray(userData.groups)) {
                return userData.groups.includes("admin") || userData.groups.includes("Team695/admin");
            }

            // 检查用户是否具有管理员权限
            if (userData.permissions && Array.isArray(userData.permissions)) {
                return userData.permissions.some(
                    (p: string | any) => typeof p === "string" && (p.includes("admin") || p.includes("Admin") || p === "*")
                );
            }
        }

        return false;
    }

    /**
     * Get all users from the organization
     * This API endpoint is only accessible to admins
     * @param token - Admin user's access token
     * @param pageSize - Number of users per page (optional)
     * @param pageNumber - Page number (optional)
     * @param sortField - Field to sort by (optional)
     * @param sortOrder - Sort order (optional)
     * @returns Promise containing the list of users
     */
    async getAllUsers(token: string, pageSize = 100, pageNumber = 1, sortField = '', sortOrder = '') {
        try {
            // First verify that the token belongs to an admin
            const decodedToken = this.parseJwtToken(token)
            if (!this.isUserAdmin(decodedToken)) {
                throw new Error("Only administrators can access user list")
            }

            const owner = decodedToken.payload.owner || casdoorConfig.orgName
            
            // Build query parameters
            const params = new URLSearchParams({
                owner,
                pageSize: pageSize.toString(),
                p: pageNumber.toString()
            })
            
            // Add optional sort parameters if provided
            if (sortField) params.append("sortField", sortField)
            if (sortOrder) params.append("sortOrder", sortOrder)
            
            // Call Casdoor API to get users
            const response = await axios.get(
                `${casdoorConfig.endpoint}/api/get-users?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                }
            )

            if (response.status !== 200) {
                throw new Error(`Failed to retrieve users: ${response.statusText}`)
            }

            return {
                success: true,
                data: response.data,
                message: "Users retrieved successfully"
            }
        } catch (error) {
            console.error("Error retrieving users:", error)
            return { 
                success: false, 
                error: (error as Error).message,
                message: "Failed to retrieve users"
            }
        }
    }

    /**
     * Get all users from the organization using API Key and Secret
     * This API endpoint is only accessible to admins
     */
    async getAllUsersWithApiKey(apiKey: string, apiSecret: string, pageSize = 100, pageNumber = 1, sortField = '', sortOrder = '') {
        try {
            // First get account info to verify admin status and get correct owner
            console.log("Getting account info to verify admin status");
            const accountResponse = await axios.get(
                `${casdoorConfig.endpoint}/api/get-account?accessKey=${encodeURIComponent(apiKey)}&accessSecret=${encodeURIComponent(apiSecret)}`
            );
            
            if (accountResponse.status !== 200 || accountResponse.data?.status !== "ok") {
                throw new Error("Failed to verify account information");
            }
            
            // Extract user info from response
            const userData = accountResponse.data;
            const userOwner = userData.data?.owner || casdoorConfig.orgName;
            const isAdmin = userData.data?.isAdmin === true || 
                (userData.data?.groups?.groups.includes("Team695/admin"));
            
            if (!isAdmin) {
                throw new Error("Only administrators can access user list");
            }
            
            console.log(`User verified as admin. Using owner: ${userOwner}`);
            
            // Build query parameters with the correct owner
            const params = new URLSearchParams({
                owner: userOwner,
                pageSize: pageSize.toString(),
                p: pageNumber.toString(),
                accessKey: apiKey,
                accessSecret: apiSecret
            });
            
            // Add optional sort parameters
            if (sortField) params.append("sortField", sortField);
            if (sortOrder) params.append("sortOrder", sortOrder);
            
            // Call Casdoor API to get users
            const url = `${casdoorConfig.endpoint}/api/get-users?${params.toString()}`;
            console.log(`Requesting users from: ${url}`);
            
            const response = await axios.get(url);

            // Handle potential error responses where the status is 200 but there's an error in the body
            if (response.data?.status === "error") {
                console.error("Casdoor API returned error:", response.data);
                throw new Error(response.data?.msg || "Failed to retrieve users: API returned error");
            }
            
            if (response.status !== 200 || response.data?.status !== "ok") {
                throw new Error(`Failed to retrieve users: ${response.statusText || "Unknown error"}`);
            }

            return {
                success: true,
                data: response.data,
                message: "Users retrieved successfully"
            };
        } catch (error) {
            console.error("Error retrieving users with API Key:", error);
            return { 
                success: false, 
                error: (error as Error).message,
                message: "Failed to retrieve users"
            };
        }
    }

    /**
     * 规范化用户ID，确保格式一致
     * @param userId 用户ID（可以是纯ID、用户名或org/name格式）
     * @returns 标准格式的用户ID（org/name）
     */
    normalizeUserId(userId: string): string {
        if (!userId) return '';
        
        // 如果已经是org/name格式，直接返回
        if (userId.includes('/')) {
            return userId;
        }
        
        // 如果是纯数字ID或其他格式，添加组织前缀
        return `${casdoorConfig.orgName}/${userId}`;
    }

    /**
     * 尝试多种ID格式获取用户信息
     * @param userId 用户ID（可能是多种格式）
     * @param token JWT令牌
     * @param apiKey API Key（可选）
     * @param apiSecret API Secret（可选）
     * @returns 用户信息
     */
    async getUserWithMultipleFormats(userId: string, token?: string, apiKey?: string, apiSecret?: string): Promise<any> {
        // 准备可能的ID格式
        const possibleIds = [];
        
        // 添加原始ID
        possibleIds.push(userId);
        
        // 如果包含斜杠，添加斜杠后部分
        if (userId.includes('/')) {
            possibleIds.push(userId.split('/')[1]);
        } else {
            // 如果不包含斜杠，添加带组织前缀的版本
            possibleIds.push(`${casdoorConfig.orgName}/${userId}`);
        }
        
        // 如果ID看起来像邮箱地址，添加用户名部分作为可能ID
        if (userId.includes('@')) {
            const emailUsername = userId.split('@')[0];
            possibleIds.push(emailUsername);
            possibleIds.push(`${casdoorConfig.orgName}/${emailUsername}`);
            console.log(`ID appears to be an email, adding username part: ${emailUsername}`);
        }
        
        // 大多数是 Google ID 的情况，尝试通过名称查找
        // 如果ID看起来像Google ID（很长的数字字符串）
        if (userId.match(/^\d{20,}$/)) {
            try {
                // 先尝试通过API Key或Token获取当前账户信息
                const currentUserInfo = apiKey && apiSecret ? 
                    await this.getCurrentUserWithApiKey(apiKey, apiSecret) : 
                    (token ? await this.getCurrentUserWithToken(token) : null);
                
                if (currentUserInfo && currentUserInfo.name) {
                    console.log("Found user name from current user:", currentUserInfo.name);
                    possibleIds.push(currentUserInfo.name);
                    possibleIds.push(`${casdoorConfig.orgName}/${currentUserInfo.name}`);
                    
                    // 尝试通过查询所有用户来查找匹配的用户
                    try {
                        console.log("Attempting to find user by listing all users and matching Google ID...");
                        // 通过列出用户尝试查找匹配的 Google ID
                        const users = await this.listAllUsers(apiKey, apiSecret, token);
                        console.log(`Retrieved ${users?.length} users to search for Google ID match`);
                        const foundUser = users.find((u: any) => u.id === userId || u.google === userId);
                        
                        if (foundUser) {
                            console.log("Found user by Google ID in user list:", foundUser.name);
                            possibleIds.push(foundUser.name);
                            possibleIds.push(`${foundUser.owner}/${foundUser.name}`);
                        }
                    } catch (err) {
                        console.log("Failed to list users to find matching Google ID:", err);
                    }
                }
            } catch (err) {
                console.log("Error getting current user info to find name:", err);
            }
        }
        
        // 如果用户ID短且看起来像用户名，也尝试用它直接查询用户列表
        if (userId.length < 20 && !userId.includes('/') && !userId.includes('@')) {
            try {
                console.log("Short user ID detected, attempting to find in user list directly...");
                const users = await this.listAllUsers(apiKey, apiSecret, token);
                const foundUser = users.find((u: any) => 
                    u.name === userId || 
                    u.name.toLowerCase() === userId.toLowerCase());
                
                if (foundUser) {
                    console.log("Found user by name in user list:", foundUser.name);
                    if (foundUser.owner && foundUser.name && !possibleIds.includes(`${foundUser.owner}/${foundUser.name}`)) {
                        possibleIds.push(`${foundUser.owner}/${foundUser.name}`);
                    }
                }
            } catch (err) {
                console.log("Failed to list users to find by name:", err);
            }
        }
        
        // 记录尝试的ID
        console.log("Trying multiple user ID formats:", possibleIds);
        
        // 对每个可能的ID尝试获取用户信息
        for (const id of possibleIds) {
            try {
                let response;
                if (apiKey && apiSecret) {
                    // 使用API Key获取用户
                    response = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(id)}&accessKey=${encodeURIComponent(apiKey)}&accessSecret=${encodeURIComponent(apiSecret)}`);
                } else if (token) {
                    // 使用JWT获取用户
                    response = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(id)}`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "application/json"
                            }
                        }
                    );
                } else {
                    throw new Error("No authentication provided");
                }
                
                if (response.status === 200 && response.data.status === "ok" && response.data.data) {
                    console.log(`Successfully found user with ID: ${id}`);
                    return response.data.data;
                }
            } catch (err) {
                console.log(`Failed to get user with ID: ${id}`, err);
                // 继续尝试下一个ID格式
            }
        }
        
        // 所有尝试都失败
        throw new Error(`User not found with any of these ID formats: ${possibleIds.join(', ')}`);
    }

    /**
     * 通过 API Key 获取当前用户信息
     */
    async getCurrentUserWithApiKey(apiKey: string, apiSecret: string): Promise<any> {
        try {
            const response = await axios.get(
                `${casdoorConfig.endpoint}/api/get-account?accessKey=${encodeURIComponent(apiKey)}&accessSecret=${encodeURIComponent(apiSecret)}`
            );
            
            if (response.status === 200 && response.data.status === "ok") {
                return {
                    id: response.data.sub || response.data.id,
                    name: response.data.name,
                    ...response.data.data
                };
            }
            throw new Error("Failed to get current user info");
        } catch (err) {
            console.error("Error getting current user with API Key:", err);
            throw err;
        }
    }

    /**
     * 通过 JWT Token 获取当前用户信息
     */
    async getCurrentUserWithToken(token: string): Promise<any> {
        try {
            const userInfo = this.parseJwtToken(token).payload;
            return {
                id: userInfo.sub || userInfo.id,
                name: userInfo.name,
                ...userInfo
            };
        } catch (err) {
            console.error("Error getting current user with token:", err);
            throw err;
        }
    }

    /**
     * 列出所有用户
     */
    async listAllUsers(apiKey?: string, apiSecret?: string, token?: string): Promise<any[]> {
        try {
            const pageSize = 1000;
            let allUsers: any[] = [];
            let pageNum = 1;
            let hasMore = true;

            while (hasMore) {
                let response;
                if (apiKey && apiSecret) {
                    response = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-users?owner=${casdoorConfig.orgName}&pageSize=${pageSize}&p=${pageNum}&accessKey=${encodeURIComponent(apiKey)}&accessSecret=${encodeURIComponent(apiSecret)}`);
                } else if (token) {
                    response = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-users?owner=${casdoorConfig.orgName}&pageSize=${pageSize}&p=${pageNum}`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "application/json"
                            }
                        }
                    );
                } else {
                    throw new Error("No authentication provided");
                }

                if (response.status === 200 && response.data.status === "ok" && response.data.data) {
                    const users = response.data.data;
                    allUsers = [...allUsers, ...users];

                    // If we received fewer users than the page size, we've reached the end
                    if (users.length < pageSize) {
                        hasMore = false;
                    } else {
                        pageNum++;
                    }
                } else {
                    hasMore = false;
                }
            }

            return allUsers;
            return [];
        } catch (err) {
            console.error("Error listing users:", err);
            return [];
        }
    }

    /**
     * Generate API keys for the authenticated user
     * @param authToken JWT token for authentication (optional)
     * @param authApiKey API Key for authentication (optional)
     * @param authApiSecret API Secret for authentication (optional)
     * @returns Generated API keys information
     */
    async generateUserApiKeys(
        authToken?: string,
        authApiKey?: string,
        authApiSecret?: string
    ): Promise<any> {
        console.log(`Generating API keys for authenticated user`);
        console.log(`Auth method: ${authToken ? 'JWT' : (authApiKey ? 'API Key' : 'None')}`);
        
        if (!authToken && (!authApiKey || !authApiSecret)) {
            throw new Error("Authentication required: either JWT token or API Key/Secret pair must be provided");
        }

        try {
            // The endpoint URLs for add-user-keys with different auth methods
            let url: string;
            let headers = {};
            let completeUserInfo;
            
            // 获取完整的用户信息，无论使用哪种认证方式
            if (authToken) {
                // 使用 JWT 获取用户信息
                try {
                    // 解析 JWT 令牌获取基本用户信息
                    const decodedToken = this.parseJwtToken(authToken);
                    console.log("JWT decoded successfully, payload:", JSON.stringify(decodedToken.payload).substring(0, 100) + "...");
                    
                    // 从令牌中获取用户名和组织
                    let userName = decodedToken.payload.name;
                    const userOwner = decodedToken.payload.owner || casdoorConfig.orgName;
                    
                    // 如果没有找到 name，尝试使用 preferred_username 或 sub
                    if (!userName) {
                        userName = decodedToken.payload.preferred_username || decodedToken.payload.sub;
                        console.log(`Name not found in token, using alternative: ${userName}`);
                    }
                    
                    if (!userName) {
                        throw new Error("Could not determine username from JWT token");
                    }
                    
                    // 构建完整的用户 ID
                    const fullId = `${userOwner}/${userName}`;
                    console.log(`Constructed user ID: ${fullId}`);
                    
                    // 调用 Casdoor API 获取完整的用户对象
                    const userResponse = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(fullId)}`,
                        {
                            headers: {
                                Authorization: `Bearer ${authToken}`,
                                "Content-Type": "application/json"
                            }
                        }
                    );
                    
                    if (userResponse.data?.status === "ok" && userResponse.data.data) {
                        completeUserInfo = userResponse.data.data;
                        console.log("Retrieved complete user info for JWT user");
                    } else {
                        // 如果第一次尝试失败，使用 /api/get-account 端点
                        console.log("Failed to get user info directly, trying with /api/get-account");
                        const accountResponse = await axios.get(
                            `${casdoorConfig.endpoint}/api/get-account`,
                            {
                                headers: {
                                    Authorization: `Bearer ${authToken}`,
                                    "Content-Type": "application/json"
                                }
                            }
                        );
                        
                        if (accountResponse.data?.status === "ok") {
                            const accountInfo = accountResponse.data;
                            const accountUserId = `${accountInfo.data?.owner || casdoorConfig.orgName}/${accountInfo.name}`;
                            
                            // 使用 account API 返回的用户 ID 获取完整用户信息
                            const secondUserResponse = await axios.get(
                                `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(accountUserId)}`,
                                {
                                    headers: {
                                        Authorization: `Bearer ${authToken}`,
                                        "Content-Type": "application/json"
                                    }
                                }
                            );
                            
                            if (secondUserResponse.data?.status === "ok" && secondUserResponse.data.data) {
                                completeUserInfo = secondUserResponse.data.data;
                                console.log("Retrieved user info using account API");
                            } else {
                                throw new Error("Failed to get user information with account API");
                            }
                        } else {
                            throw new Error("Failed to get user information with JWT token");
                        }
                    }
                } catch (err) {
                    console.error("Error getting JWT user info:", err);
                    console.error("Token (first 20 chars):", authToken?.substring(0, 20));
                    throw new Error("Failed to get user details required for API key generation");
                }
            } else if (authApiKey && authApiSecret) {
                // 使用 API Key 获取完整用户信息
                try {
                    // 先获取基本账户信息
                    const accountResponse = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-account?accessKey=${encodeURIComponent(authApiKey)}&accessSecret=${encodeURIComponent(authApiSecret)}`
                    );
                    
                    if (accountResponse.data?.status !== "ok") {
                        throw new Error("Failed to get account info");
                    }
                    
                    const basicUserInfo = accountResponse.data;
                    const userName = basicUserInfo.name;
                    const userOwner = basicUserInfo.data?.owner || casdoorConfig.orgName;
                    const fullId = `${userOwner}/${userName}`;
                    
                    console.log(`Retrieved basic account info. Username: ${userName}, Owner: ${userOwner}`);
                    
                    // 然后获取完整的用户对象
                    const userResponse = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(fullId)}&accessKey=${encodeURIComponent(authApiKey)}&accessSecret=${encodeURIComponent(authApiSecret)}`
                    );
                    
                    if (userResponse.data?.status === "ok" && userResponse.data.data) {
                        completeUserInfo = userResponse.data.data;
                        console.log("Retrieved complete user info for API Key user");
                    } else {
                        throw new Error(`Failed to get complete user info for ${fullId}`);
                    }
                } catch (err) {
                    console.error("Error getting complete user info with API Key:", err);
                    throw new Error("Failed to get user details required for API key generation");
                }
            }
            
            console.log("Complete user info retrieved:", JSON.stringify(completeUserInfo).substring(0, 200) + "...");
            
            // 准备请求体 - 使用完整的用户对象
            const requestBody = completeUserInfo;
            
            if (authToken) {
                // Using JWT authentication
                url = `${casdoorConfig.endpoint}/api/add-user-keys`;
                headers = {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json"
                };
                console.log("Using JWT for authentication");
            } else if (authApiKey && authApiSecret) {
                // Using API Key authentication
                url = `${casdoorConfig.endpoint}/api/add-user-keys?accessKey=${encodeURIComponent(authApiKey)}&accessSecret=${encodeURIComponent(authApiSecret)}`;
                console.log("Using API Key for authentication");
            } else {
                throw new Error("Authentication required: either JWT token or API Key/Secret pair must be provided");
            }

            // Make request to Casdoor
            console.log(`Sending request to: ${url}`);
            console.log("Request body (truncated):", JSON.stringify(requestBody).substring(0, 200) + "...");
            const response = await axios.post(url, requestBody, { headers });
            console.log("Response status:", response.status);
            console.log("Response data:", response.data);
            
            if (response.data?.status !== "ok") {
                throw new Error(response.data?.msg || "Failed to generate API keys");
            }
            
            // 构建正确的用户ID用于获取更新后的用户信息
            const userId = `${completeUserInfo.owner}/${completeUserInfo.name}`;
            
            console.log(`API keys generated successfully. Attempting to fetch updated user info for ${userId}`);
            
            try {
                // Wait a short time to ensure Casdoor has updated user information
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Try to get updated user information (containing new API keys)
                let updatedUserResponse;
                if (authToken) {
                    updatedUserResponse = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(userId)}`,
                        { headers }
                    );
                } else if (authApiKey && authApiSecret) {
                    updatedUserResponse = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(userId)}&accessKey=${encodeURIComponent(authApiKey)}&accessSecret=${encodeURIComponent(authApiSecret)}`
                    );
                }
                
                if (updatedUserResponse && updatedUserResponse.data?.status === "ok" && updatedUserResponse.data.data) {
                    const updatedUser = updatedUserResponse.data.data;
                    console.log("Retrieved user info with new keys");
                    
                    // Return the new API key information
                    return {
                        success: true,
                        userId: updatedUser.name,
                        owner: updatedUser.owner,
                        accessKey: updatedUser.accessKey || '',
                        accessSecret: updatedUser.accessSecret || '',
                        message: "API keys generated successfully"
                    };
                }
            } catch (fetchError) {
                console.error("Error fetching updated user info:", fetchError);
                console.log("Will try alternative methods to get API keys");
            }
            
            // If we couldn't get the updated user info, try to get the current API keys through other methods
            try {
                // console.log("Attempting to get current API keys through get-account API");
                let currentApiKeyInfo;
                
                if (authToken) {
                    // For JWT authentication, use the /api/me endpoint
                    const meResponse = await axios.get(
                        `/auth/me`,
                        {
                            headers: {
                                Authorization: `Bearer ${authToken}`,
                                "Content-Type": "application/json"
                            }
                        }
                    );
                    
                    if (meResponse.data?.status === "ok" && meResponse.data.data) {
                        currentApiKeyInfo = meResponse.data.data;
                    }
                } else if (authApiKey && authApiSecret) {
                    // For API Key authentication, we need to get a fresh account info
                    // Note: This will likely still return the old API key that was used for the request
                    const accountResponse = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-account?accessKey=${encodeURIComponent(authApiKey)}&accessSecret=${encodeURIComponent(authApiSecret)}`
                    );
                    
                    if (accountResponse.data?.status === "ok") {
                        // Try to get updated user information with the account API
                        const userName = accountResponse.data.name;
                        const userOwner = accountResponse.data.data?.owner || casdoorConfig.orgName;
                        const fullId = `${userOwner}/${userName}`;
                        
                        // Make one more attempt to get the user with the API key
                        const userResponse = await axios.get(
                            `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(fullId)}&accessKey=${encodeURIComponent(authApiKey)}&accessSecret=${encodeURIComponent(authApiSecret)}`
                        );
                        
                        if (userResponse.data?.status === "ok" && userResponse.data.data) {
                            currentApiKeyInfo = userResponse.data.data;
                        }
                    }
                }
                
                if (currentApiKeyInfo && (currentApiKeyInfo.accessKey || currentApiKeyInfo.accessSecret)) {
                    console.log("Successfully retrieved current API keys");
                    return {
                        success: true,
                        userId: currentApiKeyInfo.name,
                        owner: currentApiKeyInfo.owner,
                        accessKey: currentApiKeyInfo.accessKey || '',
                        accessSecret: currentApiKeyInfo.accessSecret || '',
                        message: "API keys generated successfully"
                    };
                }
            } catch (alternativeError) {
                console.error("Error getting API keys through alternative methods:", alternativeError);
            }
            
            // If all attempts to get the API keys fail, return a success response without the keys
            return {
                success: true,
                userId: completeUserInfo.name,
                owner: completeUserInfo.owner,
                message: "API keys generated successfully. Please log in to your account to view your new API keys."
            };
        } catch (error) {
            console.error("Error generating API keys:", error);
            
            // Get detailed error info
            if (axios.isAxiosError(error) && error.response) {
                console.error("API Error details:", {
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers
                });
            }
            
            throw error;
        }
    }
}

export default new AuthService()