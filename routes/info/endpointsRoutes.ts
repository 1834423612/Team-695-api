import express from 'express'
import { getSwaggerDoc } from '../../utils/swaggerCache'

const router = express.Router()

// Get all available API endpoints
router.get('/', (req, res) => {
    try {
        const swaggerDoc = getSwaggerDoc()
        const endpoints: any[] = []
        
        // Parses all paths in swagger documentation
        Object.entries(swaggerDoc.paths || {}).forEach(([path, pathObject]: [string, any]) => {
            Object.entries(pathObject).forEach(([method, methodObject]: [string, any]) => {
                if (typeof methodObject === 'object' && methodObject !== null) {
                    endpoints.push({
                        path: path,
                        method: method.toUpperCase(),
                        summary: methodObject.summary || 'No summary provided',
                        description: methodObject.description || 'No description provided',
                        tags: methodObject.tags || [],
                        security: methodObject.security ? 
                            methodObject.security.map((sec: any) => Object.keys(sec)).flat() : 
                            ['public'],
                        parameters: methodObject.parameters?.map((param: any) => ({
                            name: param.name,
                            in: param.in,
                            required: param.required || false,
                            description: param.description || ''
                        })) || [],
                        requestBody: methodObject.requestBody ? {
                            required: methodObject.requestBody.required || false,
                            contentTypes: Object.keys(methodObject.requestBody.content || {})
                        } : null,
                        responses: Object.keys(methodObject.responses || {})
                    })
                }
            })
        })

        // Sort by tags and path
        endpoints.sort((a, b) => {
            const tagA = a.tags[0] || 'Other'
            const tagB = b.tags[0] || 'Other'
            if (tagA !== tagB) {
                return tagA.localeCompare(tagB)
            }
            return a.path.localeCompare(b.path)
        })
        
        res.json({
            success: true,
            message: 'API endpoints retrieved successfully',
            data: {
                total: endpoints.length,
                endpoints: endpoints,
                tags: [...new Set(endpoints.flatMap(e => e.tags))].sort(),
                lastUpdated: new Date().toISOString()
            }
        })
    } catch (error) {
        console.error('Error retrieving API endpoints:', error)
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve API endpoints',
            error: process.env.NODE_ENV === 'production' ? undefined : (error as Error).message
        })
    }
})

// Get API endpoints by tag
router.get('/by-tag/:tag', (req, res) => {
    try {
        const { tag } = req.params
        const swaggerDoc = getSwaggerDoc()
        const endpoints: any[] = []
        
        Object.entries(swaggerDoc.paths || {}).forEach(([path, pathObject]: [string, any]) => {
            Object.entries(pathObject).forEach(([method, methodObject]: [string, any]) => {
                if (typeof methodObject === 'object' && 
                    methodObject !== null && 
                    methodObject.tags?.includes(tag)) {
                    endpoints.push({
                        path: path,
                        method: method.toUpperCase(),
                        summary: methodObject.summary || 'No summary provided',
                        description: methodObject.description || 'No description provided',
                        tags: methodObject.tags || [],
                        security: methodObject.security ? 
                            methodObject.security.map((sec: any) => Object.keys(sec)).flat() : 
                            ['public']
                    })
                }
            })
        })
        
        res.json({
            success: true,
            message: `API endpoints for tag '${tag}' retrieved successfully`,
            data: {
                tag: tag,
                total: endpoints.length,
                endpoints: endpoints
            }
        })
    } catch (error) {
        console.error('Error retrieving API endpoints by tag:', error)
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve API endpoints by tag',
            error: process.env.NODE_ENV === 'production' ? undefined : (error as Error).message
        })
    }
})

export default router