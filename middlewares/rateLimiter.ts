import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1, // Limit each IP to 1 request per windowMs
    message: { message: 'Too many requests, please try again later.' },
});

export default limiter;
