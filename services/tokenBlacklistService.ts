import { createClient } from 'redis';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Interface for token blacklist service
export interface TokenBlacklistInterface {
    addToBlacklist(token: string, expiryTime: number): Promise<void>;
    isBlacklisted(token: string): Promise<boolean>;
}

// In-memory implementation for development or when Redis is not available
class InMemoryTokenBlacklist implements TokenBlacklistInterface {
    private blacklistedTokens: Map<string, number> = new Map();

    constructor() {
        // Periodically clean up expired tokens
        setInterval(() => this.cleanupExpiredTokens(), 60 * 60 * 1000); // Every hour
    }

    async addToBlacklist(token: string, expiryTime: number): Promise<void> {
        // Store token hash instead of the full token for security
        const tokenHash = this.hashToken(token);
        this.blacklistedTokens.set(tokenHash, expiryTime);
        console.log(`Token added to blacklist, expires at: ${new Date(expiryTime * 1000).toISOString()}`);
    }

    async isBlacklisted(token: string): Promise<boolean> {
        const tokenHash = this.hashToken(token);
        const expiryTime = this.blacklistedTokens.get(tokenHash);

        if (!expiryTime) {
            return false;
        }

        // Check if token is still valid based on expiry time
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime > expiryTime) {
            // Token has expired, remove from blacklist
            this.blacklistedTokens.delete(tokenHash);
            return false;
        }

        return true;
    }

    private cleanupExpiredTokens(): void {
        const currentTime = Math.floor(Date.now() / 1000);

        for (const [tokenHash, expiryTime] of this.blacklistedTokens.entries()) {
            if (currentTime > expiryTime) {
                this.blacklistedTokens.delete(tokenHash);
            }
        }

        console.log(`Cleaned up expired tokens. Current blacklist size: ${this.blacklistedTokens.size}`);
    }

    private hashToken(token: string): string {
        // Use a proper crypto hash function
        return crypto.createHash('sha256').update(token).digest('hex');
    }
}

// Create a simple mock Redis client for environments without Redis
class MockRedisClient {
    private storage: Map<string, { value: string, expiry?: number }> = new Map();

    async connect(): Promise<void> {
        console.log('Mock Redis client connected');
        return Promise.resolve();
    }

    on(event: string, callback: Function): void {
        if (event === 'connect') {
            callback();
        }
    }

    async set(key: string, value: string, options?: { EX?: number }): Promise<string> {
        this.storage.set(key, {
            value,
            expiry: options?.EX ? Date.now() + options.EX * 1000 : undefined
        });
        return 'OK';
    }

    async exists(key: string): Promise<number> {
        const item = this.storage.get(key);
        if (!item) return 0;

        // Check if expired
        if (item.expiry && Date.now() > item.expiry) {
            this.storage.delete(key);
            return 0;
        }

        return 1;
    }
}

// Factory function to create the appropriate implementation
function createTokenBlacklist(): TokenBlacklistInterface {
    // Always use in-memory implementation for now to avoid Redis dependency
    // return new InMemoryTokenBlacklist();

    // The following code can be uncommented when Redis is properly set up
    // Use Redis in production, in-memory in development
    if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
        try {
            const client = createClient({ url: process.env.REDIS_URL });
            client.connect().catch(console.error);
            
            return {
                async addToBlacklist(token: string, expiryTime: number): Promise<void> {
                    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                    const currentTime = Math.floor(Date.now() / 1000);
                    const ttl = Math.max(0, expiryTime - currentTime);
                    await client.set(`blacklist:${tokenHash}`, '1', { EX: ttl });
                },
                
                async isBlacklisted(token: string): Promise<boolean> {
                    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                    const exists = await client.exists(`blacklist:${tokenHash}`);
                    return exists === 1;
                }
            };
        } catch (error) {
            console.error('Failed to initialize Redis blacklist:', error);
            console.log('Falling back to in-memory blacklist');
            return new InMemoryTokenBlacklist();
        }
    } else {
        return new InMemoryTokenBlacklist();
    }
}

// Export singleton instance
const tokenBlacklist = createTokenBlacklist();
export default tokenBlacklist;
