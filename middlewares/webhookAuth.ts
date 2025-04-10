import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { error } from '../utils/responses';

export const verifyTbaWebhook = (req: Request, res: Response, next: NextFunction) => {
    try {
        // 添加调试日志
        console.log('Received TBA webhook request:');
        console.log('Headers:', JSON.stringify(req.headers));
        console.log('Body:', JSON.stringify(req.body));

        // 开发环境下可选择跳过HMAC验证
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_TBA_HMAC_VERIFY === 'true') {
            console.log('Skipping HMAC verification in development mode');
            return next();
        }

        // 获取HMAC头
        const hmacHeader = req.headers['x-tba-hmac'];
        
        if (!hmacHeader) {
            console.log('Missing X-TBA-HMAC header, continuing anyway in development mode');
            if (process.env.NODE_ENV === 'development') {
                return next();
            }
            return error(res, 401, 'Missing X-TBA-HMAC header');
        }

        // 获取webhook密钥
        const webhookSecret = process.env.TBA_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('TBA_WEBHOOK_SECRET is not defined in environment variables');
            return error(res, 500, 'Server configuration error');
        }

        // 使用正确的HMAC算法计算签名
        if (req.rawBody) {
            console.log('Using rawBody for HMAC calculation');
            const hmac = crypto.createHmac('sha256', webhookSecret);
            hmac.update(req.rawBody);
            const calculatedHmac = hmac.digest('hex');
            
            console.log('HMAC Verification:');
            console.log('Received HMAC:', hmacHeader);
            console.log('Calculated HMAC:', calculatedHmac);
            
            // 在开发环境中，即使验证失败也继续
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

// 创建一个不验证HMAC的中间件，用于测试
export const skipTbaWebhookVerify = (req: Request, res: Response, next: NextFunction) => {
    console.log('Skipping HMAC verification for TBA webhook');
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body:', JSON.stringify(req.body));
    next();
};
