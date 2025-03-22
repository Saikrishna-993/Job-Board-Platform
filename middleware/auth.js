const passport = require('passport');

exports.authenticateJWT = passport.authenticate('jwt', { session: false });

exports.authorizeEmployer = (req, res, next) => {
  if (req.user && req.user.role === 'employer') {
    return next();
  }
  
  return res.status(403).json({
    error: true,
    message: 'Access denied. Employers only.'
  });
};

exports.authorizeCandidate = (req, res, next) => {
  if (req.user && req.user.role === 'candidate') {
    return next();
  }
  
  return res.status(403).json({
    error: true,
    message: 'Access denied. Candidates only.'
  });
};

exports.authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  return res.status(403).json({
    error: true,
    message: 'Access denied. Admins only.'
  });
};