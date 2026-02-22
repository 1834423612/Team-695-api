import express from 'express';
import { mainPool as pool } from '../config/database';
import { getDatabaseClientMessage, getDatabaseHttpStatus } from '../utils/databaseError';

const router = express.Router();

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

router.get('/teams', async (req, res) => {
    try {
        const { limit, teamNumber, teamName } = req.query;

        const conditions: string[] = [];
        const params: Array<string | number> = [];

        if (teamNumber) {
            conditions.push('team_number = ?');
            params.push(String(teamNumber));
        }

        if (teamName) {
            const escapedName = escapeLike(String(teamName).trim().toLowerCase());
            conditions.push("LOWER(team_name) LIKE ? ESCAPE '\\\\'");
            params.push(`%${escapedName}%`);
        }

        const maxLimit = 1000;
        const limitNumber = Number.parseInt(String(limit ?? ''), 10);
        const safeLimit = Number.isFinite(limitNumber) && limitNumber > 0
            ? Math.min(limitNumber, maxLimit)
            : undefined;

        let query = 'SELECT team_number, team_name FROM teams';
        if (conditions.length) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY team_number ASC';
        if (safeLimit !== undefined) {
            query += ' LIMIT ?';
            params.push(safeLimit);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching teams:', error);
        const statusCode = getDatabaseHttpStatus(error);
        res.status(statusCode).json({ error: getDatabaseClientMessage('Failed to fetch teams', error) });
    }
});

export default router;
