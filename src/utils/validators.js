import { z } from 'zod';
//ip address schema
export const ipSchema = z.object({
    ip: z.union([z.ipv4(), z.ipv6()], {
        error: 'Must be a valid IPv4 or IPv6 address',
    })
});

export const rateLimitConfigSchema = z.object({
    max: z.number()
        .int()
        .positive()
        .max(10000, 'Max limit is 10000'),

    window: z.number()
        .int()
        .positive()
        .max(86400, 'window cannot exceed 24 hrs'),

    algorithm: z.enum(['fixed', 'token', 'sliding'])
        .optional()
        .default('sliding')
});

//validate middleware 
//schema ,returns a mddleware taht validates req.body against it
export const validate = (schema) => {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (err) {
            return res.status(400).json({
                error: 'Validation error',
                details: (err.issues ?? err.errors ?? []).map(e => ({
                    field: e.path.join('.'),
                    message: e.message
                }))
            })
        }
    }
};