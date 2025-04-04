import { Request, Response } from 'express';
import authService from '../services/authService';

class AuthController {
    /**
     * Handle Casdoor callback
     * @route POST /api/auth/callback
     */
    async handleCallback(req: Request, res: Response) {
        try {
            const { code } = req.body;

            if (!code) {
                return res.status(400).json({ error: 'Authorization code is required' });
            }

            const token = await authService.getAuthToken(code);

            return res.json({ token });
        } catch (error) {
            console.error('Callback error:', error);
            return res.status(500).json({ error: 'Failed to process authentication' });
        }
    }

    /**
     * Get user info from token
     * @route GET /api/auth/user
     */
    async getUserInfo(req: Request, res: Response) {
        try {
            // The authenticate middleware already attached user to the request
            if (!req.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            return res.json(req.user);
        } catch (error) {
            console.error('Get user info error:', error);
            return res.status(500).json({ error: 'Failed to get user info' });
        }
    }

    /**
     * Get all users (admin only)
     * @route GET /api/auth/users
     */
    async getAllUsers(req: Request, res: Response) {
        try {
            const users = await authService.getUsers();
            return res.json(users);
        } catch (error) {
            console.error('Get users error:', error);
            return res.status(500).json({ error: 'Failed to get users' });
        }
    }
}

export default new AuthController();
