import 'dotenv/config';
import express from 'express';
import { connectRedis } from './redisClient.js';
import rateLimiter from './src/middleware/rateLimiter.js';

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


app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
    connectRedis();
});
