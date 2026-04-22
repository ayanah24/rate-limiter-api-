import 'dotenv/config';
import express from 'express';
import { connectRedis } from './redisClient.js';
import rateLimiter from './src/middleware/rateLimiter.js';
import { parse } from 'dotenv';

const app = express();
app.use(express.json());
app.use(rateLimiter);


app.get('/', (req, res) => {
    res.json({
        message: 'success',
        info: 'check X-RateLimit-Remaining in response headers'
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok'
    });
});

app.get('/stats/:ip', async (req, res) => {
    const ip = req.params.ip;
});

const windowSize = parseInt(process.env.SLIDING_WINDOW_SECONDS);
const now = Date.now();
const windowStart = now - (windowSize * 1000);

//built redis key for all 3 algo
const slidingKey = `sliding_window:${ip}`;
const fixedWindowId = Math.floor(Date.now() / 1000 / parseInt(process.env.WINDOW_SIZE));
const fixedkey = `rate_limit:${ip}:${fixedWindowId}`;
const tokenKey = `token_bucket:${ip}`;

//fetch all data from redis all 3 algo parallelly
const [slidingCount, fixedCount, tokenCount] = await Promise.all([
    client.zCount(slidingKey, windowStart, now),
    client.get(fixedkey),
    client.get(tokenKey),
]);

//parse token bucket
const tokenParsed = tokenData ? JSON.parse(tokenData) : null;

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
            limit: parseInt(process.env.SLIDING_MAX_REQUESTS),
            remaining: Math.max(0, parseInt(process.env.MAX_REQUEST) - parseInt(fixedCount) || 0),
        },
        tokenBucket: {
            tokenRemaining: tokenParsed ? Math.floor(tokenParsed.tokens) : parseInt(process.env.BUCKET_CAPACITY),
            capacity: parseInt(process.env.BUCKET_CAPACITY),
            lastRefill: tokenParsed ? new Date(tokenParsed.lastRefill * 1000).toISOString() : null
        }
    }
});


app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
    connectRedis();
});
