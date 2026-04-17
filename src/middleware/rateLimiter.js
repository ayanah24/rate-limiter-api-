import fixedWindowLimiter from '../limiters/fixedWindow.js';

const rateLimiterMiddleware = async (req, res, next) => {
    try {
        const clientIP = req.ip;
        const { allowed, cnt, limit, remaining, retryAfter } = await fixedWindowLimiter(clientIP);
        // setting headers
        res.set('x-RateLimit-Limit', limit);
        res.set('x-RateLimit-Remaining', remaining);
        res.set('x-RateLimit-Count', cnt);
        res.set('X-RateLimit-Reset', retryAfter);
        if (!allowed) {
            return res.status(429).json({
                error: 'Too Many Requests',
                message: `Try again in ${retryAfter} seconds`,
                retryAfter: `${retryAfter} seconds`
            });
        }
        next();
    } catch (err) {
        console.error('Rate limiter error:', err);
        next();
    }
};

export default rateLimiterMiddleware;
