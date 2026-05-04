import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { connectRedis } from './redisClient.js';
import rateLimiter from './src/middleware/rateLimiter.js';
import adminRoutes from './src/routes/admin.js';
import statsRoutes from './src/routes/stats.js';
import logger from './src/utils/logger.js';
import { loadLuaScripts } from './src/limiters/tokenBucket.js';

const app = express();
app.use(helmet());
app.set('trust proxy', false);

app.use(express.json({ limit: '10kb' })); //limit request body size to prevent large payloads attacks

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

//admin endpoints
app.use('/admin', adminRoutes);
//stats endpoint
app.use('/stats', statsRoutes);

//global error handling
app.use((err, req, res, next) => {
    logger.error('unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
    });
    res.status(500).json({ error: 'internal server error' })
});

const start = async () => {
    await connectRedis();
    await loadLuaScripts();
    app.listen(process.env.PORT, () => {
        logger.info(`Server running on http://localhost:${process.env.PORT}`);
    });
};

start().catch((err) => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
});