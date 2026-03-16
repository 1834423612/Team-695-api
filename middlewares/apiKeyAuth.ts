import type { Request, Response, NextFunction } from "express"
import axios from "axios"
import authService from "../services/authService"

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

        req.apiAuthAttempted = true;
        console.log("API Key auth attempted with:", apiKey.substring(0, 5) + "...");
        console.log("Request path:", req.path);

        const user = await authService.getUserInfoWithApiKey(apiKey, apiSecret)

        console.log("API Key auth successful");
        console.log("Resolved API Key user:", JSON.stringify({
            id: user.id,
            name: user.name,
            owner: user.owner,
            isAdmin: user.isAdmin,
        }));

        req.user = user;
        req.apiAuthenticated = true;
        req.apiAuthError = undefined;

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

        req.apiAuthError = axios.isAxiosError(error) && error.response?.status === 401
            ? "Invalid API credentials"
            : "API Key authentication failed";

        // If API Key verification fails, allow JWT verification to run if provided.
        console.log("API Key auth failed, continuing to JWT auth...");
        return next();
    }
};
