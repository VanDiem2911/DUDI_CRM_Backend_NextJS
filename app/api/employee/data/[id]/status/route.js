import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import DataRecord from '@/lib/models/DataRecord';

export async function PATCH(request, { params }) {
  try {
    await dbConnect();
    const user = await getSession(request);
    if (!user) {
      return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
    }

    if (!checkRole(user, ['ROLE_EMPLOYEE'])) {
      return NextResponse.json({ message: 'Lỗi: Bạn không có quyền truy cập.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const record = await DataRecord.findById(id);
    if (!record) {
      return NextResponse.json({ message: 'Không tìm thấy data' }, { status: 404 });
    }

    const employeeId = user._id.toString();
    if (!record.assignedTo || record.assignedTo !== employeeId) {
      return NextResponse.json(
        { message: 'Lỗi: Bạn không được phép cập nhật dữ liệu của nhân viên khác.' },
        { status: 403 }
      );
    }

    if (status !== undefined && status.trim() !== '') {
      record.status = status;
    }
    
    await record.save();
    return NextResponse.json(record);
  } catch (error) {
    console.error('>>> PATCH /api/employee/data/[id]/status error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
