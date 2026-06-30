import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import DataRecord from '@/lib/models/DataRecord';
import User from '@/lib/models/User';

export async function PATCH(request) {
  try {
    await dbConnect();
    const user = await getSession(request);
    if (!user) {
      return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
    }

    if (!checkRole(user, ['ROLE_ADMIN'])) {
      return NextResponse.json({ message: 'Lỗi: Bạn không có quyền truy cập.' }, { status: 403 });
    }

    const { dataIds, toEmployeeId } = await request.json();

    if (!Array.isArray(dataIds) || !toEmployeeId) {
      return NextResponse.json({ message: 'Thiếu thông tin dataIds hoặc toEmployeeId' }, { status: 400 });
    }

    const toEmployee = await User.findById(toEmployeeId);
    if (!toEmployee) {
      return NextResponse.json({ message: 'Không tìm thấy nhân viên nhận' }, { status: 404 });
    }

    await DataRecord.updateMany(
      { _id: { $in: dataIds } },
      {
        $set: {
          assignedTo: toEmployee._id.toString(),
          assignedToName: toEmployee.fullName
        }
      }
    );

    return NextResponse.json({
      message: `Đã chuyển giao ${dataIds.length} data sang nhân viên ${toEmployee.fullName} thành công!`
    });
  } catch (error) {
    console.error('>>> PATCH /api/assignments/reassign error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
