import jwt, { type SignOptions } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config.js';

export interface JwtPayload {
  sub: string;
  role: Role;
  sessionId?: string;
  name: string;
  participantId?: string;
}

export function signToken(payload: JwtPayload, expiresIn: SignOptions['expiresIn'] = '24h'): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
