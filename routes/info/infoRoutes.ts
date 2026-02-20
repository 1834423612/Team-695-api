import express from 'express'
import { getSwaggerSnapshot, isSwaggerNotModified } from '../../utils/swaggerCache'

// Use cached packageJson
const packageJson = require('../../package.json');

const router = express.Router()

let cachedApiInfoRevision = 0
let cachedApiInfoPayload: any = null

// Route to get API information
router.get('/api-info', (req, res) => {
    try {
        const snapshot = getSwaggerSnapshot()

        res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate')
        res.setHeader('ETag', snapshot.etag)
        res.setHeader('Last-Modified', new Date(snapshot.lastModified).toUTCString())

        if (isSwaggerNotModified(req, snapshot)) {
            return res.status(304).end()
        }

        if (cachedApiInfoRevision !== snapshot.lastModified || !cachedApiInfoPayload) {
            const apiInfo = {
                name: snapshot.swaggerDoc.info?.title || packageJson.name || 'Team 695 API',
                description: snapshot.swaggerDoc.info?.description || packageJson.description || 'Team 695 Robotics API Server',
                version: snapshot.swaggerDoc.info?.version || packageJson.version || '1.0.0',
                author: packageJson.author || 'Team 695 Bison Robotics',
                license: packageJson.license || 'MIT',
                servers: snapshot.swaggerDoc.servers || [],
                contact: {
                    name: 'Team 695 Bison Robotics',
                    website: 'https://www.team695.com',
                },
                documentation: {
                    swagger: '/api-docs',
                    endpoints: '/api/info/endpoints',
                    health: '/health'
                },
                tags: snapshot.swaggerDoc.tags?.map((tag: any) => ({
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
                    totalEndpoints: Object.keys(snapshot.swaggerDoc.paths || {}).reduce((total, path) =>
                        total + Object.keys(snapshot.swaggerDoc.paths[path]).length, 0),
                    totalTags: snapshot.swaggerDoc.tags?.length || 0,
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
                lastUpdated: new Date(snapshot.lastModified).toISOString()
            }

            cachedApiInfoPayload = {
                success: true,
                message: 'API information retrieved successfully',
                data: apiInfo
            }
            cachedApiInfoRevision = snapshot.lastModified
        }

        return res.json(cachedApiInfoPayload)
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