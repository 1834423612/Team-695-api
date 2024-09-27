import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import feedbackRoutes from './routes/feedbackRoutes';
import dotenv from 'dotenv';

import eventRoutes from './routes/eventRoutes';
import surveyRoutes from './routes/surveyRoutes';
import teamRoutes from './routes/teamRoutes';
import uploadRoutes from './routes/uploadRoutes';

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/api/event', eventRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/upload', uploadRoutes);

// 如果您的应用运行在一个反向代理后（如 Nginx），使用下面的行
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', true);
} else {
    // 在开发环境中信任本地主机的代理请求
    app.set('trust proxy', 'loopback');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
