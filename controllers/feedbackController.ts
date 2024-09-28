import { Request, Response } from 'express';
import db from '../config/database';
import { Feedback } from '../models/feedback';
import { sendEmail } from '../services/emailService';

export const submitFeedback = async (req: Request, res: Response) => {
    const feedback: Feedback = req.body;

    // 将 deviceInfo 转换为 JSON 字符串
    const deviceInfo = JSON.stringify(feedback.deviceInfo);

    // 插入数据到数据库
    const sql = 'INSERT INTO feedback SET ?';
    try {
        const [result] = await db.query(sql, { ...feedback, deviceInfo });
        
        // 添加发送邮件任务到后台
        setImmediate(() => {
            sendEmail({ ...feedback, deviceInfo: JSON.parse(deviceInfo) })
                .then(() => console.log('Email sent successfully'))
                .catch((error) => console.error('Failed to send email', error));
        });

        res.status(201).json({ message: 'Feedback submitted successfully' });
    } catch (err) {
        console.error('Error inserting into the database:', err); // 打印详细ERROR信息
        res.status(500).json({ message: 'Database insertion error' });
    }
};
