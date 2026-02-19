import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const scoutifyPool = mysql.createPool({
    connectionLimit: Number(process.env.SCOUTIFY_DB_CONNECTION_LIMIT) || 50,
    host: process.env.SCOUTIFY_DB_HOST || process.env.DB_HOST,
    port: Number(process.env.SCOUTIFY_DB_PORT || process.env.DB_PORT) || 3306,
    user: process.env.SCOUTIFY_DB_USER || process.env.DB_USER,
    password: process.env.SCOUTIFY_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.SCOUTIFY_DB_NAME,
});

setInterval(async () => {
    const startTime = new Date();
    try {
        await scoutifyPool.query('SELECT 1');
        const executionTime = Date.now() - startTime.getTime();
        console.log(`[${startTime.toISOString()}] Scoutify DB keep-alive query executed in ${executionTime}ms`);
    } catch (err) {
        console.error(`[${startTime.toISOString()}] Scoutify DB keep-alive query failed:`, err);
    }
}, 3600000);

export default scoutifyPool;
