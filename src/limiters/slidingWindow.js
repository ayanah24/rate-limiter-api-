import { client } from "../../redisClient.js";

const sliddingWindowLimiter = async (clientIP) => {
    const windowSize = parseInt(process.env.SLIDING_WINDOW_SECONDS);
    const maxRequests = parseInt(process.env.SLIDING_MAX_REQUESTS);
    //in ms
    const now = Date.now();
    //window start
    const windowStart = now - (windowSize * 1000);

    const key = `sliding_window:${clientIP}`;
    //manage unique no.
    const requestId = `${now}-${Math.random()}`;

    //reduce network trip from 4 to 1
    const pipeline = client.multi();
    pipeline.zRemRangeByScore(key, '-inf', windowStart);
    pipeline.zAdd(key, { score: now, value: requestId });
    pipeline.zCount(key, windowStart, now);
    pipeline.expire(key, windowSize);

    //execute all commands together
    const results = await pipeline.exec();
    console.log(results);

    //zcnt is at index 2: [zRemRangeByScore, zAdd, zCount, expire]
    const requestCount = results[2];

    const allowed = requestCount <= maxRequests;

    return {
        allowed,
        count: requestCount,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - requestCount),
        windowSeconds: windowSize
    };

};

export default sliddingWindowLimiter;