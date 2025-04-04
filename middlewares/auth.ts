import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';

// Extend Express Request interface to include user property
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

/**
 * Authentication middleware
 * Verifies the token and attaches user info to the request
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('Authorization header:', req.headers.authorization);

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization header missing' });
        }

        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Invalid authorization format. Use Bearer token' });
        }

        const token = authHeader.split(' ')[1];
        console.log('Extracted token:', token);

        const user = await authService.verifyToken(token);
        console.log('Verified user:', user);

        req.user = user;

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

/**
 * Role-based access control middleware
 * @param roles Array of allowed roles
 */
export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Check if user has any of the required roles
        const userRoles = req.user.roles || [];
        const hasRole = roles.some(role => userRoles.includes(role));

        if (!hasRole) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

/**
 * Admin access control middleware
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user is an admin
    const isAdmin = req.user.isAdmin ||
        (req.user.roles && req.user.roles.includes('admin'));

    if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
};
