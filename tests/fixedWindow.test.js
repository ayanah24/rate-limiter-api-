import { beforeEach, jest } from '@jest/globals';

// ESM requires unstable_mockModule + dynamic import (jest.mock doesn't work in ESM)
jest.unstable_mockModule('../redisClient.js', () => ({
    client: {
        incr: jest.fn(),
        expire: jest.fn(),
    },
}));

const { client } = await import('../redisClient.js');
const { default: fixedWindowLimiter } = await import('../src/limiters/fixedWindow.js');

// describe() groups related test cases
describe('Fixed window rate limiter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.MAX_REQUESTS = '10';
        process.env.WINDOW_SIZE_SECONDS = '60';
    });
    // it() defines one test case
    it('Should allow request when under rate limit', async () => {
        //Arrange
        client.incr.mockResolvedValue(5);
        client.expire.mockResolvedValue(1);
        //Act
        const result = await fixedWindowLimiter('192.168.1.1');
        //Assert
        expect(result.allowed).toBe(true);
        expect(result.cnt).toBe(5);
        expect(result.remaining).toBe(5);
        expect(result.limit).toBe(10);

    });
    it('should block request when over limit', async () => {

        // Arrange
        client.incr.mockResolvedValue(11);
        client.expire.mockResolvedValue(1);

        // Act
        const result = await fixedWindowLimiter('192.168.1.1');

        // ASSERT
        // Why allowed: false? count(11) > max(10)
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);  // Math.max(0, 10-11) = 0, not -1
    });
    it('should set expire only on first request', async () => {
        //Arrange
        client.incr.mockResolvedValue(1);
        client.expire.mockResolvedValue(1);
        //Act
        await fixedWindowLimiter('192.168.1.1');
        //Assert
        // count === 1 means first request → set TTL
        expect(client.expire).toHaveBeenCalledTimes(1);
        expect(client.expire).toHaveBeenCalledTimes(1);
        expect(client.expire).toHaveBeenCalledWith(expect.stringContaining('ratelimit:192.168.1.1'), 60);
    });
    it('should not set expire on subsequent requests', async () => {
        //arrange
        client.incr.mockResolvedValue(5);
        client.expire.mockResolvedValue(1);
        //act
        await fixedWindowLimiter('192.168.1.1');
        // count > 1 means not first request → no expire
        expect(client.expire).toHaveBeenCalledTimes(0);
    });
    it('should use diffrent keys for diffrent IPs', async () => {
        //arrange
        client.incr.mockResolvedValue(5);
        client.expire.mockResolvedValue(1);
        //act
        await fixedWindowLimiter('192.168.1.1');
        await fixedWindowLimiter('10.0.0.1');
        //assert
        //incr called twice with diffrent keys
        //each ips have its own counters shoudn't share each others keys
        const calls = client.incr.mock.calls;
        expect(calls[0][0]).toContain('192.168.1.1');
        expect(calls[1][0]).toContain('10.0.0.1');
        expect(calls[0][0]).not.toBe(calls[1][0]);
    });

})