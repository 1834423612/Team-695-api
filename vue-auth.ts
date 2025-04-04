import Sdk from 'casdoor-js-sdk';
import Cookies from 'js-cookie';

// Define the Casdoor configuration
const config = {
    serverUrl: 'https://sso.team695.com',
    clientId: '300932808273326bac0c',
    appName: '695_website',
    organizationName: 'Team695',
    redirectPath: '/callback',
    // Use sessionStorage for PKCE state
    storage: sessionStorage
};

// 检测环境
const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
const isVercel = window.location.hostname.includes('vercel.app');

// 针对 Vercel 预览环境的特殊处理
const COOKIE_OPTIONS = {
    // 在 Vercel 预览环境中，我们需要允许跨域 cookie
    secure: window.location.protocol === 'https:',
    // 在 Vercel 预览环境中使用 None，其他环境根据是否开发环境决定
    sameSite: isVercel ? 'none' as const : (isDevelopment ? 'lax' as const : 'strict' as const),
    expires: 7,  // 7 天过期
    path: '/',   // 全站可用
    // 在 Vercel 预览环境中，我们需要设置 domain
    ...(isVercel ? {} : {})
};

// 始终使用 localStorage 作为备份，特别是在 Vercel 预览环境中
const useLocalStorageBackup = true;

// Token storage names
const TOKEN_COOKIE = 'casdoor-token';
const REFRESH_TOKEN_COOKIE = 'casdoor-refresh-token';
const SESSION_ID_COOKIE = 'casdoor_session_id';

// Initialize the SDK
const sdk = new Sdk(config);

// Define user info interface
export interface UserInfo {
    id: string;
    name: string;
    displayName?: string;
    avatar?: string;
    email?: string;
    phone?: string;
    address?: string;
    affiliation?: string;
    tag?: string;
    score?: number;
    ranking?: number;
    isOnline?: boolean;
    isAdmin?: boolean;
    isForbidden?: boolean;
    signupApplication?: string;
    createdTime?: string;
    updatedTime?: string;
    type?: string;
    password?: string;
    passwordSalt?: string;
    github?: string;
    google?: string;
    qq?: string;
    wechat?: string;
    facebook?: string;
    dingtalk?: string;
    weibo?: string;
    gitee?: string;
    linkedin?: string;
    wecom?: string;
    lark?: string;
    gitlab?: string;
    adfs?: string;
    baidu?: string;
    alipay?: string;
    casdoor?: string;
    infoflow?: string;
    apple?: string;
    azuread?: string;
    slack?: string;
    steam?: string;
    bilibili?: string;
    okta?: string;
    douyin?: string;
    line?: string;
    amazon?: string;
    auth0?: string;
    battlenet?: string;
    bitbucket?: string;
    box?: string;
    cloudfoundry?: string;
    dailymotion?: string;
    deezer?: string;
    digitalocean?: string;
    discord?: string;
    dropbox?: string;
    eveonline?: string;
    fitbit?: string;
    gitea?: string;
    heroku?: string;
    influxcloud?: string;
    instagram?: string;
    intercom?: string;
    kakao?: string;
    lastfm?: string;
    mailru?: string;
    meetup?: string;
    microsoftonline?: string;
    naver?: string;
    nextcloud?: string;
    onedrive?: string;
    oura?: string;
    patreon?: string;
    paypal?: string;
    salesforce?: string;
    shopify?: string;
    soundcloud?: string;
    spotify?: string;
    strava?: string;
    stripe?: string;
    tiktok?: string;
    tumblr?: string;
    twitch?: string;
    twitter?: string;
    typetalk?: string;
    uber?: string;
    vk?: string;
    wepay?: string;
    xero?: string;
    yahoo?: string;
    yammer?: string;
    yandex?: string;
    zoom?: string;
    custom?: string;
    webauthnCredentials?: any[];
    recoveryCodesEnabled?: boolean;
    totpSecret?: string;
    properties?: Record<string, string>;
    roles?: string[];
    permissions?: string[];
    groups?: string[];
    owner?: string;
    data2?: {
        logo?: string;
        [key: string]: any;
    };
}

// Token response interface
interface TokenResponse {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope?: string;
}

// Create a service to handle authentication
class CasdoorService {
    private userInfoCache: UserInfo | null = null;
    private tokenExpiryTimer: number | null = null;
    config: any;
    getBasicUserInfoFromToken: any;

    constructor() {
        // 检查是否有备用存储的令牌
        this.checkLocalStorageBackup();
        
        // 在初始化时检查令牌状态
        this.setupTokenRefresh();
    }

    // 设置令牌自动刷新
    private setupTokenRefresh(): void {
        // 清除任何现有的计时器
        if (this.tokenExpiryTimer !== null) {
            window.clearTimeout(this.tokenExpiryTimer);
            this.tokenExpiryTimer = null;
        }

        // 获取当前令牌
        const token = this.getToken();
        if (!token) return;

        try {
            // 解析令牌以获取过期时间
            const tokenInfo = this.parseAccessToken(token);
            if (!tokenInfo || !tokenInfo.payload || !tokenInfo.payload.exp) return;

            // 计算过期时间（毫秒）
            const expiryTime = tokenInfo.payload.exp * 1000;
            const now = Date.now();
            const timeToExpiry = expiryTime - now;

            // 如果令牌已过期，立即尝试刷新
            if (timeToExpiry <= 0) {
                this.refreshAccessToken().catch(err => {
                    console.error('Failed to refresh expired token:', err);
                    // 如果刷新失败，可能需要重新登录
                });
                return;
            }

            // 设置在令牌过期前 5 分钟刷新
            const refreshTime = Math.max(timeToExpiry - 5 * 60 * 1000, 0);
            this.tokenExpiryTimer = window.setTimeout(() => {
                this.refreshAccessToken().catch(err => {
                    console.error('Failed to refresh token:', err);
                });
            }, refreshTime);

        } catch (error) {
            console.error('Error setting up token refresh:', error);
        }
    }

    // 检查 localStorage 中是否有备用令牌
    private checkLocalStorageBackup(): void {
        try {
            if (!useLocalStorageBackup) {
                console.log('LocalStorage backup is disabled.');
                return;
            }
    
            const accessToken = localStorage.getItem(TOKEN_COOKIE);
            if (accessToken) {
                console.log('Found backup token in localStorage, attempting to restore');
                // 尝试将 localStorage 中的令牌恢复到 cookie
                Cookies.set(TOKEN_COOKIE, accessToken, COOKIE_OPTIONS);
                
                const refreshToken = localStorage.getItem(REFRESH_TOKEN_COOKIE);
                if (refreshToken) {
                    Cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
                }
                
                // 检查是否成功设置了 cookie
                if (!Cookies.get(TOKEN_COOKIE)) {
                    console.warn('Failed to restore token to cookie, will continue using localStorage');
                } else {
                    console.log('Successfully restored token from localStorage to cookie');
                }
            }
        } catch (error) {
            console.error('Error checking localStorage backup:', error);
        }
    }

    // Start the PKCE authorization flow
    startLogin(provider?: string): void {
        // Additional parameters for the authorization URL
        const additionalParams: Record<string, string> = {};

        // If a specific provider is requested (e.g., Google)
        if (provider) {
            additionalParams.provider = provider;
        }

        // Redirect to the authorization URL
        sdk.signin_redirect(additionalParams);
    }

    // Get the sign-in URL (for compatibility with existing code)
    getSigninUrl(provider?: string): string {
        // This is just for compatibility, we'll use startLogin instead
        return sdk.getSigninUrl() + (provider ? `&provider=${provider}` : '');
    }

    // Handle the callback from Casdoor
    async signin(): Promise<string> {
        try {
            // Exchange the authorization code for an access token using PKCE
            const tokenResponse = await sdk.exchangeForAccessToken();
            console.log('Token response received:', !!tokenResponse);

            if (!tokenResponse || !tokenResponse.access_token) {
                throw new Error('Failed to exchange code for token');
            }

            // 直接存储到 localStorage 作为主要存储
            localStorage.setItem(TOKEN_COOKIE, tokenResponse.access_token);
            if (tokenResponse.refresh_token) {
                localStorage.setItem(REFRESH_TOKEN_COOKIE, tokenResponse.refresh_token);
            }
            
            // 尝试同时存储到 cookie 作为备份
            try {
                Cookies.set(TOKEN_COOKIE, tokenResponse.access_token, COOKIE_OPTIONS);
                if (tokenResponse.refresh_token) {
                    Cookies.set(REFRESH_TOKEN_COOKIE, tokenResponse.refresh_token, COOKIE_OPTIONS);
                }
            } catch (cookieError) {
                console.warn('Failed to set cookies, but tokens are stored in localStorage:', cookieError);
            }

            // 设置令牌刷新计时器
            this.setupTokenRefresh();

            return tokenResponse.access_token;
        } catch (error) {
            console.error('Signin error:', error);
            throw error;
        }
    }

    // Helper method to store tokens in cookies and localStorage
    private storeTokensInCookies(tokenResponse: TokenResponse): void {
        console.log('Storing tokens...');
        
        // 首先存储到 localStorage（更可靠）
        if (tokenResponse.access_token) {
            localStorage.setItem(TOKEN_COOKIE, tokenResponse.access_token);
        }
        
        if (tokenResponse.refresh_token) {
            localStorage.setItem(REFRESH_TOKEN_COOKIE, tokenResponse.refresh_token);
        }
        
        // 然后尝试存储到 cookie
        try {
            if (tokenResponse.access_token) {
                Cookies.set(TOKEN_COOKIE, tokenResponse.access_token, COOKIE_OPTIONS);
            }
            
            if (tokenResponse.refresh_token) {
                Cookies.set(REFRESH_TOKEN_COOKIE, tokenResponse.refresh_token, COOKIE_OPTIONS);
            }
            
            // 检查 cookie 是否设置成功
            const cookieToken = Cookies.get(TOKEN_COOKIE);
            console.log('Cookie token set success:', !!cookieToken);
        } catch (error) {
            console.warn('Error setting cookies, but tokens are stored in localStorage:', error);
        }
        
        // 设置令牌刷新计时器
        this.setupTokenRefresh();
    }

    // Manually set tokens (useful for testing or when tokens are received from other sources)
    setTokens(accessToken: string, refreshToken?: string): void {
        // 首先存储到 localStorage
        localStorage.setItem(TOKEN_COOKIE, accessToken);
        if (refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_COOKIE, refreshToken);
        }
        
        // 然后尝试存储到 cookie
        try {
            Cookies.set(TOKEN_COOKIE, accessToken, COOKIE_OPTIONS);
            if (refreshToken) {
                Cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
            }
        } catch (error) {
            console.warn('Error setting cookies, but tokens are stored in localStorage:', error);
        }
        
        // 设置令牌刷新计时器
        this.setupTokenRefresh();
    }

    // Refresh the access token
    async refreshAccessToken(): Promise<string> {
        // 先尝试从 localStorage 获取刷新令牌（更可靠）
        let refreshToken = localStorage.getItem(REFRESH_TOKEN_COOKIE);
        
        // 如果 localStorage 中没有，则尝试从 cookie 获取
        if (!refreshToken) {
            refreshToken = Cookies.get(REFRESH_TOKEN_COOKIE) || null;
        }
        
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const tokenResponse = await sdk.refreshAccessToken(refreshToken);

            if (!tokenResponse || !tokenResponse.access_token) {
                throw new Error('Failed to refresh token');
            }

            // Update the tokens
            this.storeTokensInCookies(tokenResponse);

            return tokenResponse.access_token;
        } catch (error) {
            console.error('Token refresh error:', error);
            // If refresh fails, clear tokens and force re-login
            this.logout();
            throw error;
        }
    }

    // Check if the user is logged in
    isLoggedIn(): boolean {
        // 首先检查 localStorage（更可靠）
        const localToken = localStorage.getItem(TOKEN_COOKIE);
        if (localToken) {
            return true;
        }
        
        // 然后检查 cookie
        const cookieToken = Cookies.get(TOKEN_COOKIE);
        return !!cookieToken;
    }

    // Get the token
    getToken(): string | null {
        // 首先从 localStorage 获取（更可靠）
        const localToken = localStorage.getItem(TOKEN_COOKIE);
        if (localToken) {
            return localToken;
        }
        
        // 然后尝试从 cookie 获取
        return Cookies.get(TOKEN_COOKIE) || null;
    }

    // Parse JWT token to get user info
    parseAccessToken(token: string): { header: any, payload: any } | null {
        try {
            return sdk.parseAccessToken(token);
        } catch (e) {
            console.error('Error parsing JWT:', e);
            return null;
        }
    }

    // Get user information with retry mechanism
    async getUserInfo(forceRefresh = false): Promise<UserInfo> {
        const token = this.getToken();
        
        if (!token) {
            throw new Error('Not authenticated');
        }

        // If we have cached user info and don't need to refresh, return it
        if (this.userInfoCache && !forceRefresh) {
            return this.userInfoCache;
        }

        try {
            // Use the SDK to get user info
            const response = await sdk.getUserInfo(token);

            // Check if response is a Response object
            if (response instanceof Response) {
                if (!response.ok) {
                    throw new Error(`Failed to get user info: ${response.statusText}`);
                }

                // Parse the response JSON
                const userInfo: UserInfo = await response.json();

                // Cache the user info
                this.userInfoCache = userInfo;

                return userInfo;
            } else {
                // If it's already a UserInfo object (in case SDK implementation changes)
                this.userInfoCache = response as unknown as UserInfo;
                return this.userInfoCache;
            }
        } catch (error) {
            console.error('Get user info error:', error);

            // Try to get user info directly from Casdoor API
            try {
                const userInfoUrl = `${config.serverUrl}/api/get-account`;
                const response = await fetch(userInfoUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error(`Failed to get user info: ${response.statusText}`);
                }

                const userInfo: UserInfo = await response.json();
                this.userInfoCache = userInfo;
                return userInfo;
            } catch (secondError) {
                console.error('Second attempt to get user info failed:', secondError);

                // If we can't get detailed info, try to get basic info from token
                if (token) {
                    const tokenInfo = this.parseAccessToken(token);
                    if (tokenInfo && tokenInfo.payload) {
                        const payload = tokenInfo.payload;
                        const basicUserInfo: UserInfo = {
                            id: payload.sub || '',
                            name: payload.name || '',
                            email: payload.email || '',
                            owner: payload.owner || '',
                            displayName: payload.preferred_username || payload.name || '',
                        };
                        return basicUserInfo;
                    }
                }

                throw error;
            }
        }
    }

    // Check if the current user is an admin
    isUserAdmin(): boolean {
        try {
            const token = this.getToken();
            if (!token) return false;
            
            // Decode the JWT token to get user claims
            const tokenInfo = this.parseAccessToken(token);
            if (!tokenInfo || !tokenInfo.payload) return false;
            
            const payload = tokenInfo.payload;
            
            // Check for admin role in the token
            if (payload.role === 'admin' || payload.isAdmin === true) {
                return true;
            }
            
            // Check if user is in admin group or has admin permissions
            if (payload.groups && Array.isArray(payload.groups)) {
                return payload.groups.includes('admin');
            }
            
            // Check if user has admin permissions
            if (payload.permissions && Array.isArray(payload.permissions)) {
                return payload.permissions.some((p: string | string[]) => 
                    p.includes('admin') || p.includes('Admin') || p === '*'
                );
            }
            
            // If we have cached user info, check that too
            if (this.userInfoCache) {
                if (this.userInfoCache.isAdmin) return true;
                
                if (this.userInfoCache.roles && Array.isArray(this.userInfoCache.roles)) {
                    return this.userInfoCache.roles.some(r => 
                        r.includes('admin') || r.includes('Admin')
                    );
                }
                
                if (this.userInfoCache.groups && Array.isArray(this.userInfoCache.groups)) {
                    return this.userInfoCache.groups.includes('admin');
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }

    // Logout the user - enhanced version
    async logout(): Promise<void> {
        try {
            // 调用 Casdoor 的 /api/logout API
            const token = this.getToken();
            if (token) {
                await fetch(`${config.serverUrl}/api/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Error during server logout:', error);
        } finally {
            // 清除任何令牌刷新计时器
            if (this.tokenExpiryTimer !== null) {
                window.clearTimeout(this.tokenExpiryTimer);
                this.tokenExpiryTimer = null;
            }
            
            // 清除用户信息缓存
            this.userInfoCache = null;
    
            // 清除 localStorage 中的令牌
            localStorage.removeItem(TOKEN_COOKIE);
            localStorage.removeItem(REFRESH_TOKEN_COOKIE);
            
            // 尝试清除 cookie
            try {
                Cookies.remove(TOKEN_COOKIE, { path: '/' });
                Cookies.remove(REFRESH_TOKEN_COOKIE, { path: '/' });
                Cookies.remove(SESSION_ID_COOKIE, { path: '/' });
            } catch (error) {
                console.warn('Error removing cookies:', error);
            }
    
            // 清除 PKCE 状态
            sessionStorage.clear();
        }
    }
    
    // Handle token response directly (for cases where we get tokens from another source)
    handleTokenResponse(tokenResponse: TokenResponse): void {
        if (!tokenResponse || !tokenResponse.access_token) {
            throw new Error('Invalid token response');
        }
        
        this.storeTokensInCookies(tokenResponse);
    }
}

// Export a singleton instance
export const casdoorService = new CasdoorService();

// Export the SDK for direct access if needed
export { sdk };