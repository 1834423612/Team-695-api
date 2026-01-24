import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { error } from '../utils/responses';

export const verifyTbaWebhook = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Add debug logs
        console.log('Received TBA webhook request:');
        console.log('Headers:', JSON.stringify(req.headers));
        console.log('Body:', JSON.stringify(req.body));

        // Optionally skip HMAC verification in development environment
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_TBA_HMAC_VERIFY === 'true') {
            console.log('Skipping HMAC verification in development mode');
            return next();
        }

        // Get HMAC header
        const hmacHeader = req.headers['x-tba-hmac'];
        
        if (!hmacHeader) {
            console.log('Missing X-TBA-HMAC header, continuing anyway in development mode');
            if (process.env.NODE_ENV === 'development') {
                return next();
            }
            return error(res, 401, 'Missing X-TBA-HMAC header');
        }

        // Get webhook secret
        const webhookSecret = process.env.TBA_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('TBA_WEBHOOK_SECRET is not defined in environment variables');
            return error(res, 500, 'Server configuration error');
        }

        // Calculate signature using correct HMAC algorithm
        if (req.rawBody) {
            console.log('Using rawBody for HMAC calculation');
            const hmac = crypto.createHmac('sha256', webhookSecret);
            hmac.update(req.rawBody);
            const calculatedHmac = hmac.digest('hex');
            
            console.log('HMAC Verification:');
            console.log('Received HMAC:', hmacHeader);
            console.log('Calculated HMAC:', calculatedHmac);
            
            // Continue even if verification fails in development environment
            if (calculatedHmac !== hmacHeader && process.env.NODE_ENV !== 'development') {
                return error(res, 401, 'Invalid X-TBA-HMAC signature');
            }
        } else {
            console.log('No rawBody available, skipping HMAC verification');
        }

        next();
    } catch (err) {
        console.error('Error verifying webhook signature:', err);
        return error(res, 500, 'Error verifying webhook signature', err);
    }
};

// Create a middleware that doesn't verify HMAC, for testing
export const skipTbaWebhookVerify = (req: Request, res: Response, next: NextFunction) => {
    console.log('Skipping HMAC verification for TBA webhook');
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body:', JSON.stringify(req.body));
    next();
};
