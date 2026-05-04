import { client } from "../../redisClient.js";
import { readFileSync } from 'fs';
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import logger from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url));


const luaScript = readFileSync(
    join(__dirname, '../../src/scripts/tokenBucket.lua'),
    'utf8'
);
// SHA of loaded script — stored once, reused forever
// null initially — gets set when script is loaded into Redis
let scriptSha = null;

// Load script into Redis once at startup
// Returns SHA hash of the script
export const loadLuaScripts = async () => {
    try {
        scriptSha = await client.scriptLoad(luaScript);
        logger.info('Lua scripts loaded into Redis', { sha: scriptSha });
    } catch (err) {
        logger.error('Failed to load Lua scripts', { error: err.message });
        throw err;
    }
};
const tokenBucketLimiter = async (
    clientIP,
    maxRequests = parseInt(process.env.BUCKET_CAPACITY),
) => {
    const capacity = maxRequests;
    const refillRate = parseFloat(process.env.REFILL_RATE);
    const now = Math.floor(Date.now() / 1000);  // seconds
    const ttl = 3600;  // 1 hour auto-cleanup

    const key = `token_bucket:${clientIP}`;

    try {
        // Call Lua script by SHA
        // Arguments: numKeys, key, capacity, refillRate, now, ttl
        const result = await client.evalSha(scriptSha, {
            keys: [key],
            arguments: [
                capacity.toString(),
                refillRate.toString(),
                now.toString(),
                ttl.toString()
            ]
        });
        // Result is array: [allowed, tokens, capacity]
        const allowed = result[0] === 1;
        const tokens = Math.floor(parseFloat(result[1]));
        const cap = parseInt(result[2]);

        return {
            allowed,
            tokens,
            capacity: cap,
            remaining: tokens,
            limit: cap,
            count: cap - tokens
        };

    } catch (err) {
        // If EVALSHA fails (e.g. script was flushed from Redis)
        // Reload script and retry once
        if (err.message.includes('NOSCRIPT')) {
            logger.warn('Lua script not found in Redis, reloading...');
            await loadLuaScripts();

            // Retry the call
            return tokenBucketLimiter(clientIP, maxRequests);
        }
        throw err;
    }
};


// const tokenBucketLimiter = async (clientIP, capacity = parseInt(process.env.BUCKET_SIZE), window = null) => {
//     // If a window is provided, derive refillRate so the bucket fully refills over `window` seconds
//     // Otherwise fall back to the env var
//     const refillRate = window ? capacity / window : parseInt(process.env.REFILL_RATE);
//     // Include capacity & window in key so each per-route config gets its own isolated bucket
//     const bucketId = `${capacity}_${window || 'default'}`;
//     const key = `token_bucket:${clientIP}:${bucketId}`;
//     const now = Date.now() / 1000; //in sec

//     //get existing bucket form redis
//     const data = await client.get(key);

//     let tokens;
//     let lastRefill;

//     if (!data) {
//         //first req from this ip- start with full bucket
//         tokens = capacity;
//         lastRefill = now;
//     } else {
//         //existing bucket
//         const parsed = JSON.parse(data);
//         tokens = Math.min(capacity, parsed.tokens); // clamp in case capacity changed
//         lastRefill = parsed.lastRefill;
//     }
//     //how many tokens to add since last req (keep fractional so slow rates accumulate)
//     const timePassed = now - lastRefill;
//     const tokensToAdd = timePassed * refillRate;
//     tokens = Math.min(capacity, tokens + tokensToAdd);
//     // Only advance lastRefill by the time consumed to produce those tokens
//     // so leftover fractional time carries forward to the next request
//     lastRefill = lastRefill + tokensToAdd / refillRate;

//     const allowed = tokens >= 1; // need at least 1 full token

//     if (allowed) {
//         tokens -= 1; //consume token
//     }
//     //save update token  to redis
//     await client.setEx(
//         key,
//         3600,
//         JSON.stringify({ tokens, lastRefill })
//     );

//     return {
//         allowed,
//         tokens: Math.max(0, Math.floor(tokens)),  // floor for display
//         capacity,
//         limit: capacity,
//         remaining: Math.max(0, Math.floor(tokens)),
//         count: capacity - Math.max(0, Math.floor(tokens))
//     };
// };

export default tokenBucketLimiter;