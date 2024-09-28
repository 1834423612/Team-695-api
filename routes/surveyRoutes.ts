import express from 'express';
import pool from '../config/database';
const router = express.Router();

interface Tab {
    formId: string;
    formData: any;
    images: {
        fullRobotImages: ImageData[];
        driveTrainImages: ImageData[];
    };
}

interface ImageData {
    url: string;
    name: string;
    size: number;
}

router.post('/submit', async (req, res) => {
    const { eventId, tabs }: { eventId: string; tabs: Tab[] } = req.body;

    try {
        for (const tab of tabs) {
            const formData = tab.formData.reduce((acc: any, field: any) => {
                acc[field.question] = field.value;
                return acc;
            }, {});

            await pool.query(
                'INSERT INTO survey_responses (event_id, form_id, data, upload, timestamp) VALUES (?, ?, ?, ?, NOW())',
                [eventId, tab.formId, JSON.stringify(formData), JSON.stringify(tab.images)]
            );
        }

        res.status(200).json({ message: 'Survey submitted successfully' });
    } catch (error) {
        console.error('Error submitting survey:', error);
        res.status(500).json({ error: 'Failed to submit survey' });
    }
});

export default router;
