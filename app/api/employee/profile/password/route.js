import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import User from '@/lib/models/User';

export async function PATCH(request) {
  try {
    await dbConnect();
    const user = await getSession(request);
    if (!user) {
      return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
    }

    if (!checkRole(user, ['ROLE_EMPLOYEE'])) {
      return NextResponse.json({ message: 'Lỗi: Bạn không có quyền truy cập.' }, { status: 403 });
    }

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ message: 'Vui lòng nhập đầy đủ mật khẩu' }, { status: 400 });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return NextResponse.json({ message: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ message: 'Xác nhận mật khẩu mới không khớp' }, { status: 400 });
    }

    if (newPassword.trim().length < 4) {
      return NextResponse.json({ message: 'Mật khẩu mới tối thiểu 4 ký tự' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // We must find by id and update
    await User.findByIdAndUpdate(user._id, { password: hashedPassword });

    return NextResponse.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('>>> PATCH /api/employee/profile/password error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
