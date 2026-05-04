import { client } from '../../redisClient.js';
import logger from '../utils/logger.js';

const cache = {};

const CACHE_TTL = parseInt(process.env.CONFIG_CACHE_TTL || 60) * 1000;

export const getRule = async (route) => {
    //memory check
    const cached = cache[route];

    if (cached && (cached.expiresAt > Date.now())) {
        logger.debug(`cache hit for ${route}`);
        return cached.value;
    }
    try {
        const data = await client.get(`config:rule:${route}`);
        if (data) {
            const rule = JSON.parse(data);

            cache[route] = {
                value: rule,
                expiresAt: Date.now() + CACHE_TTL
            };
            logger.info('config loaded from redis', { route, rule });
            return rule;
        }
        return null;

    } catch (err) {
        logger.error('Failed to read config from Redis', { error: err.message });
        return null;
    }

};

// Set a rule for a specific route
export const setRule = async (route, rule) => {
    try {
        // Store in Redis as JSON string
        await client.set(
            `config:rule:${route}`,
            JSON.stringify(rule)
        );


        delete cache[route];

        logger.info('Config rule updated', { route, rule });
        return true;

    } catch (err) {
        logger.error('Failed to set config rule', { error: err.message });
        return false;
    }
};

// Delete a rule (revert to env defaults)
export const deleteRule = async (route) => {
    try {
        await client.del(`config:rule:${route}`);
        delete cache[route];  // invalidate cache
        logger.info('Config rule deleted', { route });
        return true;
    } catch (err) {
        logger.error('Failed to delete config rule', { error: err.message });
        return false;
    }
};

// Get all rules from Redis
export const getAllRules = async () => {
    try {
        // KEYS pattern matching — find all config:rule:* keys
        const keys = await client.keys('config:rule:*');

        if (keys.length === 0) return {};

        // Get all values in parallel
        const values = await Promise.all(keys.map(k => client.get(k)));

        // Build result object { route: rule }
        const rules = {};
        keys.forEach((key, i) => {
            const route = key.replace('config:rule:', '');
            rules[route] = JSON.parse(values[i]);
        });

        return rules;

    } catch (err) {
        logger.error('Failed to get all rules', { error: err.message });
        return {};
    }
};