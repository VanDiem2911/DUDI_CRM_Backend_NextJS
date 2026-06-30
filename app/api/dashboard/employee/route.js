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
    const statusGroups = await DataRecord.aggregate([
      { $match: { assignedTo: employeeId } },
      {
        $group: {
          _id: {
            $cond: [
              { $or: [{ $eq: ['$status', null] }, { $eq: ['$status', ''] }] },
              STATUSES[0],
              '$status'
            ]
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {};
    for (const status of STATUSES) {
      statusCounts[status] = 0;
    }
    for (const group of statusGroups) {
      statusCounts[group._id] = group.count;
    }

    const totalAssigned = statusGroups.reduce((sum, group) => sum + group.count, 0);
    const untreated = statusCounts[STATUSES[0]] || 0;
    const processing = statusCounts[STATUSES[2]] || 0;
    const completed = statusCounts[STATUSES[4]] || 0;

    return NextResponse.json({
      totalAssigned,
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
