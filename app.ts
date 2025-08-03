import path from "path"
import express from "express"
import bodyParser from "body-parser"
import cors from "cors"
import dotenv from "dotenv"
import swaggerUi from "swagger-ui-express"
import fs from "fs"
import yaml from "yaml"
import helmet from "helmet"
import morgan from "morgan"
import os from 'os'
import { performHealthCheck } from "./utils/healthCheck"

// 添加类型声明扩展，使rawBody在Request对象上可用
declare global {
    namespace Express {
        interface Request {
            rawBody?: string;
            rawBodyBuffer?: Buffer;
        }
        interface Response {
            locals: {
                nonce?: string;
                [key: string]: any;
            };
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
import apiInfoRoutes from "./routes/apiInfoRoutes"

// Load Swagger configuration
const swaggerFile = fs.readFileSync("./swagger/Docs.yaml", "utf8")
const swaggerDoc = yaml.parse(swaggerFile)

dotenv.config()

const app = express()

// Security middleware
if (process.env.NODE_ENV === "production") {
    // Nonce generator middleware
    app.use((req, res, next) => {
        // Generate a random nonce for each request
        res.locals.nonce = Buffer.from(
            Math.random().toString() + Date.now().toString()
        ).toString('base64');
        next();
    });
    app.use(helmet({
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                defaultSrc: ["'self'", "https:"],
                styleSrc: [
                    "'self'",
                    // Allow styles with nonce
                    (req: any, res: any) => `'nonce-${res.locals.nonce}'`,
                    "https://fonts.googleapis.com",
                    "https://cdn.tailwindcss.com",
                    "https://cdn.jsdelivr.net",
                    "https://unpkg.com"
                ],
                scriptSrc: [
                    "'self'",
                    // Allow scripts with nonce
                    (req: any, res: any) => `'nonce-${res.locals.nonce}'`,
                    "https://cdn.tailwindcss.com",
                    "https://code.iconify.design",
                    "https://cdn.jsdelivr.net",
                    "https://unpkg.com"
                ],
                fontSrc: [
                    "'self'",
                    "https:",
                    "https://fonts.gstatic.com",
                    "https://fonts.googleapis.com"
                ],
                connectSrc: [
                    "'self'",
                    "https:",
                    "https://api.iconify.design"
                ],
                imgSrc: [
                    "'self'", 
                    "data:", 
                    "https:"
                ],
                objectSrc: ["'none'"]
            },
        }
    }))
} else {
    // Disable Content Security Policy (CSP) in development for easier debugging
    app.use(helmet({
        contentSecurityPolicy: false
    }))
}


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

// Feedback routes
apiRouter.use("/", feedbackRoutes)

// API Info routes
apiRouter.use("/info", apiInfoRoutes)

// Use the apiRouter for all API routes
app.use("/", apiRouter) // Allow routes with `/` prefix
app.use("/api", apiRouter) // Allow routes with `/api` prefix

// API v1 routes - for backward compatibility
app.use("/api/v1", apiRouter)


// ------------- Index Page and Static Files ------------- //
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')))

// Route for the index page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// Enhanced Health check endpoint
app.get("/health", async (req, res) => {
    try {
        const healthData = await performHealthCheck()
        
        if (!healthData.success) {
            res.status(503)
        }
        
        res.json(healthData)
        
    } catch (error) {
        console.error('Health check error:', error)
        res.status(503).json(error)
    }
})



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
