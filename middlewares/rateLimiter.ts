import rateLimit from "express-rate-limit"
import { qosConfig } from "../config/qos"

type LimiterOptions = {
    windowMs: number
    max: number
    message: string
}

const createLimiter = ({ windowMs, max, message }: LimiterOptions) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            message,
        },
        standardHeaders: true,
        legacyHeaders: false,
    })
}

export const apiPerSecondLimiter = createLimiter({
    windowMs: 1000,
    max: qosConfig.api.perSecond,
    message: "Too many requests per second, please slow down.",
})

export const apiPerMinuteLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: qosConfig.api.perMinute,
    message: "Too many requests per minute, please try again later.",
})

export const authPerSecondLimiter = createLimiter({
    windowMs: 1000,
    max: qosConfig.auth.perSecond,
    message: "Too many authentication attempts per second.",
})

export const authPerMinuteLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: qosConfig.auth.perMinute,
    message: "Too many authentication attempts per minute.",
})

export const feedbackPerSecondLimiter = createLimiter({
    windowMs: 1000,
    max: qosConfig.feedback.perSecond,
    message: "Too many feedback submissions per second.",
})

export const feedbackPerMinuteLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: qosConfig.feedback.perMinute,
    message: "Too many feedback submissions per minute.",
})

export const scoutifyPublicPerSecondLimiter = createLimiter({
    windowMs: 1000,
    max: qosConfig.scoutifyPublic.perSecond,
    message: "Too many Scoutify query requests per second.",
})

export const scoutifyPublicPerMinuteLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: qosConfig.scoutifyPublic.perMinute,
    message: "Too many Scoutify query requests per minute.",
})

const rateLimiter = [feedbackPerSecondLimiter, feedbackPerMinuteLimiter]

export default rateLimiter
