import { SDK } from "casdoor-nodejs-sdk"
import axios from "axios"
import { casdoorConfig } from "../config/casdoor"
import type { DecodedToken } from "../types"

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
                    typ: result.header?.typ || "JWT",
                },
                payload: {
                    exp: typeof result.payload?.exp === "number" ? result.payload.exp : Math.floor(Date.now() / 1000) + 3600,
                    sub: result.payload?.sub || result.id || result.name || "",
                    name: result.payload?.name || result.name || "",
                    email: result.payload?.email || result.email || "",
                    preferred_username: result.payload?.preferred_username || result.username || result.name || "",
                    owner: result.payload?.owner || result.owner || "",
                    role: result.payload?.role || result.role || "",
                    isAdmin: result.payload?.isAdmin || result.isAdmin || false,
                    // Add other possible fields
                    ...(result.payload || result),
                },
                signature: result.signature || "",
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
     */
    async revokeToken(token: string) {
        try {
            // First try to get user info from token to ensure it's valid
            const userInfo = this.parseJwtToken(token)

            // Call Casdoor's logout endpoint to invalidate the token
            const response = await axios.post(
                `${casdoorConfig.endpoint}/api/logout`,
                {
                    // Include any required parameters for token revocation
                    token: token,
                    clientId: casdoorConfig.clientId,
                    userId: userInfo.payload.sub || userInfo.payload.name,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                },
            )

            // Also add the token to a blacklist if needed
            // This could be implemented with Redis or another fast storage
            // await this.addToBlacklist(token, userInfo.payload.exp)

            return response.data
        } catch (error) {
            console.error("Error revoking token:", error)
            // Even if there's an error, we should continue with the logout process
            return { success: false, error: (error as Error).message }
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
                (p: string | any) => typeof p === "string" && (p.includes("admin") || p.includes("Admin") || p === "*"),
            )
        }

        return false
    }
}

export default new AuthService()
