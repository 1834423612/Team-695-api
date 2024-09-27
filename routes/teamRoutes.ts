import express from 'express';
import pool from '../config/database';
const router = express.Router();

router.get('/teams', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT team_number, team_name FROM teams');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

export default router;
