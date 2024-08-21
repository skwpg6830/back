const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';

const authMiddleware = (req, res, next) => {
  // 從 Authorization 標頭中提取 token，預期格式為 "Bearer <token>"
  const authorizationHeader = req.headers.authorization;

  // 檢查是否提供了 Authorization 標頭
  if (!authorizationHeader) {
    return res.status(401).send('未提供 Authorization 標頭');
  }

  // 分割 Authorization 標頭並提取 token
  const token = authorizationHeader.split(' ')[1];
  
  // 如果沒有 token，則返回 401 錯誤
  if (!token) {
    return res.status(401).send('未提供 token');
  }

  try {
    // 驗證並解碼 token
    const decoded = jwt.verify(token, SECRET_KEY);

    // 將解碼後的用戶信息附加到 req.user 上
    req.user = decoded; // 這裡包括 userId, role, 以及其他信息

    // 調用 next() 繼續處理請求
    next();
  } catch (error) {
    // 如果 token 無效，則返回 403 錯誤
    res.status(403).send('無效的 token');
  }
};

module.exports = authMiddleware;
