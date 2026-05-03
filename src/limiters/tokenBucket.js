import { client } from "../../redisClient.js";

const tokenBucketLimiter = async (clientIP, capacity = parseInt(process.env.BUCKET_SIZE), window = null) => {
    // If a window is provided, derive refillRate so the bucket fully refills over `window` seconds
    // Otherwise fall back to the env var
    const refillRate = window ? capacity / window : parseInt(process.env.REFILL_RATE);
    // Include capacity & window in key so each per-route config gets its own isolated bucket
    const bucketId = `${capacity}_${window || 'default'}`;
    const key = `token_bucket:${clientIP}:${bucketId}`;
    const now = Date.now() / 1000; //in sec

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
        tokens = Math.min(capacity, parsed.tokens); // clamp in case capacity changed
        lastRefill = parsed.lastRefill;
    }
    //how many tokens to add since last req (keep fractional so slow rates accumulate)
    const timePassed = now - lastRefill;
    const tokensToAdd = timePassed * refillRate;
    tokens = Math.min(capacity, tokens + tokensToAdd);
    // Only advance lastRefill by the time consumed to produce those tokens
    // so leftover fractional time carries forward to the next request
    lastRefill = lastRefill + tokensToAdd / refillRate;

    const allowed = tokens >= 1; // need at least 1 full token

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
        tokens: Math.max(0, Math.floor(tokens)),  // floor for display
        capacity,
        limit: capacity,
        remaining: Math.max(0, Math.floor(tokens)),
        count: capacity - Math.max(0, Math.floor(tokens))
    };
};

export default tokenBucketLimiter;