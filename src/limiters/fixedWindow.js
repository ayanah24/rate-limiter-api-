import { client } from '../../redisClient.js';

const fixedWindowLimiter = async (clientIP) => {
    const windowSize = parseInt(process.env.WINDOW_SIZE);
    const maxRequests = parseInt(process.env.MAX_REQUESTS);
    // calculating the current window ID (cycles every windowSize seconds)
    const windowId = Math.floor(Date.now() / 1000 / windowSize);

    const key = `${clientIP}:${windowId}`;
    // incr atomically increments the key and returns the NEW value
    const cnt = await client.incr(key);

    if (cnt === 1) {
        // set expiry on first request
        await client.expire(key, windowSize);
    }
    const ttl = await client.ttl(key);
    return {
        allowed: cnt <= maxRequests,
        cnt,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - cnt),
        retryAfter: ttl > 0 ? ttl : windowSize
    };
};

export default fixedWindowLimiter;
