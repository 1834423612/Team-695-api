import { SDK } from "casdoor-nodejs-sdk"
import axios from "axios"
import { casdoorConfig } from "../config/casdoor"
import type { DecodedToken } from "../types"

class AuthService {
    private sdk: SDK

    constructor() {
        this.sdk = new SDK(casdoorConfig)
    }

    private buildApiKeyAuthQuery(apiKey: string, apiSecret: string) {
        return new URLSearchParams({
            accessKey: apiKey,
            accessSecret: apiSecret,
        }).toString()
    }

    private extractCasdoorPayload(responseData: any) {
        const payload = responseData?.data !== undefined ? responseData.data : responseData
        if (Array.isArray(payload)) {
            return payload[0] || {}
        }
        return payload || {}
    }

    private normalizeStringArray(value: any): string[] {
        if (!Array.isArray(value)) {
            return []
        }

        return value
            .map((item) => {
                if (typeof item === "string") {
                    return item.trim()
                }
                if (item && typeof item.name === "string") {
                    return item.name.trim()
                }
                if (item && typeof item.displayName === "string") {
                    return item.displayName.trim()
                }
                return ""
            })
            .filter((item) => item.length > 0)
    }

    private valueLooksAdmin(value: string) {
        const normalized = value.trim().toLowerCase()
        return normalized === "admin"
            || normalized === "team695/admin"
            || normalized === "super_admin"
            || normalized === "admin_role"
            || normalized === "administrator"
            || normalized.endsWith("/admin")
            || normalized.includes("admin")
    }

    private resolveAdminAccess(userData: any) {
        const nestedData = userData?.data && typeof userData.data === "object" ? userData.data : {}
        const groups = this.normalizeStringArray(userData?.groups).concat(this.normalizeStringArray(nestedData?.groups))
        const roles = this.normalizeStringArray(userData?.roles).concat(this.normalizeStringArray(nestedData?.roles))
        const permissions = this.normalizeStringArray(userData?.permissions).concat(this.normalizeStringArray(nestedData?.permissions))
        const role = typeof userData?.role === "string"
            ? userData.role
            : typeof nestedData?.role === "string"
                ? nestedData.role
                : ""

        const isAdmin = userData?.isAdmin === true
            || nestedData?.isAdmin === true
            || this.valueLooksAdmin(role)
            || groups.some((group) => this.valueLooksAdmin(group))
            || roles.some((roleName) => this.valueLooksAdmin(roleName))
            || permissions.some((permission) => this.valueLooksAdmin(permission) || permission === "*")

        return {
            isAdmin,
            groups: [...new Set(groups)],
            roles: [...new Set(roles)],
            permissions: [...new Set(permissions)],
            role,
        }
    }

    private normalizeCasdoorUser(userData: any) {
        const nestedData = userData?.data && typeof userData.data === "object" ? userData.data : {}
        const adminAccess = this.resolveAdminAccess(userData)

        return {
            id: userData?.sub || userData?.id || userData?.userId || userData?.account || userData?.name || '',
            name: userData?.name || userData?.displayName || userData?.username || '',
            email: userData?.email || nestedData?.email || '',
            username: userData?.preferred_username || userData?.username || userData?.name || '',
            displayName: nestedData?.displayName || userData?.displayName || userData?.name || '',
            avatar: nestedData?.avatar || userData?.avatar || '',
            isAdmin: adminAccess.isAdmin,
            role: adminAccess.role,
            groups: adminAccess.groups,
            roles: adminAccess.roles,
            permissions: adminAccess.permissions,
            owner: userData?.owner || nestedData?.owner || casdoorConfig.orgName,
            raw: userData,
        }
    }

    buildAuthenticatedUser(userData: any) {
        return this.normalizeCasdoorUser(userData)
    }

    private async getCurrentUserPayloadWithApiKey(apiKey: string, apiSecret: string) {
        const authQuery = this.buildApiKeyAuthQuery(apiKey, apiSecret)

        const response = await axios.get(
            `${casdoorConfig.endpoint}/api/user?${authQuery}`,
            {
                timeout: 3000,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        )

        if (response.status !== 200 || response.data?.status === "error") {
            throw new Error(response.data?.msg || "Invalid API credentials")
        }

        let payload = this.extractCasdoorPayload(response.data)
        const userName = payload?.name || payload?.preferred_username || payload?.username
        const userOwner = payload?.owner || payload?.data?.owner || casdoorConfig.orgName

        if (userName) {
            try {
                const fullUserId = `${userOwner}/${userName}`
                const fullUserResponse = await axios.get(
                    `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(fullUserId)}&${authQuery}`,
                    {
                        timeout: 3000,
                    }
                )

                if (fullUserResponse.status === 200 && fullUserResponse.data?.status === "ok" && fullUserResponse.data?.data) {
                    payload = {
                        ...payload,
                        ...this.extractCasdoorPayload(fullUserResponse.data),
                    }
                }
            } catch (error: any) {
                console.warn("Failed to enrich API key user with full Casdoor profile:", error?.message || error)
            }
        }

        return payload
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
     * Get user info from Casdoor using API Key and Secret
     * This allows API clients to authenticate directly with API Key, bypassing JWT flow
     */
    async getUserInfoWithApiKey(apiKey: string, apiSecret: string) {
        try {
            const userData = await this.getCurrentUserPayloadWithApiKey(apiKey, apiSecret)
            return this.normalizeCasdoorUser(userData)
        } catch (error) {
            console.error("Error getting user info with API Key:", error)
            throw error
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
     * This will invalidate the token on Casdoor server
     * It calls both logout and delete-token endpoints to ensure complete token revocation
     */
    async revokeToken(token: string) {
        try {
            // First try to get user info from token to ensure it's valid
            const decodedToken = this.parseJwtToken(token)

            // Extract user information needed for token revocation
            const userId = decodedToken.payload.sub || decodedToken.payload.name || ''
            const owner = decodedToken.payload.owner || casdoorConfig.orgName
            const name = decodedToken.payload.name || decodedToken.payload.preferred_username || ''

            // Track success of each operation
            const results = {
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
                results.casdoorLogout = true
            } catch (logoutError) {
                console.error("Error calling Casdoor logout endpoint:", logoutError)
            }

            // 2. Call Casdoor's delete-token endpoint
            try {
                const deleteTokenPayload = {
                    accessToken: token,
                    application: casdoorConfig.appName,
                    createdTime: new Date().toISOString(),
                    expiresIn: decodedToken.payload.exp - Math.floor(Date.now() / 1000),
                    name: name || userId,
                    organization: casdoorConfig.orgName,
                    owner: owner,
                    tokenType: "Bearer",
                    user: userId
                }
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
                if (deleteTokenResponse.data && deleteTokenResponse.data.data !== "Unaffected") {
                    results.casdoorDeleteToken = true
                } else {
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
                    if (simpleDeleteResponse.data && simpleDeleteResponse.data.data !== "Unaffected") {
                        results.casdoorDeleteToken = true
                    }
                }
            } catch (deleteTokenError) {
                // Try one more approach - directly calling the token API
                try {
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
                    if (directTokenResponse.data && directTokenResponse.data.status === "ok") {
                        results.casdoorDeleteToken = true
                    }
                } catch (directTokenError) {
                    console.error("Error calling direct token API:", directTokenError)
                }
            }

            // Return success
            return {
                success: true,
                message: "Token revoked",
                details: results
            }
        } catch (error) {
            // Return failure without any local blacklisting
            return { success: false, error: (error as Error).message }
        }
    }

    /**
     * Check if user is admin
     */
    isUserAdmin(decodedToken: DecodedToken): boolean {
        return this.resolveAdminAccess(decodedToken.payload).isAdmin
    }

    /**
     * Safely check if user is admin, handles different user data formats
     */
    isUserAdminSafe(userData: any): boolean {
        // If receiving DecodedToken type
        if (userData && userData.payload) {
            return this.isUserAdmin(userData);
        }

        return this.resolveAdminAccess(userData).isAdmin;
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
            // First verify that the token belongs to an admin (try local parse)
            const decodedToken = this.parseJwtToken(token)
            if (!this.isUserAdmin(decodedToken)) {
                // If token payload doesn't indicate admin, try fetching account info via /api/get-account (preferred)
                try {
                    const accountRes = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-account`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "application/json"
                            },
                            timeout: 3000
                        }
                    )

                    if (accountRes.status === 200 && (accountRes.data?.status === 'ok' || accountRes.data)) {
                        // accountRes may return the account object directly or under data
                        let accountPayload = accountRes.data?.data || accountRes.data || {}
                        if (Array.isArray(accountPayload) && accountPayload.length > 0) accountPayload = accountPayload[0]

                        const isAdminAccount = this.isUserAdminSafe(accountPayload)

                        if (!isAdminAccount) {
                            throw new Error("Only administrators can access user list")
                        }
                    } else {
                        throw new Error("Only administrators can access user list")
                    }
                } catch (e) {
                    // If get-account fails, fall back to stricter rejection
                    throw new Error("Only administrators can access user list")
                }
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
            console.log("Getting current API key user to verify admin status")
            const currentUser = await this.getUserInfoWithApiKey(apiKey, apiSecret)
            const userOwner = currentUser.owner || casdoorConfig.orgName
            const isAdmin = this.isUserAdminSafe(currentUser)

            if (!isAdmin) {
                throw new Error("Only administrators can access user list")
            }

            console.log(`User verified as admin. Using owner: ${userOwner}`)

            // Build query parameters with the correct owner
            const params = new URLSearchParams({
                owner: userOwner,
                pageSize: pageSize.toString(),
                p: pageNumber.toString(),
                accessKey: apiKey,
                accessSecret: apiSecret
            })

            // Add optional sort parameters
            if (sortField) params.append("sortField", sortField)
            if (sortOrder) params.append("sortOrder", sortOrder)

            // Call Casdoor API to get users
            const url = `${casdoorConfig.endpoint}/api/get-users?${params.toString()}`
            console.log(`Requesting users from: ${url}`)

            const response = await axios.get(url)

            // Handle potential error responses where the status is 200 but there's an error in the body
            if (response.data?.status === "error") {
                console.error("Casdoor API returned error:", response.data)
                throw new Error(response.data?.msg || "Failed to retrieve users: API returned error")
            }

            if (response.status !== 200 || response.data?.status !== "ok") {
                throw new Error(`Failed to retrieve users: ${response.statusText || "Unknown error"}`)
            }

            return {
                success: true,
                data: response.data,
                message: "Users retrieved successfully"
            }
        } catch (error) {
            console.error("Error retrieving users with API Key:", error)
            return { 
                success: false, 
                error: (error as Error).message,
                message: "Failed to retrieve users"
            }
        }
    }

    /**
     * Normalize user ID to ensure consistent format
     * @param userId User ID (can be plain ID, username or org/name format)
     * @returns Standardized user ID (org/name format)
     */
    normalizeUserId(userId: string): string {
        if (!userId) return '';
        
        // If already in org/name format, return directly
        if (userId.includes('/')) {
            return userId;
        }
        
        // If numeric ID or other format, add organization prefix
        return `${casdoorConfig.orgName}/${userId}`;
    }

    /**
     * Try multiple ID formats to get user info
     * @param userId User ID (may be in various formats)
     * @param token JWT token
     * @param apiKey API Key (optional)
     * @param apiSecret API Secret (optional)
     * @returns User info
     */
    async getUserWithMultipleFormats(userId: string, token?: string, apiKey?: string, apiSecret?: string): Promise<any> {
        // Prepare possible ID formats
        const possibleIds = [];
        
        // Add original ID
        possibleIds.push(userId);
        
        // If contains slash, add the part after slash
        if (userId.includes('/')) {
            possibleIds.push(userId.split('/')[1]);
        } else {
            // If no slash, add version with organization prefix
            possibleIds.push(`${casdoorConfig.orgName}/${userId}`);
        }
        
        // If ID looks like an email, add username part as possible ID
        if (userId.includes('@')) {
            const emailUsername = userId.split('@')[0];
            possibleIds.push(emailUsername);
            possibleIds.push(`${casdoorConfig.orgName}/${emailUsername}`);
            console.log(`ID appears to be an email, adding username part: ${emailUsername}`);
        }
        
        // For Google ID cases, try finding by name
        // If ID looks like Google ID (long numeric string)
        if (userId.match(/^\d{20,}$/)) {
            try {
                // Try to get current account info using API Key or Token
                const currentUserInfo = apiKey && apiSecret ? 
                    await this.getCurrentUserWithApiKey(apiKey, apiSecret) : 
                    (token ? await this.getCurrentUserWithToken(token) : null);
                
                if (currentUserInfo && currentUserInfo.name) {
                    console.log("Found user name from current user:", currentUserInfo.name);
                    possibleIds.push(currentUserInfo.name);
                    possibleIds.push(`${casdoorConfig.orgName}/${currentUserInfo.name}`);
                    
                    // Try to find matching user by listing all users
                    try {
                        console.log("Attempting to find user by listing all users and matching Google ID...");
                        // List users to find matching Google ID
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
        
        // If user ID is short and looks like username, try finding directly in user list
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
        
        // Log attempted ID formats
        console.log("Trying multiple user ID formats:", possibleIds);
        
        // Try to get user info for each possible ID
        for (const id of possibleIds) {
            try {
                let response;
                if (apiKey && apiSecret) {
                    // Get user with API Key
                    response = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(id)}&accessKey=${encodeURIComponent(apiKey)}&accessSecret=${encodeURIComponent(apiSecret)}`);
                } else if (token) {
                    // Get user with JWT
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
                // Continue trying next ID format
            }
        }
        
        // All attempts failed
        throw new Error(`User not found with any of these ID formats: ${possibleIds.join(', ')}`);
    }

    /**
     * Get current user info with API Key
     */
    async getCurrentUserWithApiKey(apiKey: string, apiSecret: string): Promise<any> {
        try {
            return await this.getUserInfoWithApiKey(apiKey, apiSecret)
        } catch (err) {
            console.error("Error getting current user with API Key:", err)
            throw err
        }
    }

    /**
     * Get current user info with JWT Token
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
     * List all users
     */
    async listAllUsers(apiKey?: string, apiSecret?: string, token?: string): Promise<any[]> {
        try {
            const pageSize = 1000;
            let allUsers: any[] = [];
            let pageNum = 1;
            let hasMore = true;
            const apiKeyOwner = apiKey && apiSecret
                ? (await this.getCurrentUserWithApiKey(apiKey, apiSecret)).owner || casdoorConfig.orgName
                : casdoorConfig.orgName;

            while (hasMore) {
                let response;
                if (apiKey && apiSecret) {
                    response = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-users?owner=${encodeURIComponent(apiKeyOwner)}&pageSize=${pageSize}&p=${pageNum}&accessKey=${encodeURIComponent(apiKey)}&accessSecret=${encodeURIComponent(apiSecret)}`);
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
            
            // Get complete user info regardless of auth method
            if (authToken) {
                // Get user info with JWT
                try {
                    // Parse JWT token to get basic user info
                    const decodedToken = this.parseJwtToken(authToken);
                    console.log("JWT decoded successfully, payload:", JSON.stringify(decodedToken.payload).substring(0, 100) + "...");
                    
                    // Get username and organization from token
                    let userName = decodedToken.payload.name;
                    const userOwner = decodedToken.payload.owner || casdoorConfig.orgName;
                    
                    // If name not found, try using preferred_username or sub
                    if (!userName) {
                        userName = decodedToken.payload.preferred_username || decodedToken.payload.sub;
                        console.log(`Name not found in token, using alternative: ${userName}`);
                    }
                    
                    if (!userName) {
                        throw new Error("Could not determine username from JWT token");
                    }
                    
                    // Build complete user ID
                    const fullId = `${userOwner}/${userName}`;
                    console.log(`Constructed user ID: ${fullId}`);
                    
                    // Call Casdoor API to get complete user object
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
                        // If first attempt fails, use /api/get-account endpoint
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
                            
                            // Get complete user info using user ID from account API
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
                // Get complete user info with API Key
                try {
                    const basicUserInfo = await this.getCurrentUserWithApiKey(authApiKey, authApiSecret)
                    const userName = basicUserInfo.name;
                    const userOwner = basicUserInfo.owner || casdoorConfig.orgName;
                    const fullId = `${userOwner}/${userName}`;
                    
                    console.log(`Retrieved basic account info. Username: ${userName}, Owner: ${userOwner}`);
                    
                    // Then get complete user object
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
            
            // Prepare request body with complete user object
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
            
            // Build correct user ID for fetching updated user info
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
                    const apiKeyUser = await this.getCurrentUserWithApiKey(authApiKey, authApiSecret)
                    const fullId = `${apiKeyUser.owner || casdoorConfig.orgName}/${apiKeyUser.name}`

                    const userResponse = await axios.get(
                        `${casdoorConfig.endpoint}/api/get-user?id=${encodeURIComponent(fullId)}&accessKey=${encodeURIComponent(authApiKey)}&accessSecret=${encodeURIComponent(authApiSecret)}`
                    )

                    if (userResponse.data?.status === "ok" && userResponse.data.data) {
                        currentApiKeyInfo = userResponse.data.data
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
