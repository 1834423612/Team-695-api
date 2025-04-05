import rateLimit from "express-rate-limit"

/**
 * Rate limiter middleware to prevent abuse
 * Limits each IP to 5 requests per minute
 */
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        success: false,
        message: "Too many requests, please try again later.",
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

export default limiter
