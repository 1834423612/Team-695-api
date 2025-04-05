import express from "express"
import bodyParser from "body-parser"
import cors from "cors"
import dotenv from "dotenv"
import swaggerUi from "swagger-ui-express"
import fs from "fs"
import yaml from "yaml"

// Load routes
import feedbackRoutes from "./routes/feedbackRoutes"
import eventRoutes from "./routes/eventRoutes"
import surveyRoutes from "./routes/surveyRoutes"
import teamRoutes from "./routes/teamRoutes"
import uploadRoutes from "./routes/uploadRoutes"
import authRoutes from "./routes/authRoutes"

// Load Swagger configuration
const swaggerFile = fs.readFileSync("./swagger/Docs.yaml", "utf8");
const swaggerDoc = yaml.parse(swaggerFile);

dotenv.config();

const app = express()
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "*",
        credentials: true,
    }),
)
app.use(bodyParser.json())

// Swagger Docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc, { explorer: true }));


// API Endpoint route
const apiRouter = express.Router()
apiRouter.use("/auth", authRoutes)
apiRouter.use("/event", eventRoutes);
apiRouter.use("/survey", surveyRoutes);
apiRouter.use("/team", teamRoutes);
apiRouter.use("/upload", uploadRoutes);
apiRouter.use("/", feedbackRoutes);

// 为所有 API 路由使用 apiRouter
app.use("/", apiRouter) // Allow routes with `/` prefix
app.use("/api", apiRouter) // Allow routes with `/api` prefix

// If your application runs behind a reverse proxy (such as Nginx), use the following line
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", true)
} else {
    // Trust proxy requests from localhost in development environment
    app.set("trust proxy", "loopback")
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});

export default app

