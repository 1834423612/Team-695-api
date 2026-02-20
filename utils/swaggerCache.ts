import fs from 'fs'
import yaml from 'yaml'
import path from 'path'
import type { Request } from 'express'

// Cache for the Swagger document
// This will store the parsed Swagger document and its last modified time
// to avoid re-parsing it on every request, improving performance.
let cachedSwaggerDoc: any = null
let lastModified: number = 0

export type SwaggerCacheSnapshot = {
    swaggerDoc: any
    lastModified: number
    etag: string
}

function getSwaggerPath() {
    return path.join(__dirname, '..', 'swagger', 'Docs.yaml')
}

function toEtag(mtimeMs: number) {
    return `W/\"swagger-${Math.floor(mtimeMs)}\"`
}

export function getSwaggerDoc() {
    const swaggerPath = getSwaggerPath()
    const stats = fs.statSync(swaggerPath)

    // If the file has been modified, re-parse
    if (stats.mtimeMs !== lastModified || !cachedSwaggerDoc) {
        const swaggerFile = fs.readFileSync(swaggerPath, 'utf8')
        cachedSwaggerDoc = yaml.parse(swaggerFile)
        lastModified = stats.mtimeMs
    }
    
    return cachedSwaggerDoc
}

export function getSwaggerSnapshot(): SwaggerCacheSnapshot {
    const swaggerPath = getSwaggerPath()
    const stats = fs.statSync(swaggerPath)

    if (stats.mtimeMs !== lastModified || !cachedSwaggerDoc) {
        const swaggerFile = fs.readFileSync(swaggerPath, 'utf8')
        cachedSwaggerDoc = yaml.parse(swaggerFile)
        lastModified = stats.mtimeMs
    }

    return {
        swaggerDoc: cachedSwaggerDoc,
        lastModified,
        etag: toEtag(lastModified),
    }
}

export function isSwaggerNotModified(req: Request, snapshot: SwaggerCacheSnapshot) {
    const ifNoneMatch = req.headers['if-none-match']
    if (typeof ifNoneMatch === 'string' && ifNoneMatch === snapshot.etag) {
        return true
    }

    const ifModifiedSince = req.headers['if-modified-since']
    if (typeof ifModifiedSince === 'string') {
        const sinceTime = Date.parse(ifModifiedSince)
        if (!Number.isNaN(sinceTime) && sinceTime >= snapshot.lastModified) {
            return true
        }
    }

    return false
}