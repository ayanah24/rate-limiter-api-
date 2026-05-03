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

const router = express.Router();
// Admin routes are protected by the admin secret key only.
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