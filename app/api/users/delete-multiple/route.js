import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import User from '@/lib/models/User';
import EmployeeProfile from '@/lib/models/EmployeeProfile';
import DataRecord from '@/lib/models/DataRecord';

export async function POST(request) {
  try {
    await dbConnect();
    const user = await getSession(request);
    if (!user) {
      return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
    }

    if (!checkRole(user, ['ROLE_ADMIN'])) {
      return NextResponse.json({ message: 'Lỗi: Bạn không có quyền truy cập.' }, { status: 403 });
    }

    const ids = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ message: 'Danh sách ID rỗng!' }, { status: 400 });
    }

    for (const id of ids) {
      const userExists = await User.exists({ _id: id });
      if (userExists) {
        // Reassign assigned records to null
        await DataRecord.updateMany(
          { assignedTo: id },
          {
            $set: {
              assignedTo: null,
              assignedToName: null
            }
          }
        );
        // Delete User and EmployeeProfile
        await User.findByIdAndDelete(id);
        await EmployeeProfile.findByIdAndDelete(id);
      }
    }

    return NextResponse.json({ message: 'Đã xóa danh sách nhân viên thành công!' });
  } catch (error) {
    console.error('>>> POST /api/users/delete-multiple error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
