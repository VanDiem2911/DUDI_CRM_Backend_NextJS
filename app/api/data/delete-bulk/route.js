import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
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

    const result = await DataRecord.deleteMany({ _id: { $in: ids } });

    return NextResponse.json({
      message: `Đã xóa ${result.deletedCount} data thành công!`
    });
  } catch (error) {
    console.error('>>> POST /api/data/delete-bulk error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
