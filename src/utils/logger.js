import winston from "winston";

const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),

    winston.format.colorize(),

    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        //meta is any additional info passed to the logger
        const metaStr = Object.keys(meta).length
            ? `\n${JSON.stringify(meta, null, 2)}`
            : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
    })
);

//logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'logs/combined.log',

            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.uncolorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length
                        ? `\n${JSON.stringify(meta, null, 2)}`
                        : '';
                    return `${timestamp} ${level}: ${message}${metaStr}`;
                })
            )
        }),

        //file write only errors to errors.log
        new winston.transports.File({
            filename: 'logs/errors.log',
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.uncolorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length
                        ? `\n${JSON.stringify(meta, null, 2)}`
                        : '';
                    return `${timestamp} ${level}: ${message}${metaStr}`;
                })
            )
        })
    ]
});

export default logger;