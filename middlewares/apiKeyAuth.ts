import type { Request, Response, NextFunction } from "express"
import axios from "axios"
import { casdoorConfig } from "../config/casdoor"
import { unauthorized } from "../utils/responses"

/**
 * Verify user identity using API Key and API Secret
 * This allows accessing the API via API Key without using JWT token
 */
export const verifyApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get API Key and Secret from request headers or URL parameters
        const apiKey = req.headers["x-api-key"] as string || req.query.accessKey as string;
        const apiSecret = req.headers["x-api-secret"] as string || req.query.accessSecret as string;

        // If no API Key or Secret provided, continue to next middleware (likely JWT verification)
        if (!apiKey || !apiSecret) {
            console.log("No API Key/Secret found, continuing to next middleware");
            return next();
        }

        console.log("API Key auth attempted with:", apiKey.substring(0, 5) + "...");
        console.log("Request path:", req.path);

        // Use Casdoor API to get user info (authenticate via URL parameters)
        const url = `${casdoorConfig.endpoint}/api/get-account?accessKey=${encodeURIComponent(apiKey)}&accessSecret=${encodeURIComponent(apiSecret)}`;
        console.log("Requesting Casdoor API at:", url);

        const response = await axios.get(url);

        // Check response status
        if (response.status !== 200 || response.data.status !== "ok") {
            console.log("API Key auth failed: Invalid API credentials");
            console.log("Casdoor response:", response.data);
            return unauthorized(res, "Invalid API credentials");
        }

        console.log("API Key auth successful");
        console.log("Casdoor response:", JSON.stringify(response.data).substring(0, 200) + "...");

        // Get user info from response
        const userData = response.data;
        
        // Create user object - handle Casdoor's data structure
        const user = {
            id: userData.sub || userData.id || '',
            name: userData.name || '',
            email: userData.data?.email || userData.email || '',
            username: userData.name || '',
            displayName: userData.data?.displayName || userData.name || '',
            avatar: userData.data?.avatar || '',
            // Check multiple possible ways of admin identification
            isAdmin: 
                userData.data?.isAdmin === true || 
                (userData.data?.roles && userData.data.roles.some((r: any) => r.name === "admin")) ||
                (userData.data?.groups && userData.data.groups.includes("Team695/admin")),
            groups: userData.data?.groups || [],
            owner: userData.data?.owner || casdoorConfig.orgName,
            // Add extra info to match user object structure in JWT verification
            role: userData.data?.role || '',
            permissions: userData.data?.permissions || [],
        };

        console.log("Created user object:", user);

        // Add user info to request object
        req.user = user;
        req.apiAuthenticated = true;

        // Continue processing request
        next();
    } catch (error) {
        console.error("API Key verification error:", error);
        
        // Add specific error info logs
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
        
        // If API Key verification fails, don't return 401 directly, try JWT verification instead
        // Because user might have provided both API Key and JWT
        if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
            console.log("API Key auth failed with 401, continuing to JWT auth...");
            return next();
        }
        
        // For other types of errors, also continue to JWT verification
        console.log("API Key auth failed with error, continuing to JWT auth...");
        return next();
    }
};
