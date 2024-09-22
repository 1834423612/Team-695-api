import { Request, Response } from 'express';
import db from '../config/database';
import { Feedback } from '../models/feedback';
import { sendEmail } from '../services/emailService';
import rateLimiter from '../middleware/rateLimiter';

export const submitFeedback = (req: Request, res: Response) => {
    const feedback: Feedback = req.body;

    // 将 deviceInfo 转换为 JSON 字符串
    const deviceInfo = JSON.stringify(feedback.deviceInfo);

    // 插入数据到数据库
    const sql = 'INSERT INTO feedback SET ?';
    db.query(sql, { ...feedback, deviceInfo }, (err, result) => {
        if (err) {
            console.error('Error inserting into the database:', err); // 打印详细ERROR信息
            return res.status(500).json({ message: 'Database insertion error' });
        }

        // 发送邮件
        sendEmail({ ...feedback, deviceInfo: JSON.parse(deviceInfo) })
            .then(() => res.status(201).json({ message: 'Feedback submitted successfully' }))
            .catch((error) => res.status(500).json({ message: 'Failed to send email', error }));
    });
};
