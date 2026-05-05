// Shared Socket.io instance
// Kept in its own file to avoid circular dependency:
// app.js and rateLimiter.js both need io, but app.js imports rateLimiter.js
// If rateLimiter.js imported app.js, that would be a circular import → io = undefined

let io = null;

export const setIO = (ioInstance) => {
    io = ioInstance;
};

export const getIO = () => io;
