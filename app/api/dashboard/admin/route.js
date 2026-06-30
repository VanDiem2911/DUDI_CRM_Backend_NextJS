import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import User from '@/lib/models/User';
import DataRecord from '@/lib/models/DataRecord';

const STATUSES = ['Chưa xử lý', 'Chặn người lạ', 'Đã gửi tin nhắn', 'Không có Zalo', 'Trả lời'];

export async function GET(request) {
  try {
    await dbConnect();
    const user = await getSession(request);
    if (!user) {
      return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
    }

    if (!checkRole(user, ['ROLE_ADMIN'])) {
      return NextResponse.json({ message: 'Lỗi: Bạn không có quyền truy cập.' }, { status: 403 });
    }

    const [
      totalData,
      unassigned,
      employees,
      statusGroups,
      employeeGroups
    ] = await Promise.all([
      DataRecord.countDocuments(),
      DataRecord.countDocuments({ $or: [{ assignedTo: null }, { assignedTo: '' }] }),
      User.find({ role: 'ROLE_EMPLOYEE' }).select('_id fullName').lean(),
      DataRecord.aggregate([
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
      ]),
      DataRecord.aggregate([
        { $match: { assignedTo: { $nin: [null, ''] } } },
        {
          $group: {
            _id: '$assignedTo',
            totalAssigned: { $sum: 1 },
            completedCount: {
              $sum: { $cond: [{ $eq: ['$status', STATUSES[4]] }, 1, 0] }
            },
            processingCount: {
              $sum: { $cond: [{ $eq: ['$status', STATUSES[2]] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    const statusCounts = {};
    for (const status of STATUSES) {
      statusCounts[status] = 0;
    }
    for (const group of statusGroups) {
      statusCounts[group._id] = group.count;
    }

    const employeeStats = new Map(employeeGroups.map(group => [String(group._id), group]));
    const employeeProgress = employees.map((emp) => {
      const empId = emp._id.toString();
      const stats = employeeStats.get(empId);

      return {
        employeeId: emp._id,
        employeeName: emp.fullName,
        totalAssigned: stats?.totalAssigned || 0,
        completedCount: stats?.completedCount || 0,
        processingCount: stats?.processingCount || 0,
      };
    });

    const assigned = totalData - unassigned;
    const processing = statusCounts[STATUSES[2]] || 0;
    const completed = statusCounts[STATUSES[4]] || 0;

    return NextResponse.json({
      totalData,
      totalEmployees: employees.length,
      unassignedData: unassigned,
      assignedData: assigned,
      processingData: processing,
      completedData: completed,
      statusCounts,
      employeeProgress,
    });
  } catch (error) {
    console.error('>>> /api/dashboard/admin error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
