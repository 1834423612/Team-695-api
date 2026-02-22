import express from 'express';
import { mainPool as pool } from '../config/database';
import { getDatabaseClientMessage, getDatabaseHttpStatus } from '../utils/databaseError';

const router = express.Router();

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

router.get('/teams', async (req, res) => {
    try {
        const { query: searchQuery, limit, limits, teamNumber, teamName } = req.query;

        const conditions: string[] = [];
        const params: Array<string | number> = [];

        const queryText = String(searchQuery ?? '').trim();
        if (queryText.length > 0) {
            const escapedQuery = escapeLike(queryText);
            conditions.push("team_number LIKE ? ESCAPE '\\\\'");
            params.push(`${escapedQuery}%`);
        }

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
        const rawLimit = limit ?? limits;
        const limitNumber = Number.parseInt(String(rawLimit ?? ''), 10);
        const safeLimit = Number.isFinite(limitNumber) && limitNumber > 0
            ? Math.min(limitNumber, maxLimit)
            : undefined;

        let sql = 'SELECT team_number, team_name FROM teams';
        if (conditions.length) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY team_number ASC';
        if (safeLimit !== undefined) {
            sql += ' LIMIT ?';
            params.push(safeLimit);
        }

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching teams:', error);
        const statusCode = getDatabaseHttpStatus(error);
        res.status(statusCode).json({ error: getDatabaseClientMessage('Failed to fetch teams', error) });
    }
});

export default router;
