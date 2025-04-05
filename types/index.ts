// Define DecodedToken interface compatible with casdoor-nodejs-sdk
export interface DecodedToken {
    header: {
        alg: string
        kid: string
        typ: string
    }
    payload: {
        [key: string]: any
        sub?: string
        name?: string
        email?: string
        preferred_username?: string
        owner?: string
        role?: string
        isAdmin?: boolean
        groups?: string[]
        permissions?: string[]
        exp: number
        iat?: number
    }
    signature: string
}

// Define API response structure
export interface ApiResponse<T = any> {
    success: boolean
    message?: string
    data?: T
    error?: string
}
