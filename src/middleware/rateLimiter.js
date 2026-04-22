import fixedWindowLimiter from '../limiters/fixedWindow.js';
import tokenBucketLimiter from '../limiters/tokenBucket.js';
import sliddingWindowLimiter from '../limiters/slidingWindow.js';

const ALGORITHM = 'sliding'; //can change between 'token' and 'fixed' or 'sliding'

const rateLimiterMiddleware = async (req, res, next) => {
    try {
        const clientIP = req.ip;

        //pick algorithm 
        let result;
        if (ALGORITHM === 'token') {
            result = await tokenBucketLimiter(clientIP);
        } else if (ALGORITHM === 'sliding') {
            result = await sliddingWindowLimiter(clientIP);
        } else {
            result = await fixedWindowLimiter(clientIP);
        }

        const { allowed, limit, remaining } = result;

        // setting headers
        res.set('x-RateLimit-Algorithm', ALGORITHM);
        res.set('x-RateLimit-Limit', limit);
        res.set('X-RateLimit-Remaining', remaining);

        if (!allowed) {
            return res.status(429).json({
                error: 'Too Many Requests',
                algorithm: ALGORITHM,
                message: `Limit is ${limit} requests per window`,
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
