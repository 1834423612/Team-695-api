import { Request, Response } from 'express';
import db from '../config/database';
import { Feedback } from '../models/feedback';
import { sendEmail } from '../services/emailService';
import rateLimiter from '../middleware/rateLimiter';

export const submitFeedback = (req: Request, res: Response) => {
    const feedback: Feedback = req.body;

    // 插入数据到数据库
    const sql = 'INSERT INTO feedback SET ?';
    db.query(sql, feedback, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database insertion error' });
        }

        // 发送邮件
        sendEmail(feedback)
            .then(() => res.status(201).json({ message: 'Feedback submitted successfully' }))
            .catch((error) => res.status(500).json({ message: 'Failed to send email', error }));
    });
};
