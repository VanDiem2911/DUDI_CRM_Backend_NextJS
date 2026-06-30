import jwt from 'jsonwebtoken';
import dbConnect from './db';
import User from './models/User';

const JWT_SECRET = process.env.JWT_SECRET || '=======================DudiChiaDataSecretKeyJWTTokenSigningKey2026======================';

export async function getSession(req) {
  try {
    await dbConnect();
    
    // In Next.js App Router, req is either a NextRequest or Request.
    // We can get headers using req.headers.get('authorization').
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS512'] });
    
    if (!decoded || !decoded.sub) {
      return null;
    }
    
    const user = await User.findOne({ username: decoded.sub });
    if (!user || !user.active) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('>>> getSession verification failed:', error.message);
    return null;
  }
}

export function checkRole(user, allowedRoles) {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}
