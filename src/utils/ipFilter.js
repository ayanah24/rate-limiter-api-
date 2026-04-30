import { client } from "../../redisClient.js";

//IP filters for rate limiter  
const blacklistIP = async (ip) => {
    await client.sAdd('blacklist', ip);
};

const whitelistIP = async (ip) => {
    await client.sAdd('whitelist', ip);
};

const removeFromBlacklist = async (ip) => {
    await client.sRem('blacklist', ip);
};

const removeFromWhitelist = async (ip) => {
    await client.sRem('whitelist', ip);
};

const isBlacklisted = async (ip) => {
    return await client.sIsMember('blacklist', ip);
};

const isWhitelisted = async (ip) => {
    return await client.sIsMember('whitelist', ip);
};

const getBlacklistedIPs = async () => {
    return await client.sMembers('blacklist');
};

const getWhitelistedIPs = async () => {
    return await client.sMembers('whitelist');
};

export {
    blacklistIP,
    whitelistIP,
    removeFromBlacklist,
    removeFromWhitelist,
    isBlacklisted,
    isWhitelisted,
    getBlacklistedIPs,
    getWhitelistedIPs
};
