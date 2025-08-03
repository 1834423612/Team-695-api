import express from 'express'
import fs from 'fs'
import path from 'path'
import { formatUptime } from '../../utils/healthCheck'

// Use cached packageJson
const packageJson = require('../../package.json');

const router = express.Router()

// Get the status of the API
router.get('/', (req, res) => {
    try {
        const status = {
            service: 'Team 695 API',
            status: 'operational',
            timestamp: new Date().toISOString(),
            uptime: {
                seconds: process.uptime(),
                formatted: formatUptime(process.uptime())
            },
            version: packageJson.version,
            environment: process.env.NODE_ENV || 'development',
            endpoints: {
                health: '/health',
                info: '/api/info/api-info',
                documentation: '/api-docs',
                endpoints: '/api/info/endpoints'
            }
        }
        
        res.json({
            success: true,
            data: status
        })
    } catch (error) {
        console.error('Error retrieving status:', error)
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve status',
            error: process.env.NODE_ENV === 'production' ? undefined : (error as Error).message
        })
    }
})

export default router