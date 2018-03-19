const { clearHash } = require('../services/cache');

module.exports = async (req, res, next) => {
    // this is a cool trick, that assures this middleware is executed AFTER the request handler has been resolved\
    await next();
    clearHash(req.user.id);
};