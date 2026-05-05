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

// Dashboard calls this on load to get initial summary
router.get('/', async (req, res) => {
  try {
    const windowSize = parseInt(process.env.SLIDING_WINDOW_SECONDS);
    const now = Date.now();
    const windowStart = now - (windowSize * 1000);

    // Get all sliding window keys
    const keys = await client.keys('sliding_window:*');

    // Build per-IP stats
    const ipStats = await Promise.all(
      keys.map(async (key) => {
        const ip = key.replace('sliding_window:', '');
        const count = await client.zCount(key, windowStart, now);
        return { ip, count };
      })
    );

    // Filter out IPs with 0 requests in window
    const activeIPs = ipStats.filter(s => s.count > 0);

    res.json({
      activeIPs: activeIPs.length,
      ipStats: activeIPs,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    logger.error('Failed to fetch summary stats', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
