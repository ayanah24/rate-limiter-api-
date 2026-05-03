import logger from "../utils/logger.js";
//checking if the request is coming from admin 
const adminAuth = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'];

    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        logger.warn('Unauthorised access attempt', {
            ip: req.ip,
            route: req.path,
            provideKey: adminKey ? 'provided but wrong key' : 'not provided'
        });
        return res.status(401).json({
            error: 'Forbidden',
            message: 'Unauthorised',
        });
    }
    logger.info('Admin access granted', {
        ip: req.ip,
        route: req.path,
    });

    next();
};

export default adminAuth;


