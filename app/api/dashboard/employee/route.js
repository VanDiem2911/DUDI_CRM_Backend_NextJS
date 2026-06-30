import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import DataRecord from '@/lib/models/DataRecord';

const STATUSES = ['Chưa xử lý', 'Chặn người lạ', 'Đã gửi tin nhắn', 'Không có Zalo', 'Trả lời'];

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

    const employeeId = user._id.toString();
    const empRecords = await DataRecord.find({ assignedTo: employeeId });

    let untreated = 0;
    let processing = 0;
    let completed = 0;

    const statusCounts = {};
    for (const status of STATUSES) {
      statusCounts[status] = 0;
    }

    for (const record of empRecords) {
      let status = record.status;
      if (!status || !status.trim()) {
        status = 'Chưa xử lý';
      }
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (status === 'Chưa xử lý') {
        untreated++;
      } else if (status === 'Đã gửi tin nhắn') {
        processing++;
      } else if (status === 'Trả lời') {
        completed++;
      }
    }

    return NextResponse.json({
      totalAssigned: empRecords.length,
      untreatedCount: untreated,
      processingCount: processing,
      completedCount: completed,
      statusCounts,
    });
  } catch (error) {
    console.error('>>> /api/dashboard/employee error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
