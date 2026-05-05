import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setIO } from './src/socket.js';
import { connectRedis } from './redisClient.js';
import rateLimiter from './src/middleware/rateLimiter.js';
import adminRoutes from './src/routes/admin.js';
import statsRoutes from './src/routes/stats.js';
import logger from './src/utils/logger.js';
import { loadLuaScripts } from './src/limiters/tokenBucket.js';

const app = express();

app.use(cors({
    origin: 'http://localhost:5173', // Allow dashboard
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Admin-Key']
}));
//http server wrapping express
const httpServer = createServer(app);
//socket.io server
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods: ['GET', 'POST']
    }
});
setIO(io);

app.use(helmet());
app.set('trust proxy', false);

app.use(express.json({ limit: '10kb' })); //limit request body size to prevent large payloads attacks

//socket.io connection handler
io.on('connection', (socket) => {
    logger.info('Dashboard connected', { socketId: socket.id });
    socket.emit('connected', {
        message: 'Welcome to rate limiter dashboard',
        timestamp: new Date().toISOString(),
    });

    socket.on('disconnect', () => {
        logger.info('Dashboard disconnected', { socketId: socket.id });
    });
});

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
    httpServer.listen(process.env.PORT, () => {
        logger.info(`Server running on http://localhost:${process.env.PORT}`);
    });
};

start().catch((err) => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
});