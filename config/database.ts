import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const dbHost = process.env.DB_HOST;
const dbPort = Number(process.env.DB_PORT) || 3306;
const dbUser = process.env.DB_USER;
const dbName = process.env.DB_NAME;

export const mainPool = mysql.createPool({
    connectionLimit: 100, // Maximum number of connections
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000,
    host: dbHost,
    port: dbPort, // Default to 3306 if not specified
    user: dbUser,
    password: process.env.DB_PASSWORD,
    database: dbName,
});

console.log(`[DB:MAIN] Pool initialized -> ${dbUser ?? 'unknown'}@${dbHost ?? 'unknown'}:${dbPort}/${dbName ?? 'unknown'}`);

const missingRequiredEnv = ['DB_HOST', 'DB_USER', 'DB_NAME'].filter((key) => !process.env[key]);
if (missingRequiredEnv.length > 0) {
    console.warn(
        `[DB] Missing required environment variables: ${missingRequiredEnv.join(', ')}`
    );
}

export async function checkDatabaseConnection() {
    const start = Date.now();
    await mainPool.query('SELECT 1');
    return {
        responseTime: Date.now() - start,
        target: `${dbUser ?? 'unknown'}@${dbHost ?? 'unknown'}:${dbPort}/${dbName ?? 'unknown'}`,
    };
}

void (async () => {
    try {
        const result = await checkDatabaseConnection();
        console.log(`[DB] Connection check succeeded (${result.responseTime}ms) -> ${result.target}`);
    } catch (err) {
        console.error('[DB] Connection check failed during startup:', err);
    }
})();

// Keep-alive mechanism to prevent idle connections from being closed
setInterval(async () => {
    const startTime = new Date();
    try {
        await mainPool.query('SELECT 1');
        const endTime = new Date();
        const executionTime = endTime.getTime() - startTime.getTime();
        console.log(`[${startTime.toISOString()}] Keep-alive query executed successfully in ${executionTime}ms`);
    } catch (err) {
        console.error(`[${startTime.toISOString()}] Keep-alive query failed:`, err);
    }
}, 3600000); // Execute once every hour

export default mainPool;
