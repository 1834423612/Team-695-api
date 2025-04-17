import express from "express"
import bodyParser from "body-parser"
import cors from "cors"
import dotenv from "dotenv"
import swaggerUi from "swagger-ui-express"
import fs from "fs"
import yaml from "yaml"
import helmet from "helmet"
import morgan from "morgan"

// 添加类型声明扩展，使rawBody在Request对象上可用
declare global {
    namespace Express {
        interface Request {
            rawBody?: string;
            rawBodyBuffer?: Buffer;
        }
    }
}

// Load routes
import feedbackRoutes from "./routes/feedbackRoutes"
import eventRoutes from "./routes/eventRoutes"
import surveyRoutes from "./routes/surveyRoutes"
import teamRoutes from "./routes/teamRoutes"
import uploadRoutes from "./routes/uploadRoutes"
import authRoutes from "./routes/authRoutes"
import webhookRoutes from "./routes/webhookRoutes"
import assignmentRoutes from "./routes/assignmentRoutes"
import { publicTeamMatchesRoutes, protectedTeamMatchesRoutes } from './routes/teamMatchesRoutes';
import { verifyToken } from "./middlewares/auth"

// Load Swagger configuration
const swaggerFile = fs.readFileSync("./swagger/Docs.yaml", "utf8")
const swaggerDoc = yaml.parse(swaggerFile)

dotenv.config()

const app = express()

// Security middleware
app.use(helmet())

// Logging middleware
app.use(morgan("combined"))

// CORS configuration
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "*",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-API-Secret"],
    }),
)

// Body parser中间件配置
// 使用json解析但保留原始文本
app.use(bodyParser.json({
    verify: (req: any, res, buf) => {
        // 保存原始请求体以便HMAC验证
        req.rawBody = buf.toString(); // 保存为字符串
        req.rawBodyBuffer = buf;     // 也保存原始缓冲区以防需要
        console.log("Raw body captured:", req.rawBody);
    }
}));
app.use(bodyParser.urlencoded({ extended: true }))

// Swagger Docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc, { explorer: true }))

// API Endpoint routes
const apiRouter = express.Router()

// 所有公共路由 - 无需认证
apiRouter.use("/auth", authRoutes)
apiRouter.use("/team", teamRoutes)
apiRouter.use("/webhook", webhookRoutes)
apiRouter.use("/team-matches", publicTeamMatchesRoutes)
apiRouter.use("/event-id", eventRoutes)
apiRouter.use("/event", eventRoutes)  // 现在所有event路由都无需认证
apiRouter.use("/survey", surveyRoutes) // 问卷路由暂时无需认证
apiRouter.use("/upload", uploadRoutes) // 上传路由暂时无需认证
apiRouter.use("/assignments", assignmentRoutes) // 任务路由暂时无需认证
apiRouter.use("/team-matches", protectedTeamMatchesRoutes) // 所有团队匹配路由暂时无需认证

// 只有删除操作需要认证 - 通过特定的路由处理
apiRouter.use("/upload/images", verifyToken); // 删除图片需要认证
apiRouter.use("/assignments/:id", (req, res, next) => {
    if (req.method === 'DELETE') {
        // If verifyToken is an array, apply the middleware
        if (Array.isArray(verifyToken)) {
            // Create a middleware chain
            let idx = 0;
            const runMiddleware = () => {
                if (idx < verifyToken.length) {
                    verifyToken[idx](req, res, () => {
                        idx++;
                        runMiddleware();
                    });
                } else {
                    next();
                }
            };
            runMiddleware();
        } else {
            next();
        }
    } else {
        next();
    }
});

// 反馈路由有自己的保护机制
apiRouter.use("/", feedbackRoutes)

// Use the apiRouter for all API routes
app.use("/", apiRouter) // Allow routes with `/` prefix
app.use("/api", apiRouter) // Allow routes with `/api` prefix

// 添加 API v1 前缀路由 - 使用相同的路由处理器但有不同的前缀
app.use("/api/v1", apiRouter)

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack)
    res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: process.env.NODE_ENV === "production" ? undefined : err.message,
    })
})

// If your application runs behind a reverse proxy (such as Nginx), use the following line
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", true)
} else {
    // Trust proxy requests from localhost in development environment
    app.set("trust proxy", "loopback")
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`)
})

export default app
