import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession } from '@/lib/auth';
import DataRecord from '@/lib/models/DataRecord';

export async function PATCH(request, { params }) {
  try {
    await dbConnect();
    const user = await getSession(request);
    if (!user) {
      return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { id } = await params;
    const { note } = await request.json();

    const record = await DataRecord.findById(id);
    if (!record) {
      return NextResponse.json({ message: 'Không tìm thấy data' }, { status: 404 });
    }

    // Security check: Employee can only update notes of their assigned records, Admins can update any
    const isAdmin = user.role === 'ROLE_ADMIN';
    if (!isAdmin) {
      if (!record.assignedTo || record.assignedTo !== user._id.toString()) {
        return NextResponse.json(
          { message: 'Lỗi: Bạn không được phép cập nhật dữ liệu của nhân viên khác.' },
          { status: 403 }
        );
      }
    }

    record.note = note !== undefined ? note : '';
    await record.save();

    return NextResponse.json(record);
  } catch (error) {
    console.error('>>> PATCH /api/data/[id]/note error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
