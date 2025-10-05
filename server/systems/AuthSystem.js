// server/systems/AuthSystem.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const AuthSystem = {
  async registerUser({ username, password }) {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return { ok: false, status: 400, message: '此使用者名稱已被註冊' };
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    return { ok: true, status: 201, message: '註冊成功' };
  },

  async loginUser({ username, password, jwtSecret }) {
    const user = await User.findOne({ username });
    if (!user) return { ok: false, status: 400, message: '使用者名稱或密碼錯誤' };
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return { ok: false, status: 400, message: '使用者名稱或密碼錯誤' };

    const token = jwt.sign({ userId: user._id, username: user.username }, jwtSecret, { expiresIn: '1h' });
    return { ok: true, status: 200, message: '登入成功', token };
  },

  verifySocketJWT(socket, next, jwtSecret) {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) return next(new Error('Invalid token'));
      socket.username = decoded.username;
      next();
    });
  }
};
