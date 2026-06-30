import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';

export async function GET(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query || !query.trim()) {
      return NextResponse.json(
        { message: 'Vui lòng nhập tên hoặc số điện thoại' },
        { status: 400 }
      );
    }

    const cleanQuery = query.trim();

    // 1. Try finding by phone first
    const usersByPhone = await User.find({
      role: 'ROLE_EMPLOYEE',
      phone: cleanQuery
    });

    if (usersByPhone.length > 0) {
      const results = usersByPhone.map(u => ({
        fullName: u.fullName,
        username: u.username
      }));
      return NextResponse.json(results);
    }

    // 2. Search by name (case-insensitive regex)
    const usersByName = await User.find({
      role: 'ROLE_EMPLOYEE',
      fullName: { $regex: cleanQuery, $options: 'i' }
    });

    const results = usersByName.map(u => ({
      fullName: u.fullName,
      username: u.username
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('>>> /api/auth/lookup error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
