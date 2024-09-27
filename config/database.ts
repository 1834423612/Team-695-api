import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// 导入 .env 变量
dotenv.config();

const pool = mysql.createPool({
    connectionLimit: 100, // 最大连接数
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// 定时刷新连接，防止长时间不活跃导致连接关闭
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
}, 3600000); // 每小时执行一次

export default pool;
