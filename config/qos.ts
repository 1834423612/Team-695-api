import dotenv from 'dotenv'

dotenv.config()

type QosBucket = {
    perSecond: number
    perMinute: number
}

type QosConfig = {
    api: QosBucket
    auth: QosBucket
    feedback: QosBucket
    scoutifyPublic: QosBucket
}

export const defaultQosConfig: QosConfig = {
    api: {
        perSecond: 30,
        perMinute: 900,
    },
    auth: {
        perSecond: 8,
        perMinute: 120,
    },
    feedback: {
        perSecond: 2,
        perMinute: 30,
    },
    scoutifyPublic: {
        perSecond: 12,
        perMinute: 300,
    },
}

function resolveLimit(envKey: string, fallback: number): number {
    const value = process.env[envKey]
    if (!value) {
        return fallback
    }

    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback
    }

    return Math.floor(parsed)
}

export const qosConfig: QosConfig = {
    api: {
        perSecond: resolveLimit('QOS_API_PER_SECOND', defaultQosConfig.api.perSecond),
        perMinute: resolveLimit('QOS_API_PER_MINUTE', defaultQosConfig.api.perMinute),
    },
    auth: {
        perSecond: resolveLimit('QOS_AUTH_PER_SECOND', defaultQosConfig.auth.perSecond),
        perMinute: resolveLimit('QOS_AUTH_PER_MINUTE', defaultQosConfig.auth.perMinute),
    },
    feedback: {
        perSecond: resolveLimit('QOS_FEEDBACK_PER_SECOND', defaultQosConfig.feedback.perSecond),
        perMinute: resolveLimit('QOS_FEEDBACK_PER_MINUTE', defaultQosConfig.feedback.perMinute),
    },
    scoutifyPublic: {
        perSecond: resolveLimit('QOS_SCOUTIFY_PUBLIC_PER_SECOND', defaultQosConfig.scoutifyPublic.perSecond),
        perMinute: resolveLimit('QOS_SCOUTIFY_PUBLIC_PER_MINUTE', defaultQosConfig.scoutifyPublic.perMinute),
    },
}
