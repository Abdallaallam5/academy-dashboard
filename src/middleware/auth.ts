import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { HttpError } from '../utils/http';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  try {
    jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    next(new HttpError(401, 'سجّل دخول الأول'));
  }
};
