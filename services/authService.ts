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
}

export default new AuthService()
