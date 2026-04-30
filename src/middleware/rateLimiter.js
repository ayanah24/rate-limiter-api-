import fixedWindowLimiter from '../limiters/fixedWindow.js';
import tokenBucketLimiter from '../limiters/tokenBucket.js';
import sliddingWindowLimiter from '../limiters/slidingWindow.js';
import { isBlacklisted, isWhitelisted } from "../utils/ipFilter.js"

//const ALGORITHM = 'sliding'; //can change between 'token' and 'fixed' or 'sliding'
/*
  rateLimiter is now a FACTORY FUNCTION
  It takes a config object and returns an Express middleware function
  
  config options:
  - algorithm: 'fixed' | 'token' | 'sliding' (default: 'sliding')
  - max: max requests (default: from .env)
  - window: window size in seconds (default: from .env)
*/
const rateLimiter = (config = {}) => {
    //destruct config with deafult
    const algorithm = config.algorithm || 'sliding';
    const max = config.max || parseInt(process.env.SLIDING_MAX_REQUESTS);
    const window = config.window || parseInt(process.env.SLIDING_WINDOW_SECONDS);

    return async (req, res, next) => {
        try {
            const clientIP = req.ip;
            const blacklisted = await isBlacklisted(clientIP);
            if (blacklisted) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'your IP has been blacklisted'
                });
            }
            const whitelisted = await isWhitelisted(clientIP);
            if (whitelisted) {
                return next();

            }
            let result;
            if (algorithm === 'token') {
                result = await tokenBucketLimiter(clientIP, max);

            } else if (algorithm === 'sliding') {
                result = await sliddingWindowLimiter(clientIP, max, window);
            } else {
                result = await fixedWindowLimiter(clientIP, max, window);
            }
            const { allowed, remaining, limit, count } = result;
            const resetTime = Math.ceil(Date.now() / 1000) + window;
            res.setHeader('RateLimit-limit', limit);
            res.setHeader('Rate-limit-Remaining', remaining);
            res.setHeader('RateLimit-Reset', resetTime);
            res.setHeader('X-Rate-Limit-Count', count);
            res.setHeader('X-Rate-Limit-Algorithm', algorithm);

            if (!allowed) {
                res.setHeader('Retry-After', window);
                return res.status(429).json({
                    error: 'Too Many Requests',
                    algorithm,
                    limit,
                    remaining: 0,
                    retryAfter: window
                });
            }
            next();
        } catch (err) {
            console.error('Rate limiter error', err);
            next();
        }
    }
}
export default rateLimiter;