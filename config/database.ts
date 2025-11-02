import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const pool = mysql.createPool({
    connectionLimit: 100, // Maximum number of connections
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306, // Default to 3306 if not specified
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Keep-alive mechanism to prevent idle connections from being closed
setInterval(async () => {
    const startTime = new Date();
    try {
        await pool.query('SELECT 1');
        const endTime = new Date();
        const executionTime = endTime.getTime() - startTime.getTime();
        console.log(`[${startTime.toISOString()}] Keep-alive query executed successfully in ${executionTime}ms`);
    } catch (err) {
        console.error(`[${startTime.toISOString()}] Keep-alive query failed:`, err);
    }
}, 3600000); // Execute once every hour

export default pool;
