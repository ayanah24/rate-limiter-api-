import { client } from "../../redisClient.js";

const tokenBucketLimiter = async (clientIP) => {
    const capacity = parseInt(process.env.BUCKET_CAPACITY);
    const refillRate = parseInt(process.env.REFILL_RATE);
    const key = `token_bucket:${clientIP}`;
    const now = Date.now() / 1000;

    //get existing bucket form redis
    const data = await client.get(key);

    let tokens;
    let lastRefill;

    if (!data) {
        //first req from this ip- start with full bucket
        tokens = capacity;
        lastRefill = now;
    } else {
        //existing bucket
        const parsed = JSON.parse(data);
        tokens = parsed.tokens;
        lastRefill = parsed.lastRefill;
    }
    //how many tokens to add since last req
    const timePassed = now - lastRefill;
    const tokensToAdd = Math.floor(timePassed * refillRate);
    tokens = Math.min(capacity, tokens + tokensToAdd);
    lastRefill = now;

    const allowed = tokens >= 1;

    if (allowed) {
        tokens -= 1; //consume token
    }
    //save update token  to redis
    await client.setEx(
        key,
        3600,
        JSON.stringify({ tokens, lastRefill })
    );

    return {
        allowed,
        tokens,
        remaining: Math.floor(tokens)
    };
};

export default tokenBucketLimiter;