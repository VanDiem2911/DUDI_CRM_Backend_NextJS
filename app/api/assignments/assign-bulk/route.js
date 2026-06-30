import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import DataRecord from '@/lib/models/DataRecord';
import User from '@/lib/models/User';

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

    const { dataIds, employeeId } = await request.json();

    if (!Array.isArray(dataIds) || !employeeId) {
      return NextResponse.json({ message: 'Thiếu thông tin dataIds hoặc employeeId' }, { status: 400 });
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return NextResponse.json({ message: 'Không tìm thấy nhân viên' }, { status: 404 });
    }

    await DataRecord.updateMany(
      { _id: { $in: dataIds } },
      {
        $set: {
          assignedTo: employee._id.toString(),
          assignedToName: employee.fullName
        }
      }
    );

    return NextResponse.json({
      message: `Đã chia ${dataIds.length} data cho nhân viên ${employee.fullName} thành công!`
    });
  } catch (error) {
    console.error('>>> POST /api/assignments/assign-bulk error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
