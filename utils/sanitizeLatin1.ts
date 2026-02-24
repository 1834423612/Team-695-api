export function sanitizeLatin1(value: string): string {
    const normalized = value.replace(/\u2026/g, '...').normalize('NFKC');
    let sanitized = '';

    for (let index = 0; index < normalized.length; index += 1) {
        const charCode = normalized.charCodeAt(index);
        if (charCode <= 255) {
            sanitized += normalized.charAt(index);
        }
    }

    return sanitized;
}

export function sanitizeLatin1IfString<T>(value: T): T {
    if (typeof value !== 'string') {
        return value;
    }
    return sanitizeLatin1(value) as T;
}
