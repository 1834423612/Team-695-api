import { SDK } from "casdoor-nodejs-sdk"
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
            
            // Print SDK return value to help debugging
            console.log('SDK token parsing return type:', typeof result)
            console.log('SDK token parsing return structure:', Object.keys(result))
            
            // Create an object conforming to our DecodedToken format
            const decodedToken: DecodedToken = {
                header: {
                    alg: "RS256",
                    kid: "default",
                    typ: "JWT"
                },
                payload: {
                    exp: typeof result.exp === 'number' ? result.exp : Math.floor(Date.now() / 1000) + 3600,
                    sub: result.id || result.sub || result.name || '',
                    name: result.name || '',
                    email: result.email || '',
                    preferred_username: result.username || result.preferred_username || result.name || '',
                    owner: result.owner || '',
                    role: result.role || '',
                    isAdmin: result.isAdmin || false,
                    // Add other possible fields
                    ...result
                },
                signature: ''
            }
            
            console.log('Constructed DecodedToken:', {
                sub: decodedToken.payload.sub,
                name: decodedToken.payload.name,
                email: decodedToken.payload.email
            })
            
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
     * Get user information
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
}

export default new AuthService()
