import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import User from '@/lib/models/User';

export async function PATCH(request, { params }) {
  try {
    await dbConnect();
    const user = await getSession(request);
    if (!user) {
      return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
    }

    if (!checkRole(user, ['ROLE_ADMIN'])) {
      return NextResponse.json({ message: 'Lỗi: Bạn không có quyền truy cập.' }, { status: 403 });
    }

    const { id } = await params;
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ message: 'Không tìm thấy tài khoản nhân viên' }, { status: 404 });
    }

    targetUser.active = !targetUser.active;
    await targetUser.save();

    const status = targetUser.active ? 'mở khóa' : 'khóa';
    return NextResponse.json({
      message: `Đã ${status} tài khoản nhân viên thành công!`
    });
  } catch (error) {
    console.error('>>> PATCH /api/users/[id]/lock error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
