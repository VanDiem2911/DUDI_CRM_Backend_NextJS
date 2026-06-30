import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
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

    const fileName = file.name || 'file.csv';
    const buffer = Buffer.from(await file.arrayBuffer());

    let totalRows = 0;
    let successCount = 0;
    let skippedNotMarketing = 0;
    let failedCount = 0;
    const errors = [];

    // Check if JSON file
    if (fileName.endsWith('.json')) {
      try {
        const fileContent = buffer.toString('utf8');
        let jsonData = JSON.parse(fileContent);
        if (!Array.isArray(jsonData)) {
          jsonData = [jsonData];
        }

        for (let i = 0; i < jsonData.length; i++) {
          const rowNum = i + 1;
          totalRows++;
          const item = jsonData[i];

          const id = getJsonValue(item, ["id", "employeeId", "username"]);
          const name = getJsonValue(item, ["name", "empName", "fullName"]);
          const email = getJsonValue(item, ["email"]);
          const phone = getJsonValue(item, ["phone"]);
          const dept = getJsonValue(item, ["dept", "department"]);
          const job = getJsonValue(item, ["job"]);
          let password = getJsonValue(item, ["password", "pass"]);
          if (!password) {
            password = '1234';
          }

          if (!dept || !dept.toLowerCase().includes('marketing')) {
            skippedNotMarketing++;
            continue;
          }

          if (!id) {
            failedCount++;
            errors.push({ row: rowNum, message: 'Thiếu thuộc tính id / employeeId / username' });
            continue;
          }

          if (!name || !email) {
            failedCount++;
            const missing = [];
            if (!name) missing.push('họ tên');
            if (!email) missing.push('email');
            errors.push({ row: rowNum, message: 'Thiếu ' + missing.join(', ') });
            continue;
          }

          const existingUserByUsername = await User.findOne({ username: id });
          if (existingUserByUsername) {
            const existingUserByEmail = await User.findOne({ email });
            if (existingUserByEmail && existingUserByEmail.username !== id) {
              failedCount++;
              errors.push({ row: rowNum, message: `Email '${email}' đã được sử dụng bởi tài khoản khác` });
              continue;
            }
          } else {
            const emailExists = await User.exists({ email });
            if (emailExists) {
              failedCount++;
              errors.push({ row: rowNum, message: `Email '${email}' đã tồn tại` });
              continue;
            }
          }

          try {
            const now = new Date();
            const createdAt = item.createdAt ? new Date(item.createdAt) : now;
            const updatedAt = item.updatedAt ? new Date(item.updatedAt) : now;

            let dbUser = existingUserByUsername;
            if (!dbUser) {
              dbUser = new User({
                _id: id,
                employeeId: id,
                username: id,
                role: 'ROLE_EMPLOYEE',
                active: true,
                createdAt
              });
            }
            dbUser.fullName = name;
            dbUser.email = email;
            dbUser.phone = phone;
            if (password) {
              dbUser.password = await bcrypt.hash(password, 10);
            }
            dbUser.department = dept;
            dbUser.updatedAt = updatedAt;
            await dbUser.save();

            // Profile save
            let profile = await EmployeeProfile.findOne({ employeeId: id });
            if (!profile) {
              profile = new EmployeeProfile({
                _id: id,
                employeeId: id,
                createdAt
              });
            }

            // Copy other json fields to profile
            for (const key of Object.keys(item)) {
              if (!['id', 'employeeId', 'username', 'password', 'role', 'active', 'createdAt', 'updatedAt'].includes(key)) {
                profile[key] = item[key];
              }
            }

            profile.name = name;
            profile.empName = name;
            profile.email = email;
            profile.phone = phone;
            profile.dept = dept;
            profile.job = job || profile.job || '';
            profile.updatedAt = updatedAt;

            await profile.save();
            successCount++;
          } catch (err) {
            failedCount++;
            errors.push({ row: rowNum, message: 'Lỗi lưu database: ' + err.message });
          }
        }

        return NextResponse.json({
          totalRows,
          successCount,
          skippedNotMarketing,
          failedCount,
          errors
        });
      } catch (err) {
        return NextResponse.json({ message: 'Lỗi xử lý file JSON: ' + err.message }, { status: 500 });
      }
    }

    // Excel & CSV parsing
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ message: 'File không có dữ liệu' }, { status: 400 });
    }

    const headers = rows[0].map(h => String(h).trim());

    let nameIdx = getColumnIndex(headers, ["Họ tên", "Họ và tên", "Ho ten", "Name", "Full Name", "fullName"]);
    let emailIdx = getColumnIndex(headers, ["Email", "email"]);
    let userIdx = getColumnIndex(headers, ["Username", "username", "Tên đăng nhập", "Ten dang nhap"]);
    let phoneIdx = getColumnIndex(headers, ["Số điện thoại", "Số ĐT", "SĐT", "SDT", "Phone", "phone"]);
    let deptIdx = getColumnIndex(headers, ["Phòng Ban", "Phòng ban", "Phong ban", "Department", "department"]);
    let passIdx = getColumnIndex(headers, ["Mật khẩu", "Mat khau", "Password", "password"]);

    let hasHeader = true;
    if (nameIdx === -1 || emailIdx === -1 || userIdx === -1 || deptIdx === -1 || passIdx === -1) {
      if (headers.length >= 5) {
        hasHeader = false;
        nameIdx = 0;
        emailIdx = 1;
        userIdx = 2;
        phoneIdx = headers.length > 5 ? 3 : -1;
        deptIdx = headers.length > 5 ? 4 : 3;
        passIdx = headers.length > 5 ? 5 : 4;
      } else {
        return NextResponse.json(
          { message: 'File mẫu không đúng định dạng cột yêu cầu. Hãy tải file mẫu để kiểm tra.' },
          { status: 400 }
        );
      }
    }

    const startRowIndex = hasHeader ? 1 : 0;
    for (let rNum = startRowIndex; rNum < rows.length; rNum++) {
      const columns = rows[rNum];

      if (!columns || columns.length === 0 || (columns.length === 1 && String(columns[0]).trim() === '')) {
        continue;
      }

      const isEmptyRow = columns.every(val => String(val).trim() === '');
      if (isEmptyRow) continue;

      totalRows++;

      const maxIdx = Math.max(nameIdx, emailIdx, userIdx, phoneIdx, deptIdx, passIdx);
      if (columns.length <= maxIdx) {
        failedCount++;
        errors.push({ row: rNum + 1, message: 'Dòng không đủ số cột dữ liệu' });
        continue;
      }

      const fullName = String(columns[nameIdx]).trim();
      const email = String(columns[emailIdx]).trim();
      const username = String(columns[userIdx]).trim();
      const phone = phoneIdx !== -1 ? String(columns[phoneIdx]).trim() : '';
      const department = String(columns[deptIdx]).trim();
      const password = String(columns[passIdx]).trim();

      // 1. Department filter (marketing only, case-insensitive)
      if (!department || !department.toLowerCase().includes('marketing')) {
        skippedNotMarketing++;
        continue;
      }

      // 2. Required fields validation
      const existingUserByUsername = await User.findOne({ username });
      if (!fullName || !email || !username || (!existingUserByUsername && !password)) {
        failedCount++;
        const missing = [];
        if (!fullName) missing.push('họ tên');
        if (!email) missing.push('email');
        if (!username) missing.push('username');
        if (!existingUserByUsername && !password) missing.push('mật khẩu');
        errors.push({ row: rNum + 1, message: 'Thiếu ' + missing.join(', ') });
        continue;
      }

      // 3. Email uniqueness validation
      if (existingUserByUsername) {
        const existingUserByEmail = await User.findOne({ email });
        if (existingUserByEmail && existingUserByEmail.username !== username) {
          failedCount++;
          errors.push({ row: rNum + 1, message: `Email '${email}' đã được sử dụng bởi tài khoản khác` });
          continue;
        }
      } else {
        const emailExists = await User.exists({ email });
        if (emailExists) {
          failedCount++;
          errors.push({ row: rNum + 1, message: `Email '${email}' đã tồn tại` });
          continue;
        }
      }

      try {
        let dbUser = existingUserByUsername;
        if (!dbUser) {
          dbUser = new User({
            _id: username,
            employeeId: username,
            username: username,
            role: 'ROLE_EMPLOYEE',
            active: true
          });
        }
        dbUser.fullName = fullName;
        dbUser.email = email;
        dbUser.phone = phone;
        if (password) {
          dbUser.password = await bcrypt.hash(password, 10);
        }
        dbUser.department = department;
        await dbUser.save();

        // Sync to EmployeeProfile
        let profile = await EmployeeProfile.findOne({ employeeId: username });
        if (!profile) {
          profile = new EmployeeProfile({
            _id: username,
            employeeId: username
          });
        }
        profile.name = fullName;
        profile.empName = fullName;
        profile.email = email;
        profile.phone = phone;
        profile.dept = department;
        await profile.save();

        successCount++;
      } catch (err) {
        failedCount++;
        errors.push({ row: rNum + 1, message: 'Lỗi lưu database: ' + err.message });
      }
    }

    return NextResponse.json({
      totalRows,
      successCount,
      skippedNotMarketing,
      failedCount,
      errors
    });
  } catch (error) {
    console.error('>>> POST /api/admin/employees/import-csv error:', error);
    return NextResponse.json(
      { message: 'Lỗi xử lý file CSV: ' + error.message },
      { status: 500 }
    );
  }
}

function getColumnIndex(headers, possibleNames) {
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).trim();
    for (const possibleName of possibleNames) {
      if (header.toLowerCase() === possibleName.toLowerCase()) {
        return i;
      }
    }
  }
  return -1;
}

function getJsonValue(item, keys) {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null) {
      return String(item[key]).trim();
    }
  }
  return '';
}
