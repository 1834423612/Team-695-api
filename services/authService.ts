import { SDK } from 'casdoor-nodejs-sdk';
import { casdoorConfig } from '../config/casdoor';

class AuthService {
    private sdk: SDK;

    constructor() {
        this.sdk = new SDK(casdoorConfig);
    }

    /**
     * Get auth token from callback code
     */
    async getAuthToken(code: string): Promise<string> {
        try {
            const { access_token } = await this.sdk.getAuthToken(code);
            return access_token;
        } catch (error) {
            console.error('Error getting auth token:', error);
            throw error;
        }
    }

    /**
     * Parse JWT token to get user info
     */
    parseJwtToken(token: string): any {
        try {
            return this.sdk.parseJwtToken(token);
        } catch (error) {
            console.error('Error parsing JWT token:', error);
            throw error;
        }
    }

    /**
     * Get user info by ID
     */
    async getUserById(userId: string): Promise<any> {
        try {
            const { data } = await this.sdk.getUser(userId);
            return data as unknown as any[];
        } catch (error) {
            console.error(`Error getting user by ID ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Get all users
     */
    async getUsers(): Promise<any[]> {
        try {
            const { data } = await this.sdk.getUsers();
            return data as unknown as any[];
        } catch (error) {
            console.error('Error getting users:', error);
            throw error;
        }
    }

    /**
     * Verify token and return user info
     */
    async verifyToken(token: string): Promise<any> {
        try {
            const userInfo = this.parseJwtToken(token);
    
            if (!userInfo) {
                throw new Error('Invalid token');
            }
    
            // 验证 iss 字段
            const validIssuers = ['https://sso.team695.com', 'https://www.team695.com'];
            if (!validIssuers.includes(userInfo.iss)) {
                throw new Error(`Invalid issuer: ${userInfo.iss}`);
            }
    
            // 验证 aud 字段
            if (!userInfo.aud || !userInfo.aud.includes(process.env.CASDOOR_CLIENT_ID)) {
                throw new Error(`Invalid audience: ${userInfo.aud}`);
            }
    
            // 验证 exp 字段
            const now = Math.floor(Date.now() / 1000);
            if (userInfo.exp && userInfo.exp < now) {
                throw new Error('Token has expired');
            }
    
            return userInfo;
        } catch (error) {
            console.error('Token verification failed:', error);
            throw new Error('Invalid token');
        }
    }
}

export default new AuthService();
