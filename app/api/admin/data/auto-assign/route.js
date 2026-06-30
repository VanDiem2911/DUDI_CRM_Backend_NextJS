import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import User from '@/lib/models/User';
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

    // 1. Find all active employees in "marketing" department
    const allEmployees = await User.find({ role: 'ROLE_EMPLOYEE' });
    const targetEmployees = allEmployees.filter(emp => {
      if (!emp.active) return false;
      if (!emp.department) return false;
      return emp.department.trim().toLowerCase().includes('marketing');
    });

    if (targetEmployees.length === 0) {
      return NextResponse.json(
        { message: 'Không tìm thấy nhân viên đang hoạt động để chia data' },
        { status: 400 }
      );
    }

    // 2. Find all unassigned records
    const unassignedRecords = await DataRecord.find({
      $or: [
        { assignedTo: null },
        { assignedTo: '' }
      ]
    });

    const totalUnassigned = unassignedRecords.length;
    const totalEmployeesAssigned = targetEmployees.length;
    let assignedCount = 0;

    const countsMap = {};
    for (const emp of targetEmployees) {
      countsMap[emp._id.toString()] = 0;
    }

    if (totalUnassigned > 0) {
      for (let i = 0; i < unassignedRecords.length; i++) {
        const record = unassignedRecords[i];
        const employee = targetEmployees[i % totalEmployeesAssigned];
        const empIdStr = employee._id.toString();

        record.assignedTo = empIdStr;
        record.assignedToName = employee.fullName;
        await record.save();

        countsMap[empIdStr] = (countsMap[empIdStr] || 0) + 1;
        assignedCount++;
      }
    }

    const resultList = targetEmployees.map(emp => {
      const empIdStr = emp._id.toString();
      return {
        employeeId: emp._id,
        employeeName: emp.fullName,
        assignedCount: countsMap[empIdStr] || 0
      };
    });

    return NextResponse.json({
      totalUnassignedData: totalUnassigned,
      totalEmployees: totalEmployeesAssigned,
      assignedCount,
      result: resultList
    });
  } catch (error) {
    console.error('>>> POST /api/admin/data/auto-assign error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
