import express from 'express';
import adminAuth from '../middleware/adminAuth.js';
import { validate, ipSchema } from '../utils/validators.js';
import {
    blacklistIP,
    whitelistIP,
    removeFromBlacklist,
    removeFromWhitelist,
    getBlacklistedIPs,
    getWhitelistedIPs,
} from '../utils/ipFilter.js';
import logger from '../utils/logger.js';
import { getRule, setRule, deleteRule, getAllRules } from '../config/ruleCache.js';
import { z } from 'zod';
const router = express.Router();
//schema to validators or define inline
const ruleSchema = z.object({
    route: z.string().startsWith('/'),  // must be a path like /api/login
    max: z.number().int().positive().max(10000),
    window: z.number().int().positive().max(86400),
    algorithm: z.enum(['fixed', 'token', 'sliding']).optional().default('sliding')
});

// GET /admin/config — view all dynamic rules
router.get('/config', async (req, res) => {
    try {
        const rules = await getAllRules();
        res.json({ rules });
    } catch (err) {
        logger.error('Failed to get config rules', { error: err.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /admin/config — set a rule for a route
router.post('/config', validate(ruleSchema), async (req, res) => {
    try {
        const { route, max, window, algorithm } = req.body;

        const success = await setRule(route, { max, window, algorithm });

        if (success) {
            logger.info('Dynamic config rule set', { route, max, window, algorithm, by: req.ip });
            res.json({
                message: `Rule set for ${route}`,
                rule: { max, window, algorithm }
            });
        } else {
            res.status(500).json({ error: 'Failed to set rule' });
        }
    } catch (err) {
        logger.error('Failed to set config rule', { error: err.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /admin/config — delete a rule (revert to defaults)
router.delete('/config', async (req, res) => {
    try {
        const { route } = req.body;
        await deleteRule(route);
        res.json({ message: `Rule deleted for ${route}, reverted to defaults` });
    } catch (err) {
        logger.error('Failed to delete config rule', { error: err.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});


// No rate limiter here — blacklisted IPs must be able to unblacklist themselves.
router.use(adminAuth);

router.get('/lists', async (req, res) => {
    try {
        const [blacklist, whitelist] = await Promise.all([
            getBlacklistedIPs(),
            getWhitelistedIPs()
        ]);
        logger.info('Admin requested lists', { ip: req.ip });
        res.json({ blacklist, whitelist });
    } catch (error) {
        logger.error('Failed to fetch IP list', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/blacklist', validate(ipSchema), async (req, res) => {
    try {
        const { ip } = req.body;
        await blacklistIP(ip);

        logger.warn('IP blacklisted', { ip, by: req.ip });
        res.json({ message: `${ip} blacklisted successfully` });
    } catch (err) {
        logger.error('Error blacklisting ip', { error: err.message });
        res.status(500).json({ error: 'internal server error' })
    }
});

router.post('/whitelist', validate(ipSchema), async (req, res) => {
    try {
        const { ip } = req.body;
        await whitelistIP(ip);

        logger.warn('IP whitelisted', { ip, by: req.ip });
        res.json({ message: `${ip} whitelisted successfully` });
    } catch (err) {
        logger.error('Error whitelisting ip', { error: err.message });
        res.status(500).json({ error: 'internal server error' })
    }
});

router.delete('/blacklist', validate(ipSchema), async (req, res) => {
    try {
        const { ip } = req.body;
        await removeFromBlacklist(ip);
        logger.warn('IP removed from blacklist', { ip, by: req.ip });
        res.json({ message: `${ip}removed from blacklist` });
    } catch (err) {
        logger.error('Error removing from blacklist', { error: err.message });
        res.status(500).json({ error: 'internal server error' })
    }
});

router.delete('/whitelist', validate(ipSchema), async (req, res) => {
    try {
        const { ip } = req.body;
        await removeFromWhitelist(ip);
        logger.warn('IP removed from whitelist', { ip, by: req.ip });
        res.json({ message: `${ip}removed from whitelist` });
    } catch (err) {
        logger.error('Error removing from whitelist', { error: err.message });
        res.status(500).json({ error: 'internal server error' })
    }
});

export default router;  