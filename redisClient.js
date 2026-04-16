import 'dotenv/config';
import { createClient } from 'redis';

const client = createClient({
    url: process.env.REDIS_URL
});

client.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

client.on('connect', () => {
    console.log('Redis connected successfully');
});

const connectRedis = async () => {
    try {
        await client.connect();
    } catch (error) {
        console.error('Redis connection failed:', error);
        process.exit(1);
    }
};

export { client, connectRedis };
