import express from 'express';
import { mainPool as pool } from '../config/database';
import { getDatabaseClientMessage, getDatabaseHttpStatus } from '../utils/databaseError';
const router = express.Router();

type EventRow = {
    event_id: string;
    event_name: string;
    event_date: string;
    created_at?: string | null;
    updated_at?: string | null;
};

const parseBooleanQuery = (value: unknown): boolean => {
    if (typeof value !== 'string') {
        return false;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const mapEvent = (row: EventRow) => ({
    eventId: row.event_id,
    eventName: row.event_name,
    eventDate: row.event_date,
    createdAt: row.created_at ?? row.updated_at ?? null,
    updatedAt: row.updated_at ?? null,
});

const getEventSelectSql = async (): Promise<string> => {
    const [createdAtColumnRows]: any = await pool.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'events'
           AND column_name = 'created_at'`
    );

    const hasCreatedAtColumn = Number(createdAtColumnRows?.[0]?.count ?? 0) > 0;

    if (hasCreatedAtColumn) {
        return 'SELECT event_id, event_name, event_date, created_at, updated_at FROM events';
    }

    return 'SELECT event_id, event_name, event_date, updated_at, updated_at AS created_at FROM events';
};

router.get('/event-id', async (req, res) => {
    try {
        const hasQueryParams = Object.keys(req.query).length > 0;
        const baseSelectSql = await getEventSelectSql();

        if (!hasQueryParams) {
            const [rows]: any = await pool.query(
                `${baseSelectSql} ORDER BY updated_at DESC, id DESC LIMIT 1`
            );

            if (rows.length > 0) {
                return res.json(mapEvent(rows[0]));
            }

            return res.status(404).json({ error: 'Event not found' });
        }

        const { all, eventId } = req.query;

        if (parseBooleanQuery(all)) {
            const [rows]: any = await pool.query(
                `${baseSelectSql} ORDER BY updated_at DESC, id DESC`
            );

            return res.json(rows.map(mapEvent));
        }

        if (eventId) {
            const [rows]: any = await pool.query(
                `${baseSelectSql} WHERE event_id = ? ORDER BY updated_at DESC, id DESC`,
                [String(eventId)]
            );

            if (rows.length > 0) {
                return res.json(rows.map(mapEvent));
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
        const baseSelectSql = await getEventSelectSql();
        const [rows]: any = await pool.query(
            `${baseSelectSql} ORDER BY updated_at DESC, id DESC`
        );

        res.json(rows.map(mapEvent));
    } catch (error) {
        console.error('Error fetching event IDs:', error);
        const statusCode = getDatabaseHttpStatus(error);
        res.status(statusCode).json({ error: getDatabaseClientMessage('Failed to fetch event IDs', error) });
    }
});

export default router;
