import express from 'express';
import pool from '../config/database';
const router = express.Router();

interface Tab {
    formId: string;
    formData: any;
}

interface ImageData {
    url: string;
    name: string;
    size: number;
}

interface Images {
    fullRobotImages: ImageData[];
    driveTrainImages: ImageData[];
}

router.post('/submit', async (req, res) => {
    const { eventId, tabs, images }: { eventId: string; tabs: Tab[]; images: Images } = req.body;

    try {
        for (const tab of tabs) {
            const formData = tab.formData.reduce((acc: any, field: any) => {
                acc[field.question] = field.value;
                return acc;
            }, {});

            // 确保 images 数据存在
            const tabImages = images || { fullRobotImages: [], driveTrainImages: [] };

            // 添加日志检查图像数据
            console.log('Form Data:', formData);
            console.log('Images:', tabImages);

            await pool.query(
                'INSERT INTO survey_responses (event_id, form_id, data, upload, timestamp) VALUES (?, ?, ?, ?, NOW())',
                [eventId, tab.formId, JSON.stringify(formData), JSON.stringify(tabImages)]
            );
        }

        res.status(200).json({ message: 'Survey submitted successfully' });
    } catch (error) {
        console.error('Error submitting survey:', error);
        res.status(500).json({ error: 'Failed to submit survey' });
    }
});

export default router;
