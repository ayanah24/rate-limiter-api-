import fixedWindowLimiter from '../limiters/fixedWindow.js';
import tokenBucketLimiter from '../limiters/tokenBucket.js';

const ALGORITHM = 'token'; //can change between 'token' and 'fixed'

const rateLimiterMiddleware = async (req, res, next) => {
    try {
        const clientIP = req.ip;

        //pick algorithm 
        const { allowed, cnt, limit, remaining, retryAfter } = ALGORITHM === 'token'
            ? await tokenBucketLimiter(clientIP)
            : await fixedWindowLimiter(clientIP);
        // setting headers
        res.set('x-RateLimit-Limit', limit);
        res.set('x-RateLimit-Remaining', remaining);
        res.set('x-RateLimit-Count', cnt);
        res.set('X-RateLimit-Reset', retryAfter);
        if (!allowed) {
            return res.status(429).json({
                error: 'Too Many Requests',
                algorithm: ALGORITHM,
                message: 'Token bucket empty. Tokens refill at 1 per second.',
                tokensRemaining: 0
            });
        }
        next();
    } catch (err) {
        console.error('Rate limiter error:', err);
        next();
    }
};

export default rateLimiterMiddleware;
