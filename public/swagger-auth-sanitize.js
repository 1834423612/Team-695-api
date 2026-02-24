(function attachHeaderSanitizer() {
    const isLatin1 = (value) => {
        for (let index = 0; index < value.length; index += 1) {
            if (value.charCodeAt(index) > 255) {
                return false;
            }
        }
        return true;
    };

    const sanitizeHeaderValue = (value) => {
        if (typeof value !== 'string') {
            return value;
        }

        const normalized = value.replace(/\u2026/g, '...').normalize('NFKC');
        let sanitized = '';

        for (let index = 0; index < normalized.length; index += 1) {
            const ch = normalized.charAt(index);
            const code = normalized.charCodeAt(index);
            if (code <= 255) {
                sanitized += ch;
            }
        }

        return sanitized;
    };

    const sanitizeHeaders = (headers) => {
        if (!headers || typeof headers !== 'object') {
            return headers;
        }

        const nextHeaders = {};
        Object.keys(headers).forEach((headerName) => {
            const headerValue = headers[headerName];
            if (Array.isArray(headerValue)) {
                nextHeaders[headerName] = headerValue.map((value) => sanitizeHeaderValue(value));
                return;
            }
            nextHeaders[headerName] = sanitizeHeaderValue(headerValue);
        });

        return nextHeaders;
    };

    const inject = () => {
        if (!window.ui || typeof window.ui.getConfigs !== 'function') {
            return false;
        }

        const configs = window.ui.getConfigs();
        const originalInterceptor = configs.requestInterceptor;

        configs.requestInterceptor = (request) => {
            if (request && request.headers) {
                request.headers = sanitizeHeaders(request.headers);
            }

            if (
                request &&
                request.headers &&
                request.headers.Authorization &&
                typeof request.headers.Authorization === 'string' &&
                !isLatin1(request.headers.Authorization)
            ) {
                request.headers.Authorization = sanitizeHeaderValue(request.headers.Authorization);
            }

            if (typeof originalInterceptor === 'function') {
                return originalInterceptor(request);
            }

            return request;
        };

        return true;
    };

    if (inject()) {
        return;
    }

    window.addEventListener('load', () => {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts += 1;
            if (inject() || attempts > 20) {
                clearInterval(timer);
            }
        }, 100);
    });
})();
