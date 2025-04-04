declare module "casdoor-nodejs-sdk" {
    export interface Config {
        endpoint: string
        clientId: string
        clientSecret: string
        certificate: string
        orgName: string
        appName?: string
    }

    export interface TokenResponse {
        access_token: string
        id_token?: string
        refresh_token?: string
        token_type: string
        expires_in: number
        scope?: string
    }

    export interface DecodedToken {
        header: any
        payload: {
            sub: string
            name?: string
            email?: string
            preferred_username?: string
            owner?: string
            role?: string
            isAdmin?: boolean
            groups?: string[]
            permissions?: string[]
            exp: number
            iat: number
            [key: string]: any
        }
    }

    export class SDK {
        constructor(config: Config, axiosConfig?: any)

        getAuthToken(code: string): Promise<TokenResponse>
        parseJwtToken(token: string): DecodedToken
        getUserInfo(token: string): Promise<any>
        refreshToken(refreshToken: string): Promise<TokenResponse>
    }
}

