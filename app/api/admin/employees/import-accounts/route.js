import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import User from '@/lib/models/User';
import EmployeeProfile from '@/lib/models/EmployeeProfile';

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

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ message: 'File rỗng' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let accountsData;
    try {
      accountsData = JSON.parse(buffer.toString('utf8'));
    } catch (err) {
      return NextResponse.json({ message: 'Định dạng JSON tài khoản không hợp lệ. Phải là một Object chứa danh sách tài khoản.' }, { status: 400 });
    }

    if (typeof accountsData !== 'object' || Array.isArray(accountsData) || accountsData === null) {
      return NextResponse.json({ message: 'Định dạng JSON tài khoản không hợp lệ. Phải là một Object chứa danh sách tài khoản.' }, { status: 400 });
    }

    let totalRows = 0;
    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    const keys = Object.keys(accountsData);
    for (let idx = 0; idx < keys.length; idx++) {
      totalRows++;
      const username = keys[idx];
      const accountInfo = accountsData[username];

      if (typeof accountInfo !== 'object' || accountInfo === null) {
        failedCount++;
        errors.push({ row: idx + 1, message: `Dữ liệu tài khoản '${username}' phải là một Object` });
        continue;
      }

      const password = accountInfo.password ? String(accountInfo.password) : '1234';
      const roleStr = accountInfo.role ? String(accountInfo.role) : 'employee';

      let role = 'ROLE_EMPLOYEE';
      if (roleStr.toLowerCase() === 'admin' || roleStr.toUpperCase() === 'ROLE_ADMIN') {
        role = 'ROLE_ADMIN';
      }

      // Check if employee profile exists
      const profile = await EmployeeProfile.findOne({ employeeId: username });
      if (!profile) {
        failedCount++;
        errors.push({
          row: idx + 1,
          message: `Không thể import tài khoản do chưa có nhân viên có mã nv '${username}'`
        });
        continue;
      }

      try {
        const now = new Date();
        const createdAt = accountInfo.createdAt ? new Date(accountInfo.createdAt) : now;
        const updatedAt = now;

        let dbUser = await User.findOne({ username });
        if (!dbUser) {
          dbUser = new User({
            _id: username,
            employeeId: username,
            username: username,
            createdAt
          });
        }

        dbUser.fullName = profile.name || username;
        dbUser.email = profile.email || `${username}@dudi.vn`;
        dbUser.phone = profile.phone || '';
        dbUser.password = await bcrypt.hash(password, 10);
        dbUser.role = role;
        dbUser.active = true;
        dbUser.updatedAt = updatedAt;

        await dbUser.save();

        profile.updatedAt = updatedAt;
        await profile.save();

        successCount++;
      } catch (err) {
        failedCount++;
        errors.push({ row: idx + 1, message: `Lỗi lưu tài khoản '${username}': ` + err.message });
      }
    }

    return NextResponse.json({
      totalRows,
      successCount,
      failedCount,
      errors
    });
  } catch (error) {
    console.error('>>> POST /api/admin/employees/import-accounts error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
