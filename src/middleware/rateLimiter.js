import fixedWindowLimiter from '../limiters/fixedWindow.js';
import tokenBucketLimiter from '../limiters/tokenBucket.js';
import sliddingWindowLimiter from '../limiters/slidingWindow.js';
import { isBlacklisted, isWhitelisted } from "../utils/ipFilter.js"
import { getRule } from '../config/ruleCache.js';
import logger from '../utils/logger.js';
import { getIO } from '../socket.js';
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
    const staticAlgorithm = config.algorithm || 'sliding';
    const staticMax = config.max || parseInt(process.env.SLIDING_MAX_REQUESTS);
    const staticWindow = config.window || parseInt(process.env.SLIDING_WINDOW_SECONDS);

    return async (req, res, next) => {
        try {
            const clientIP = req.ip;

            // 1. Check IP Filters
            const blacklisted = await isBlacklisted(clientIP);
            const whitelisted = await isWhitelisted(clientIP);

            // 2. Determine Rule
            const dynamicRule = await getRule(req.path);
            const algorithm = dynamicRule?.algorithm || staticAlgorithm;
            const max = dynamicRule?.max || staticMax;
            const window = dynamicRule?.window || staticWindow;

            let result = { allowed: true, remaining: max, limit: max, count: 0 };

            if (blacklisted) {
                result = { allowed: false, remaining: 0, limit: max, count: max, reason: 'blacklisted' };
            } else if (whitelisted) {
                result = { allowed: true, remaining: max, limit: max, count: 0, reason: 'whitelisted' };
            } else {
                if (algorithm === 'token') {
                    result = await tokenBucketLimiter(clientIP, max);
                } else if (algorithm === 'sliding') {
                    result = await sliddingWindowLimiter(clientIP, max, window);
                } else {
                    result = await fixedWindowLimiter(clientIP, max, window);
                }
            }

            const { allowed, remaining, limit, count } = result;

            // 3. Emit to Dashboard (DO THIS FOR ALL REQUESTS)
            getIO()?.emit('request-log', {
                ip: clientIP,
                method: req.method,
                route: req.path,
                algorithm: blacklisted ? 'N/A' : algorithm,
                allowed,
                count: count || 0,
                limit,
                remaining,
                timestamp: new Date().toISOString(),
                statusCode: blacklisted ? 403 : (allowed ? 200 : 429)
            });

            // 4. Handle Response
            if (blacklisted) {
                logger.warn('Blocked blacklisted IP', { ip: clientIP, route: req.path });
                return res.status(403).json({ error: 'Forbidden', message: 'your IP has been blacklisted' });
            }

            if (whitelisted) {
                logger.info('Whitelisted IP bypass', { ip: clientIP });
                return next();
            }

            // Set Headers
            const resetTime = Math.ceil(Date.now() / 1000) + window;
            res.setHeader('RateLimit-Limit', limit);
            res.setHeader('RateLimit-Remaining', remaining);
            res.setHeader('RateLimit-Reset', resetTime);
            res.setHeader('Retry-After', window);
            res.setHeader('X-RateLimit-Algorithm', algorithm);
            res.setHeader('X-RateLimit-Count', count ?? 0);

            if (!allowed) {
                logger.warn('Rate limit exceeded', {
                    ip: clientIP,
                    route: req.path,
                    algorithm,
                    count,
                    limit,
                    configSource: dynamicRule ? 'redis' : 'static'
                });
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
            logger.error('Rate limiter error', { error: err.message });
            next();
        }
    }
}
export default rateLimiter;