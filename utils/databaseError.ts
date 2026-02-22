type DatabaseLikeError = {
    code?: string;
    message?: string;
};

const DB_UNAVAILABLE_ERROR_CODES = new Set([
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'EAI_AGAIN',
    'PROTOCOL_CONNECTION_LOST',
]);

function asDatabaseLikeError(err: unknown): DatabaseLikeError {
    return (err ?? {}) as DatabaseLikeError;
}

export function isDatabaseUnavailableError(err: unknown): boolean {
    const typedError = asDatabaseLikeError(err);
    return !!typedError.code && DB_UNAVAILABLE_ERROR_CODES.has(typedError.code);
}

export function getDatabaseHttpStatus(err: unknown): number {
    return isDatabaseUnavailableError(err) ? 503 : 500;
}

export function getDatabaseClientMessage(fallback = 'Database query failed', err?: unknown): string {
    if (isDatabaseUnavailableError(err)) {
        return 'Database is temporarily unavailable';
    }

    return fallback;
}
