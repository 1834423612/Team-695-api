
export interface Feedback {
    id?: number;
    userId: number;
    message: string;
    deviceInfo: {
        userAgent: string;
        ip: string;
        screenSize: string;
        language: string;
    } | string;
}
