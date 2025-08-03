import express from 'express'
import fs from 'fs'
import path from 'path'
import { getSwaggerDoc } from '../../utils/swaggerCache'

// Use cached packageJson
const packageJson = require('../../package.json');

const router = express.Router()

// Route to get API information
router.get('/api-info', (req, res) => {
    try {
        const swaggerDoc = getSwaggerDoc()
        const apiInfo = {
            name: swaggerDoc.info?.title || packageJson.name || 'Team 695 API',
            description: swaggerDoc.info?.description || packageJson.description || 'Team 695 Robotics API Server',
            version: swaggerDoc.info?.version || packageJson.version || '1.0.0',
            author: packageJson.author || 'Team 695 Bison Robotics',
            license: packageJson.license || 'MIT',
            servers: swaggerDoc.servers || [],
            contact: {
                name: 'Team 695 Bison Robotics',
                website: 'https://www.team695.com',
                // email: 'contact@team695.com'
            },
            documentation: {
                swagger: '/api-docs',
                // endpoints: '/api/info/endpoints',
                // health: '/health'
            },
            tags: swaggerDoc.tags?.map((tag: any) => ({
                name: tag.name,
                description: tag.description
            })) || [],
            features: {
                authentication: true,
                fileUploads: true,
                webhooks: true,
                swagger: true,
                cors: true,
                rateLimit: true,
                security: true
            },
            statistics: {
                totalEndpoints: Object.keys(swaggerDoc.paths || {}).reduce((total, path) => 
                    total + Object.keys(swaggerDoc.paths[path]).length, 0),
                totalTags: swaggerDoc.tags?.length || 0,
                supportedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                authMethods: ['Bearer Token', 'API Key']
            },
            runtime: {
                nodeVersion: process.version,
                environment: process.env.NODE_ENV || 'development',
                uptime: process.uptime(),
                platform: process.platform,
                arch: process.arch
            },
            lastUpdated: new Date().toISOString()
        }
        
        res.json({
            success: true,
            message: 'API information retrieved successfully',
            data: apiInfo
        })
    } catch (error) {
        console.error('Error retrieving API info:', error)
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve API information',
            error: process.env.NODE_ENV === 'production' ? undefined : (error as Error).message
        })
    }
})

export default router