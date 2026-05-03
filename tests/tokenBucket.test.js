import { expect, jest } from '@jest/globals';

jest.unstable_mockModule('../redisClient.js', () => ({
    client: {
        get: jest.fn(),
        setEx: jest.fn(),
    }
}));

const { client } = await import('../redisClient.js');
const { default: tokenBucketLimiter } = await import('../src/limiters/tokenBucket.js');

describe('Token Bucket Rate Limiter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.BUCKET_SIZE = '10';
        process.env.REFILL_RATE = '1';
    });

    it('should start with full bucket with new IP', async () => {
        //arrange
        client.get.mockResolvedValue(null);
        client.setEx.mockResolvedValue('OK');
        //act
        const result = await tokenBucketLimiter('192.168.1.1');
        //assert
        expect(result.allowed).toBe(true);
        expect(result.tokens).toBe(9);
        expect(result.capacity).toBe(10);

    });

    it('should block request when bucket is empty', async () => {
        const mockBucket = {
            tokens: 0,
            lastRefill: Date.now() / 1000
        };
        //arrange
        client.get.mockResolvedValue(JSON.stringify(mockBucket));
        client.setEx.mockResolvedValue('OK');
        //act
        const result = await tokenBucketLimiter('192.168.1.1');
        //assert
        expect(result.allowed).toBe(false);
    });
    it('should refil tokens based on time passed', async () => {
        const mockBucket = {
            tokens: 0,
            lastRefill: Date.now() / 1000 - 5 //5 sec ago
        };
        //arrange
        // 5 seconds × 1 token/sec = 5 tokens refilled
        // 5 tokens → consume 1 → 4 remaining → allowed
        client.get.mockResolvedValue(JSON.stringify(mockBucket));
        client.setEx.mockResolvedValue('OK');
        //act
        const result = await tokenBucketLimiter('192.168.1.1');
        //assert
        expect(result.allowed).toBe(true);

    });
    it('should not exceed bucket capacity on refill', async () => {
        const mockBucket = {
            tokens: 8,
            lastRefill: Date.now() / 1000 - 100 //100sec ago
        };
        // Without cap: 8 + (100 × 1) = 108 tokens 
        // With cap: Math.min(10, 108) = 10 tokens 
        //arrange
        client.get.mockResolvedValue(JSON.stringify(mockBucket));
        client.setEx.mockResolvedValue('OK');
        //act
        const result = await tokenBucketLimiter('192.168.1.1');
        //assert
        // Without cap: 8 + (100 × 1) = 108 tokens 
        // With cap: Math.min(10, 108) = 10 tokens
        // After consuming 1 for this request: 9 tokens remaining
        expect(result.tokens).toBe(9);
        expect(result.capacity).toBe(10);

    });
});