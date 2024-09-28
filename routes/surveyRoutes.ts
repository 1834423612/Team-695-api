import express from 'express';
import pool from '../config/database';
const router = express.Router();

interface Tab {
    formId: string;
    formData: any;
}

router.post('/submit', async (req, res) => {
    const { eventId, tabs }: { eventId: string; tabs: Tab[] } = req.body;

    try {
        const formData = tabs.map((tab: Tab) => ({
            formId: tab.formId,
            formData: tab.formData
        }));

        await pool.query(
            'INSERT INTO survey_responses (event_id, form_id, data, timestamp) VALUES (?, ?, ?, NOW())',
            [eventId, formData[0].formId, JSON.stringify(formData)]
        );

        res.status(200).json({ message: 'Survey submitted successfully' });
    } catch (error) {
        console.error('Error submitting survey:', error);
        res.status(500).json({ error: 'Failed to submit survey' });
    }
});

export default router;
