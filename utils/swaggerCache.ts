import fs from 'fs'
import yaml from 'yaml'
import path from 'path'

// Cache for the Swagger document
// This will store the parsed Swagger document and its last modified time
// to avoid re-parsing it on every request, improving performance.
let cachedSwaggerDoc: any = null
let lastModified: number = 0

export function getSwaggerDoc() {
    const swaggerPath = path.join(__dirname, '..', 'swagger', 'Docs.yaml')
    const stats = fs.statSync(swaggerPath)

    // If the file has been modified, re-parse
    if (stats.mtimeMs !== lastModified || !cachedSwaggerDoc) {
        const swaggerFile = fs.readFileSync(swaggerPath, 'utf8')
        cachedSwaggerDoc = yaml.parse(swaggerFile)
        lastModified = stats.mtimeMs
    }
    
    return cachedSwaggerDoc
}