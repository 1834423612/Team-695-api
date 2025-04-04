import { SDK } from "casdoor-nodejs-sdk"
import dotenv from "dotenv"

dotenv.config()

// Initialize Casdoor SDK
const casdoorConfig = {
    endpoint: process.env.CASDOOR_ENDPOINT || "",
    clientId: process.env.CASDOOR_CLIENT_ID || "",
    clientSecret: process.env.CASDOOR_CLIENT_SECRET || "",
    certificate: process.env.CASDOOR_CERTIFICATE || "",
    orgName: process.env.CASDOOR_ORG_NAME || "",
    appName: process.env.CASDOOR_APP_NAME || "",
}

// Create and export the SDK instance
export const casdoorSDK = new SDK(casdoorConfig)

// Helper function to parse JWT token
export function parseJwtToken(token: string): { payload: { exp: number; [key: string]: any } } {
    try {
        const decoded = casdoorSDK.parseJwtToken(token) as unknown as { exp: number; [key: string]: any };
        return { payload: decoded }; // 确保返回的对象包含 payload
    } catch (error) {
        console.error("Error parsing JWT token:", error);
        throw error;
    }
}

// Helper function to get auth token
export async function getAuthToken(code: string) {
    try {
        return await casdoorSDK.getAuthToken(code)
    } catch (error) {
        console.error("Error getting auth token:", error)
        throw error
    }
}

// Helper function to get user info
export async function getUserInfo(token: string) {
    try {
        // First get basic info from token
        const tokenInfo = parseJwtToken(token)

        // You can also make additional API calls to get more user info if needed
        return tokenInfo
    } catch (error) {
        console.error("Error getting user info:", error)
        throw error
    }
}

