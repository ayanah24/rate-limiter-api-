import { jest } from '@jest/globals';

//mocking pipeline 
const mockPipeline = {
    zRemRangeByScore: jest.fn().mockReturnThis(), // for chaining mockReturnThis() means return pipeline itself
    zAdd: jest.fn().mockReturnThis(),
    zCount: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn()
};

jest.unstable_mockModule('../redisClient.js', () => ({
    client: {
        multi: jest.fn(() => mockPipeline)
    }
}));

const { client } = await import('../redisClient.js');
const { default: slidingWindowLimiter } = await import('../src/limiters/slidingWindow.js');

describe('Sliding Window Rate Limiter', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SLIDING_MAX_REQUESTS = '10';
        process.env.SLIDING_WINDOW_SECONDS = '60';

        // Reset pipeline mocks
        mockPipeline.zRemRangeByScore.mockReturnThis();
        mockPipeline.zAdd.mockReturnThis();
        mockPipeline.zCount.mockReturnThis();
        mockPipeline.expire.mockReturnThis();
        client.multi.mockReturnValue(mockPipeline);
    });

    it('should allow request when under limit', async () => {

        // ARRANGE
        // exec() returns array of results from all pipeline commands
        // [ZREMRANGEBYSCORE result, ZADD result, ZCOUNT result, EXPIRE result]
        // We care about index 2 (ZCOUNT) — that's the request count
        mockPipeline.exec.mockResolvedValue([0, 1, 5, 1]);
        //                                        ↑ ZCOUNT returned 5

        // ACT
        const result = await slidingWindowLimiter('192.168.1.1');

        // ASSERT
        expect(result.allowed).toBe(true);
        expect(result.count).toBe(5);
        expect(result.remaining).toBe(5);
    });

    it('should block request when over limit', async () => {

        // ARRANGE — ZCOUNT returns 11 (over limit of 10)
        mockPipeline.exec.mockResolvedValue([0, 1, 11, 1]);

        // ACT
        const result = await slidingWindowLimiter('192.168.1.1');

        // ASSERT
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('should use pipeline for all Redis commands', async () => {

        // ARRANGE
        mockPipeline.exec.mockResolvedValue([0, 1, 3, 1]);

        // ACT
        await slidingWindowLimiter('192.168.1.1');

        // ASSERT — verify all 4 pipeline commands were called
        // If any command is missing  the algorithm is broken
        expect(client.multi).toHaveBeenCalledTimes(1);
        expect(mockPipeline.zRemRangeByScore).toHaveBeenCalledTimes(1);
        expect(mockPipeline.zAdd).toHaveBeenCalledTimes(1);
        expect(mockPipeline.zCount).toHaveBeenCalledTimes(1);
        expect(mockPipeline.expire).toHaveBeenCalledTimes(1);
        expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
    });

    it('should allow exactly limit number of requests', async () => {

        // ARRANGE 
        mockPipeline.exec.mockResolvedValue([0, 1, 10, 1]);

        // ACT
        const result = await slidingWindowLimiter('192.168.1.1');

        // ASSERT 
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0);
    });

    it('should accept custom max and window parameters', async () => {

        // ARRANGE — custom limits passed directly
        mockPipeline.exec.mockResolvedValue([0, 1, 3, 1]);

        // ACT — pass custom max=5, window=30
        const result = await slidingWindowLimiter('192.168.1.1', 5, 30);

        // ASSERT — should use custom values not env defaults
        expect(result.limit).toBe(5);
        expect(result.remaining).toBe(2);
        expect(result.windowSeconds).toBe(30);
    });
});