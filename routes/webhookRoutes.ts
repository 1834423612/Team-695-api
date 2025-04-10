import { Router, Request, Response } from "express";
import { success, error } from "../utils/responses";
import { verifyTbaWebhook, skipTbaWebhookVerify } from "../middlewares/webhookAuth";

const router = Router();

// 使用验证的路由
router.post("/tba", verifyTbaWebhook, async (req: Request, res: Response) => {
    try {
        const { message_type, message_data } = req.body;
        console.log(`Processed TBA webhook: ${message_type}`, message_data);

        // 处理不同类型的通知
        switch (message_type) {
            case 'ping':
                // 记录ping通知
                console.log('Successfully received TBA ping notification:', message_data);
                return success(res, { received: true }, `Received ping notification: ${message_data.title}`);

            case 'verification':
                // 存储验证密钥
                const { verification_key } = message_data;
                console.log('Successfully received TBA verification key:', verification_key);

                // TODO: 在这里将验证密钥存储到数据库中，以便用户在管理界面验证webhook

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

// 测试用路由 - 不进行验证，用于开发测试
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
 * 获取TBA webhook验证状态
 */
router.get("/tba/status", (req: Request, res: Response) => {
    try {
        // TODO: 从数据库获取webhook状态

        // 暂时返回模拟数据
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
