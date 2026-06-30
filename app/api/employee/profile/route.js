import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import EmployeeProfile from '@/lib/models/EmployeeProfile';

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
    let profile = await EmployeeProfile.findOne({ employeeId });
    
    if (!profile) {
      profile = {
        employeeId,
        name: user.fullName,
        empName: user.fullName,
        phone: user.phone,
        email: user.email,
        galleryImages: ["", ""],
        workHistory: [{ position: "", startDate: "", endDate: "" }]
      };
    }

    return NextResponse.json({
      user: {
        id: user._id,
        employeeId: user.employeeId || user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        active: user.active
      },
      profile
    });
  } catch (error) {
    console.error('>>> GET /api/employee/profile error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
