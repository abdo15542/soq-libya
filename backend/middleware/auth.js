const checkAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'غير مصرح، الرجاء تسجيل الدخول' });
  }
  req.userId = userId;
  next();
};

const checkRole = (roles) => (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  if (!roles.includes(userRole)) {
    return res.status(403).json({ error: 'ليس لديك صلاحية للوصول' });
  }
  next();
};

module.exports = { checkAuth, checkRole };
