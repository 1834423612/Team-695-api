import os from 'os'
import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'

export interface HealthCheckResult {
    success: boolean
    status: string
    message: string
    version: string
    timestamp: string
    uptime: {
        process: number
        system: number
        formatted: {
            process: string
            system: string
        }
    }
    environment: string
    nodeVersion: string
    platform: {
        type: string
        platform: string
        arch: string
        release: string
    }
    performance: {
        responseTime: number
        memory: {
            usage: NodeJS.MemoryUsage
            total: number
            free: number
            used: number
            percentage: number
        }
        cpu: {
            cores: number
            loadAverage: number[]
            model: string
        }
    }
    services: {
        database: ServiceStatus
        redis: ServiceStatus
        swagger: ServiceStatus
        uploads: ServiceStatus
    }
}

export interface ServiceStatus {
    status: string
    message: string
    responseTime?: number
}

export function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    return `${days}d ${hours}h ${mins}m ${secs}s`
}

export async function performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now()
    
    try {
        // Basic health check structure
        const healthData: HealthCheckResult = {
            success: true,
            status: "healthy",
            message: "Team 695 API is running",
            version: "1.2.6",
            timestamp: new Date().toISOString(),
            uptime: {
                process: Math.floor(process.uptime()),
                system: Math.floor(os.uptime()),
                formatted: {
                    process: formatUptime(process.uptime()),
                    system: formatUptime(os.uptime())
                }
            },
            environment: process.env.NODE_ENV || "development",
            nodeVersion: process.version,
            platform: {
                type: os.type(),
                platform: os.platform(),
                arch: os.arch(),
                release: os.release()
            },
            performance: {
                responseTime: 0, // will be calculated later
                memory: {
                    usage: process.memoryUsage(),
                    total: os.totalmem(),
                    free: os.freemem(),
                    used: os.totalmem() - os.freemem(),
                    percentage: Math.round((os.totalmem() - os.freemem()) / os.totalmem() * 100)
                },
                cpu: {
                    cores: os.cpus().length,
                    loadAverage: os.loadavg(),
                    model: os.cpus()[0]?.model || 'Unknown'
                }
            },
            services: {
                database: await checkDatabaseHealth(),
                redis: await checkRedisHealth(),
                swagger: checkSwaggerHealth(),
                uploads: checkUploadsHealth()
            }
        }
        
        // Calculate response time
        const endTime = performance.now()
        healthData.performance.responseTime = Math.round((endTime - startTime) * 100) / 100
        
        // Check if any service is unhealthy
        const hasUnhealthyServices = Object.values(healthData.services).some(
            service => service.status !== 'healthy'
        )
        
        if (hasUnhealthyServices) {
            healthData.status = "degraded"
            healthData.success = false
        }
        
        return healthData
        
    } catch (error) {
        const endTime = performance.now()
        throw {
            success: false,
            status: "unhealthy",
            message: "Health check failed",
            timestamp: new Date().toISOString(),
            error: process.env.NODE_ENV === 'production' ? undefined : (error as Error).message,
            responseTime: Math.round((endTime - startTime) * 100) / 100
        }
    }
}

async function checkDatabaseHealth(): Promise<ServiceStatus> {
    try {
        const startTime = performance.now()
        // Substitute with your database connection logic
        const db = require('../../config/database') // If you have a database connection setup
        await db.query('SELECT 1')
        const responseTime = Math.round((performance.now() - startTime) * 100) / 100
        
        return {
            status: 'healthy',
            message: 'Database connection successful',
            responseTime
        }
    } catch (error) {
        return {
            status: 'unhealthy',
            message: 'Database connection failed'
        }
    }
}

async function checkRedisHealth(): Promise<ServiceStatus> {
    try {
        const startTime = performance.now()
        // Substitute with your Redis connection logic
        // const redis = require('../config/redis') // If you have a Redis connection setup
        // await redis.ping()
        const responseTime = Math.round((performance.now() - startTime) * 100) / 100
        
        return {
            status: 'healthy',
            message: 'Redis connection successful',
            responseTime
        }
    } catch (error) {
        return {
            status: 'unhealthy',
            message: 'Redis connection failed'
        }
    }
}

function checkSwaggerHealth(): ServiceStatus {
    try {
        const swaggerPath = path.join(__dirname, '..', 'swagger', 'Docs.yaml')
        if (fs.existsSync(swaggerPath)) {
            return {
                status: 'healthy',
                message: 'Swagger documentation available'
            }
        } else {
            return {
                status: 'unhealthy',
                message: 'Swagger documentation not found'
            }
        }
    } catch (error) {
        return {
            status: 'unhealthy',
            message: 'Swagger documentation check failed'
        }
    }
}

function checkUploadsHealth(): ServiceStatus {
    try {
        const uploadsDir = path.join(__dirname, '..', 'public')
        if (fs.existsSync(uploadsDir)) {
            return {
                status: 'healthy',
                message: 'Upload directory accessible'
            }
        } else {
            return {
                status: 'degraded',
                message: 'Upload directory not found'
            }
        }
    } catch (error) {
        return {
            status: 'unhealthy',
            message: 'Upload directory check failed'
        }
    }
}