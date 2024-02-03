const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log(authHeader); // Add this line to log the Authorization header

  const token = authHeader && authHeader.split(' ')[1]; // Extract token from Bearer scheme
  if (token == null) {
    console.log('Token is undefined for request to:', req.path);
    return res.sendStatus(401); // Adjust based on your handling of unauthenticated requests
  }
  
  jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Token verification failed
    req.user = user;
    next();
  });
};

module.exports = authenticate;
