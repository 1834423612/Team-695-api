import express from 'express';
import { mainPool as pool } from '../config/database';
import { getDatabaseClientMessage, getDatabaseHttpStatus } from '../utils/databaseError';
const router = express.Router();

const parseBooleanQuery = (value: unknown): boolean => {
    if (typeof value !== 'string') {
        return false;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

router.get('/event-id', async (req, res) => {
    try {
        const hasQueryParams = Object.keys(req.query).length > 0;

        if (!hasQueryParams) {
            const [rows]: any = await pool.query(
                'SELECT event_id FROM events ORDER BY id DESC LIMIT 1'
            );

            if (rows.length > 0) {
                return res.json({ eventId: rows[0].event_id });
            }

            return res.status(404).json({ error: 'Event not found' });
        }

        const { all, eventId } = req.query;

        if (parseBooleanQuery(all)) {
            const [rows]: any = await pool.query(
                'SELECT event_id FROM events ORDER BY id DESC'
            );

            return res.json(rows.map((row: { event_id: string }) => ({ eventId: row.event_id })));
        }

        if (eventId) {
            const [rows]: any = await pool.query(
                'SELECT event_id FROM events WHERE event_id = ? ORDER BY id DESC',
                [String(eventId)]
            );

            if (rows.length > 0) {
                return res.json(rows.map((row: { event_id: string }) => ({ eventId: row.event_id })));
            }

            return res.status(404).json({ error: 'Event not found' });
        }

        return res.status(400).json({
            error: 'Invalid query parameters. Supported: all=true or eventId=<value>'
        });
    } catch (error) {
        console.error('Error fetching event ID:', error);
        const statusCode = getDatabaseHttpStatus(error);
        res.status(statusCode).json({ error: getDatabaseClientMessage('Failed to fetch event ID', error) });
    }
});

router.get('/events', async (req, res) => {
    try {
        const [rows]: any = await pool.query(
            'SELECT event_id FROM events ORDER BY id DESC'
        );

        res.json(rows.map((row: { event_id: string }) => ({ eventId: row.event_id })));
    } catch (error) {
        console.error('Error fetching event IDs:', error);
        const statusCode = getDatabaseHttpStatus(error);
        res.status(statusCode).json({ error: getDatabaseClientMessage('Failed to fetch event IDs', error) });
    }
});

export default router;
