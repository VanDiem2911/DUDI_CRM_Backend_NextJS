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

    const allRecords = await DataRecord.find({});
    const employees = await User.find({ role: 'ROLE_EMPLOYEE' });

    let unassigned = 0;
    let assigned = 0;
    let processing = 0;
    let completed = 0;

    const statusCounts = {};
    for (const status of STATUSES) {
      statusCounts[status] = 0;
    }

    for (const record of allRecords) {
      if (!record.assignedTo || !record.assignedTo.trim()) {
        unassigned++;
      } else {
        assigned++;
      }

      let status = record.status;
      if (!status || !status.trim()) {
        status = 'Chưa xử lý';
      }
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (status === 'Đã gửi tin nhắn') {
        processing++;
      } else if (status === 'Trả lời') {
        completed++;
      }
    }

    const employeeProgress = [];
    for (const emp of employees) {
      const empId = emp._id.toString();
      let empTotal = 0;
      let empCompleted = 0;
      let empProcessing = 0;

      for (const record of allRecords) {
        if (record.assignedTo === empId) {
          empTotal++;
          if (record.status === 'Trả lời') {
            empCompleted++;
          } else if (record.status === 'Đã gửi tin nhắn') {
            empProcessing++;
          }
        }
      }

      employeeProgress.push({
        employeeId: emp._id,
        employeeName: emp.fullName,
        totalAssigned: empTotal,
        completedCount: empCompleted,
        processingCount: empProcessing,
      });
    }

    return NextResponse.json({
      totalData: allRecords.length,
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
