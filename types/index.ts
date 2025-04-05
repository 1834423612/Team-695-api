// 修改DecodedToken接口使其与casdoor-nodejs-sdk兼容
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
        iat?: number // 将iat设为可选属性，兼容casdoor-nodejs-sdk
    }
    signature: string
}
