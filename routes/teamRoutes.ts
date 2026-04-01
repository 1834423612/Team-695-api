import express from 'express';
import { mainPool as pool } from '../config/database';
import { getDatabaseClientMessage, getDatabaseHttpStatus } from '../utils/databaseError';

const router = express.Router();

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');
const isDigitsOnly = (value: string) => /^\d+$/.test(value);
const MIN_QUERY_LENGTH = 2;

router.get('/teams', async (req, res) => {
    try {
        const { query: searchQuery, limit, limits, teamNumber, teamName } = req.query;

        const conditions: string[] = [];
        const whereParams: Array<string | number> = [];
        const orderParams: Array<string | number> = [];
        const orderByClauses: string[] = [];

        const queryText = String(searchQuery ?? '').trim();
        if (queryText.length > 0) {
            if (queryText.length < MIN_QUERY_LENGTH && !teamNumber && !teamName) {
                res.json([]);
                return;
            }

            const escapedQuery = escapeLike(queryText);
            const numericQuery = isDigitsOnly(queryText);

            if (numericQuery) {
                conditions.push("team_number LIKE ? ESCAPE '\\\\'");
                whereParams.push(`${escapedQuery}%`);

                orderByClauses.push('CASE WHEN team_number = ? THEN 0 ELSE 1 END');
                orderParams.push(queryText);

                orderByClauses.push('CHAR_LENGTH(team_number) ASC');
                orderByClauses.push('CAST(team_number AS UNSIGNED) ASC');
            } else {
                conditions.push("(team_name LIKE ? ESCAPE '\\\\' OR team_number LIKE ? ESCAPE '\\\\')");
                whereParams.push(`${escapedQuery}%`, `${escapedQuery}%`);

                orderByClauses.push('CASE WHEN team_name LIKE ? ESCAPE \'\\\\\' THEN 0 WHEN team_number LIKE ? ESCAPE \'\\\\\' THEN 1 ELSE 2 END');
                orderParams.push(`${escapedQuery}%`, `${escapedQuery}%`);

                orderByClauses.push('CHAR_LENGTH(team_name) ASC');
                orderByClauses.push('team_name ASC');
                orderByClauses.push('CHAR_LENGTH(team_number) ASC');
                orderByClauses.push('CAST(team_number AS UNSIGNED) ASC');
            }
        }

        if (teamNumber) {
            conditions.push('team_number = ?');
            whereParams.push(String(teamNumber));

            orderByClauses.push('CASE WHEN team_number = ? THEN 0 ELSE 1 END');
            orderParams.push(String(teamNumber));
        }

        if (teamName) {
            const normalizedTeamName = String(teamName).trim();
            if (normalizedTeamName.length > 0) {
                const escapedName = escapeLike(normalizedTeamName);
                conditions.push("team_name LIKE ? ESCAPE '\\\\'");
                whereParams.push(`${escapedName}%`);

                orderByClauses.push('CASE WHEN team_name = ? THEN 0 ELSE 1 END');
                orderParams.push(normalizedTeamName);
                orderByClauses.push('CHAR_LENGTH(team_name) ASC');
                orderByClauses.push('team_name ASC');
            }
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

        if (orderByClauses.length > 0) {
            sql += ` ORDER BY ${orderByClauses.join(', ')}, team_number ASC`;
        } else {
            sql += ' ORDER BY CAST(team_number AS UNSIGNED) ASC, team_number ASC';
        }

        if (safeLimit !== undefined) {
            sql += ' LIMIT ?';
        }

        const params = [...whereParams, ...orderParams];
        if (safeLimit !== undefined) {
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
