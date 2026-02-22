import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const scoutifyPool = mysql.createPool({
    connectionLimit: Number(process.env.SCOUTIFY_DB_CONNECTION_LIMIT) || 50,
    host: process.env.SCOUTIFY_DB_HOST,
    port: Number(process.env.SCOUTIFY_DB_PORT) || 3306,
    user: process.env.SCOUTIFY_DB_USER,
    password: process.env.SCOUTIFY_DB_PASSWORD,
    database: process.env.SCOUTIFY_DB_NAME,
});

console.log(`[DB:SCOUTIFY] Pool initialized -> ${process.env.SCOUTIFY_DB_USER ?? 'unknown'}@${process.env.SCOUTIFY_DB_HOST ?? 'unknown'}:${Number(process.env.SCOUTIFY_DB_PORT) || 3306}/${process.env.SCOUTIFY_DB_NAME ?? 'unknown'}`);

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
