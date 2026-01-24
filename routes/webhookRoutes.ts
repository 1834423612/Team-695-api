import { Router, Request, Response } from "express";
import { success, error } from "../utils/responses";
import { verifyTbaWebhook, skipTbaWebhookVerify } from "../middlewares/webhookAuth";

const router = Router();

// Routes with verification
router.post("/tba", verifyTbaWebhook, async (req: Request, res: Response) => {
    try {
        const { message_type, message_data } = req.body;
        console.log(`Processed TBA webhook: ${message_type}`, message_data);

        // Handle different types of notifications
        switch (message_type) {
            case 'ping':
                // Log ping notification
                console.log('Successfully received TBA ping notification:', message_data);
                return success(res, { received: true }, `Received ping notification: ${message_data.title}`);

            case 'verification':
                // Store verification key
                const { verification_key } = message_data;
                console.log('Successfully received TBA verification key:', verification_key);

                // TODO: Store verification key in database to allow users to verify webhook in admin interface

                return success(res, { received: true, verification_key }, 'Verification key received');

            default:
                console.log(`Received unknown TBA notification type: ${message_type}`, message_data);
                return success(res, { received: true }, `Unknown notification type: ${message_type}`);
        }
    } catch (err) {
        console.error('Error processing TBA webhook:', err);
        return error(res, 500, 'Error processing webhook', err);
    }
});

// Test route - no verification, for development testing
router.post("/tba-dev", skipTbaWebhookVerify, async (req: Request, res: Response) => {
    try {
        console.log('Received test webhook on /tba-dev endpoint');
        console.log('Body:', req.body);
        return success(res, { received: true }, 'Test webhook received');
    } catch (err) {
        console.error('Error processing test webhook:', err);
        return error(res, 500, 'Error processing webhook', err);
    }
});

/**
 * Get TBA webhook verification status
 */
router.get("/tba/status", (req: Request, res: Response) => {
    try {
        // TODO: Fetch webhook status from database

        // Temporarily return mock data
        return success(res, {
            verified: false,
            lastPing: new Date().toISOString(),
            status: 'pending',
            debug: {
                webhookSecret: process.env.TBA_WEBHOOK_SECRET ?
                    `${process.env.TBA_WEBHOOK_SECRET.substring(0, 4)}...` :
                    'not set'
            }
        });
    } catch (err) {
        console.error('Error getting webhook status:', err);
        return error(res, 500, 'Error getting webhook status', err);
    }
});

export default router;
