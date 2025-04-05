import type { Response } from "express"
import type { ApiResponse } from "../types"

/**
 * Send a success response
 */
export function success<T>(res: Response, data: T, message?: string): Response {
    const response: ApiResponse<T> = {
        success: true,
        data,
    }

    if (message) {
        response.message = message
    }

    return res.status(200).json(response)
}

/**
 * Send an error response
 */
export function error(res: Response, statusCode: number, message: string, err?: any): Response {
    const response: ApiResponse = {
        success: false,
        message,
    }

    if (err) {
        console.error(err)
        if (process.env.NODE_ENV !== "production") {
            response.error = err instanceof Error ? err.message : String(err)
        }
    }

    return res.status(statusCode).json(response)
}

/**
 * Send an unauthorized response
 */
export function unauthorized(res: Response, message = "Unauthorized"): Response {
    return error(res, 401, message)
}

/**
 * Send a forbidden response
 */
export function forbidden(res: Response, message = "Forbidden"): Response {
    return error(res, 403, message)
}

/**
 * Send a not found response
 */
export function notFound(res: Response, message = "Not found"): Response {
    return error(res, 404, message)
}
