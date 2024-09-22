export interface Feedback {
    nickname: string;
    category: string;
    title: string;
    contact: string;
    content: string;
    deviceInfo: {
        userAgent: string;
        ip: string;
        screenSize: string;
        language: string;
    };
    timestamp: string;
}
