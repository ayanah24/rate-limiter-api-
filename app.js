import 'dotenv/config';
import express from 'express';
import { connectRedis, client } from './redisClient.js';
import rateLimiter from './src/middleware/rateLimiter.js';
import {
    blacklistIP,
    whitelistIP,
    removeFromBlacklist,
    removeFromWhitelist,
    isBlacklisted,
    isWhitelisted,
    getBlacklistedIPs,
    getWhitelistedIPs
} from './src/utils/ipFilter.js';

const app = express();
app.use(express.json());
//use different limiters per route
app.get('/', rateLimiter({ algorithm: 'sliding', max: 50, window: 60 }), (req, res) => {
    res.json({ message: 'Request successful' });
});

app.post('/api/login', rateLimiter({ algorithm: 'token', max: 5, window: 60 }), (req, res) => {
    res.json({ message: 'Login successful' });
});

app.get('/api/search', rateLimiter({ algorithm: 'token', max: 30, window: 60 }), (req, res) => {
    res.json({ message: 'search endpoints-token bucket,max 30' });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok'
    });
});
//admin endpoints-manage whitelist/blacklist
//protected by auth middleware
app.post('/admin/blacklist', async (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP required' });
    await blacklistIP(ip);
    res.json({ message: `${ip} blacklisted successfully` });
});

app.post('/admin/whitelist', async (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP required' });
    await whitelistIP(ip);
    res.json({ message: `${ip} whitelisted successfully` });
});

app.delete('/admin/blacklist', async (req, res) => {
    const { ip } = req.body;
    await removeFromBlacklist(ip);
    res.json({ message: `${ip} whitelisted successfully` });
});

app.delete('/admin/whitelist', async (req, res) => {
    const { ip } = req.body;
    await removeFromWhitelist(ip);
    res.json({ message: `${ip} whitelisted successfully` });
});

app.get('/admin/lists', async (req, res) => {
    const [blacklistIP, whitelistIP] = await Promise.all([
        getBlacklistedIPs(),
        getWhitelistedIPs()
    ]);
    res.json({ blacklistIP, whitelistIP });
});

//stats endpoint
app.get('/stats/:ip', async (req, res) => {
    const ip = req.params.ip;
    const windowSize = parseInt(process.env.SLIDING_WINDOW_SECONDS);
    const now = Date.now();
    const windowStart = now - (windowSize * 1000);

    // Build redis keys for all 3 algorithms
    const slidingKey = `sliding_window:${ip}`;
    const fixedWindowId = Math.floor(Date.now() / 1000 / parseInt(process.env.WINDOW_SIZE));
    const fixedkey = `rate_limit:${ip}:${fixedWindowId}`;
    const tokenKey = `token_bucket:${ip}`;

    // Fetch all data from redis for all 3 algorithms in parallel
    const [slidingCount, fixedCount, tokenCount] = await Promise.all([
        client.zCount(slidingKey, windowStart, now),
        client.get(fixedkey),
        client.get(tokenKey),
    ]);

    // Parse token bucket
    const tokenParsed = tokenCount ? JSON.parse(tokenCount) : null;

    res.json({
        ip,
        timestamp: new Date().toISOString(),
        algorithms: {
            slidingWindow: {
                requestInWindow: slidingCount || 0,
                limit: parseInt(process.env.SLIDING_MAX_REQUESTS),
                remaining: Math.max(0, parseInt(process.env.SLIDING_MAX_REQUESTS) - slidingCount),
                windowSize: windowSize
            },
            fixedWindow: {
                requestInWindow: parseInt(fixedCount) || 0,
                limit: parseInt(process.env.MAX_REQUESTS),
                remaining: Math.max(0, parseInt(process.env.MAX_REQUESTS) - (parseInt(fixedCount) || 0)),
            },
            tokenBucket: {
                tokenRemaining: tokenParsed ? Math.floor(tokenParsed.tokens) : parseInt(process.env.BUCKET_CAPACITY),
                capacity: parseInt(process.env.BUCKET_CAPACITY),
                lastRefill: tokenParsed ? new Date(tokenParsed.lastRefill * 1000).toISOString() : null
            }
        }
    });
});


app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
    connectRedis();
});
