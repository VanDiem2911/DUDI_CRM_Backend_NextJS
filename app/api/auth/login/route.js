import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';

export async function POST(request) {
  try {
    await dbConnect();
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: 'Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json(
        { message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' },
        { status: 401 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.' },
        { status: 403 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' },
        { status: 401 }
      );
    }

    // Generate JWT
    const jwtExpirationMs = parseInt(process.env.JWT_EXPIRATION_MS || '86400000', 10);
    const secret = process.env.JWT_SECRET || '=======================DudiChiaDataSecretKeyJWTTokenSigningKey2026======================';

    const payload = {
      sub: user.username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + jwtExpirationMs) / 1000)
    };

    const token = jwt.sign(payload, secret, { algorithm: 'HS512' });

    return NextResponse.json({
      token,
      type: 'Bearer',
      id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    });
  } catch (error) {
    console.error('>>> /api/auth/login error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
