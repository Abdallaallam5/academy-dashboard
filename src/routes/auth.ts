import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';
import { HttpError, wrap } from '../utils/http';

export const authRouter = Router();

authRouter.post('/login', wrap(async (req, res) => {
  const { username, password } = z.object({ username: z.string(), password: z.string() }).parse(req.body);
  if (username !== config.adminUser || password !== config.adminPass) throw new HttpError(401, 'اسم المستخدم أو كلمة السر غلط');
  const token = jwt.sign({ u: username }, config.jwtSecret, { expiresIn: '12h' });
  res.json({ token, academyName: config.academyName });
}));
