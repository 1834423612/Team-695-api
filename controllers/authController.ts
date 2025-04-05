import type { Request, Response } from "express"
import authService from "../services/authService"

class AuthController {
    /**
     * Handle OAuth callback and exchange code for tokens
     */
    async handleCallback(req: Request, res: Response) {
        try {
            const code = req.query.code as string

            if (!code) {
                return res.status(400).json({ message: "Authorization code required" })
            }

            const tokenResponse = await authService.getAuthToken(code)
            return res.status(200).json(tokenResponse)
        } catch (error) {
            console.error("Callback error:", error)
            return res.status(500).json({ message: "Authentication failed" })
        }
    }

    /**
     * Get current user information
     */
    getCurrentUser(req: Request, res: Response) {
        try {
            console.log("getCurrentUser endpoint called")
            
            // First check if middleware has already set user information
            if (req.user) {
                console.log("User information found in request object")
                return res.status(200).json(req.user)
            }
            
            // Try to get token from different sources
            let token: string | undefined
            
            // Get from Authorization header
            const authHeader = req.headers.authorization
            if (authHeader) {
                console.log("Getting token from Authorization header", { header: authHeader })
                // Support tokens with or without Bearer prefix
                token = authHeader.startsWith("Bearer ") 
                    ? authHeader.slice(7) // Remove "Bearer " prefix
                    : authHeader
            }
            
            // Get from query parameters
            if (!token && req.query.token) {
                token = req.query.token as string
                console.log("Getting token from query parameters", { token: token?.slice(0, 10) + "..." })
            }
            
            // Get from request object
            if (!token && req.token) {
                token = req.token
                console.log("Getting token from request object", { token: token?.slice(0, 10) + "..." })
            }
            
            if (!token) {
                console.log("No token provided")
                return res.status(401).json({ 
                    message: "Unauthorized", 
                    details: "Please provide a valid JWT token" 
                })
            }
            
            // Try to parse the token
            try {
                console.log("Parsing token")
                const decodedToken = authService.parseJwtToken(token)
                
                // Validate token content
                if (!decodedToken || !decodedToken.payload) {
                    console.error("Token parsing succeeded but content is invalid")
                    return res.status(401).json({ message: "Invalid token", details: "Token content is invalid" })
                }
                
                // Log success information
                console.log("Token validation successful, user:", {
                    sub: decodedToken.payload.sub,
                    name: decodedToken.payload.name,
                    email: decodedToken.payload.email
                })
                
                // Set user information to request object for future use
                req.user = decodedToken.payload
                req.token = token
                req.decodedToken = decodedToken
                
                return res.status(200).json(decodedToken.payload)
            } catch (tokenError) {
                console.error("Token validation failed:", tokenError)
                return res.status(401).json({ 
                    message: "Invalid token", 
                    details: (tokenError as Error).message 
                })
            }
        } catch (error) {
            console.error("Error handling request:", error)
            return res.status(500).json({ 
                message: "Failed to get user information", 
                details: (error as Error).message
            })
        }
    }

    /**
     * Get user information from token
     */
    getUserInfoFromToken(req: Request, res: Response) {
        try {
            const token = req.query.token as string

            if (!token) {
                return res.status(400).json({ message: "Token required" })
            }

            const userInfo = authService.parseJwtToken(token)
            return res.status(200).json(userInfo)
        } catch (error) {
            console.error("Error getting user info:", error)
            return res.status(500).json({ message: "Failed to get user information" })
        }
    }

    /**
     * Validate token
     */
    validateToken(req: Request, res: Response) {
        // If we passed the verifyToken middleware, the token is valid
        return res.status(200).json({ valid: true })
    }
}

export default new AuthController()
