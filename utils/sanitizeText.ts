const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;',
};

function toStringSafe(input: unknown): string {
    if (typeof input === 'string') {
        return input;
    }

    if (typeof input === 'number' || typeof input === 'boolean' || typeof input === 'bigint') {
        return String(input);
    }

    if (input === null || input === undefined) {
        return '';
    }

    try {
        return JSON.stringify(input);
    } catch {
        return String(input);
    }
}

export function sanitizeGameComment(input: unknown): string {
    const raw = toStringSafe(input);

    return raw
        .replace(/\r\n?/g, '\n')
        .replace(/[\u2028\u2029]/g, '\n')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
        .replace(/[&<>"'`]/g, (char) => htmlEscapeMap[char])
        .trim();
}
