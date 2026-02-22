import express from 'express';
import { mainPool as pool } from '../config/database';
import { getDatabaseClientMessage, getDatabaseHttpStatus } from '../utils/databaseError';
const router = express.Router();

router.get('/event-id', async (req, res) => {
    try {
        const [rows]: any = await pool.query(
            'SELECT event_id FROM events ORDER BY id DESC LIMIT 1'
        );

        if (rows.length > 0) {
            res.json({ eventId: rows[0].event_id });
        } else {
            res.status(404).json({ error: 'Event not found' });
        }
    } catch (error) {
        console.error('Error fetching event ID:', error);
        const statusCode = getDatabaseHttpStatus(error);
        res.status(statusCode).json({ error: getDatabaseClientMessage('Failed to fetch event ID', error) });
    }
});

export default router;
