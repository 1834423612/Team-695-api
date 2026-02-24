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
import { sanitizeLatin1IfString } from "./utils/sanitizeLatin1"

// Type declarations to extend Request object with rawBody property
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
import scoutifyRoutes from "./routes/scoutifyRoutes"
import { apiPerMinuteLimiter, apiPerSecondLimiter } from "./middlewares/rateLimiter"

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
                    "'nonce-{nonce}'",
                    "https://fonts.googleapis.com",
                    "https://cdn.tailwindcss.com",
                    "https://cdn.jsdelivr.net",
                    "https://unpkg.com"
                ],
                scriptSrc: [
                    "'self'",
                    "'nonce-{nonce}'",
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

// Sanitize request headers/query values that may contain non Latin-1 characters
app.use((req, res, next) => {
    for (const key of Object.keys(req.headers)) {
        const current = req.headers[key]
        if (typeof current === 'string') {
            req.headers[key] = sanitizeLatin1IfString(current)
            continue
        }
        if (Array.isArray(current)) {
            req.headers[key] = current.map((item) => sanitizeLatin1IfString(item))
        }
    }

    const queryRef = req.query as Record<string, unknown>
    const queryKeysToSanitize = ['token', 'accessKey', 'accessSecret', 'authorization']
    for (const key of queryKeysToSanitize) {
        const value = queryRef[key]
        if (typeof value === 'string') {
            queryRef[key] = sanitizeLatin1IfString(value)
        }
    }

    next()
})

// Body parser middleware configuration
app.use(bodyParser.json({
    verify: (req: any, res, buf) => {
        // Save raw request body for HMAC verification
        req.rawBody = buf.toString();
        req.rawBodyBuffer = buf;
        console.log("Raw body captured:", req.rawBody);
    }
}));
app.use(bodyParser.urlencoded({ extended: true }))

// Swagger Docs
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDoc, {
        explorer: true,
        customJs: '/swagger-auth-sanitize.js',
    }),
)

// API Endpoint routes
const apiRouter = express.Router()
apiRouter.use(apiPerSecondLimiter, apiPerMinuteLimiter)

// Public routes - no authentication required
apiRouter.use("/auth", authRoutes)
apiRouter.use("/team", teamRoutes)
apiRouter.use("/webhook", webhookRoutes)
apiRouter.use("/team-matches", publicTeamMatchesRoutes)
apiRouter.use("/event", eventRoutes)
apiRouter.use("/survey", surveyRoutes)
apiRouter.use("/upload", uploadRoutes)
apiRouter.use("/assignments", assignmentRoutes)
apiRouter.use("/team-matches", protectedTeamMatchesRoutes)
apiRouter.use("/scoutify", scoutifyRoutes)

// Only delete operations require authentication
apiRouter.use("/upload/images", verifyToken);
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
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON payload',
            error: process.env.NODE_ENV === 'production' ? undefined : err.message,
        })
    }

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
