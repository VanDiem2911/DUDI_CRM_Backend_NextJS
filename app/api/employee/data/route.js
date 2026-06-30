import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import DataRecord from '@/lib/models/DataRecord';

export async function GET(request) {
  try {
    await dbConnect();
    const user = await getSession(request);
    if (!user) {
      return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
    }

    if (!checkRole(user, ['ROLE_EMPLOYEE'])) {
      return NextResponse.json({ message: 'Lỗi: Bạn không có quyền truy cập.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '0', 10);
    const size = parseInt(searchParams.get('size') || '10', 10);

    const employeeId = user._id.toString();
    const query = { assignedTo: employeeId };

    if (status && status.trim()) {
      query.status = status;
    }

    if (search && search.trim()) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const [total, records] = await Promise.all([
      DataRecord.countDocuments(query),
      DataRecord.find(query)
        .sort({ updatedAt: -1 })
        .skip(page * size)
        .limit(size)
        .lean()
    ]);

    return NextResponse.json({
      content: records.map(record => ({ ...record, id: record._id })),
      totalElements: total,
      totalPages: Math.ceil(total / size),
      number: page,
      size: size
    });
  } catch (error) {
    console.error('>>> GET /api/employee/data error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
