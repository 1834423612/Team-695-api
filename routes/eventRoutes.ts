import express from 'express';
import pool from '../config/database';
const router = express.Router();

router.get('/event-id', async (req, res) => {
    try {
        const [rows]: any = await pool.query('SELECT event_id FROM events LIMIT 1');
        if (rows.length > 0) {
            res.json({ eventId: rows[0].event_id });
        } else {
            res.status(404).json({ error: 'Event not found' });
        }
    } catch (error) {
        console.error('Error fetching event ID:', error);
        res.status(500).json({ error: 'Failed to fetch event ID' });
    }
});

export default router;