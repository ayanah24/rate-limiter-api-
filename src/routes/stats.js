import express from 'express';
import { client } from '../../redisClient.js';

const router = express.Router();

// GET /stats/:ip — returns rate limit stats for a given IP across all 3 algorithms
router.get('/:ip', async (req, res) => {
    try {
        const ip = req.params.ip;
        const windowSize = parseInt(process.env.SLIDING_WINDOW_SECONDS);
        const now = Date.now();
        const windowStart = now - (windowSize * 1000);

        // Build redis keys for all 3 algorithms
        const slidingKey = `sliding_window:${ip}`;
        const fixedWindowId = Math.floor(Date.now() / 1000 / parseInt(process.env.WINDOW_SIZE));
        const fixedKey = `rate_limit:${ip}:${fixedWindowId}`;
        const tokenKey = `token_bucket:${ip}`;

        // Fetch all data from Redis in parallel
        const [slidingCount, fixedCount, tokenCount] = await Promise.all([
            client.zCount(slidingKey, windowStart, now),
            client.get(fixedKey),
            client.get(tokenKey),
        ]);

        // Parse token bucket
        const tokenParsed = tokenCount ? JSON.parse(tokenCount) : null;

        res.json({
            ip,
            timestamp: new Date().toISOString(),
            algorithms: {
                slidingWindow: {
                    requestsInWindow: slidingCount || 0,
                    limit: parseInt(process.env.SLIDING_MAX_REQUESTS),
                    remaining: Math.max(0, parseInt(process.env.SLIDING_MAX_REQUESTS) - slidingCount),
                    windowSize,
                },
                fixedWindow: {
                    requestsInWindow: parseInt(fixedCount) || 0,
                    limit: parseInt(process.env.MAX_REQUESTS),
                    remaining: Math.max(0, parseInt(process.env.MAX_REQUESTS) - (parseInt(fixedCount) || 0)),
                },
                tokenBucket: {
                    tokensRemaining: tokenParsed ? Math.floor(tokenParsed.tokens) : parseInt(process.env.BUCKET_CAPACITY),
                    capacity: parseInt(process.env.BUCKET_CAPACITY),
                    lastRefill: tokenParsed ? new Date(tokenParsed.lastRefill * 1000).toISOString() : null,
                },
            },
        });
    } catch (error) {
        console.error('Stats route error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
