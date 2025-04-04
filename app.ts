import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import feedbackRoutes from './routes/feedbackRoutes';
import eventRoutes from './routes/eventRoutes';
import surveyRoutes from './routes/surveyRoutes';
import teamRoutes from './routes/teamRoutes';
import uploadRoutes from './routes/uploadRoutes';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import yaml from 'yaml';

// Load Swagger configuration
const swaggerFile = fs.readFileSync('./swagger/Docs.yaml', 'utf8');
const swaggerDoc = yaml.parse(swaggerFile);

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Swagger Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, { explorer: true }));

// API Endpoint route
const apiRouter = express.Router();
apiRouter.use('/event', eventRoutes);
apiRouter.use('/survey', surveyRoutes);
apiRouter.use('/team', teamRoutes);
apiRouter.use('/upload', uploadRoutes);
apiRouter.use('/', feedbackRoutes); // Feedback routes will be at `/`

// Use the apiRouter for all API routes
app.use('/', apiRouter);    // Allow routes with `/` prefix
app.use('/api', apiRouter); // Allow routes with `/api` prefix


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
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});
