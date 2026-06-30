import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import User from '@/lib/models/User';
import EmployeeProfile from '@/lib/models/EmployeeProfile';
import DataRecord from '@/lib/models/DataRecord';

export async function PUT(request, { params }) {
  try {
    await dbConnect();
    const user = await getSession(request);
    if (!user) {
      return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
    }

    if (!checkRole(user, ['ROLE_ADMIN'])) {
      return NextResponse.json({ message: 'Lỗi: Bạn không có quyền truy cập.' }, { status: 403 });
    }

    const { id } = await params;
    const updateRequest = await request.json();

    const dbUser = await User.findById(id);
    if (!dbUser) {
      return NextResponse.json({ message: 'Không tìm thấy tài khoản nhân viên' }, { status: 404 });
    }

    const validationError = validateEmployeeProfileRequest(updateRequest);
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const newUsername = updateRequest.username ? String(updateRequest.username).trim() : '';
    if (newUsername && newUsername !== dbUser.username) {
      const usernameExists = await User.exists({ username: newUsername });
      if (usernameExists) {
        return NextResponse.json({ message: 'Lỗi: Tên đăng nhập đã tồn tại!' }, { status: 400 });
      }
      dbUser.username = newUsername;
    }

    dbUser.fullName = getRequestFullName(updateRequest);
    dbUser.email = updateRequest.email || dbUser.email;
    dbUser.phone = updateRequest.phone || dbUser.phone;
    dbUser.department = updateRequest.dept || dbUser.department;

    if (updateRequest.password && String(updateRequest.password).trim().length >= 4) {
      dbUser.password = await bcrypt.hash(String(updateRequest.password).trim(), 10);
    }

    await dbUser.save();
    await saveEmployeeProfile(id, updateRequest);

    return NextResponse.json({ message: 'Cập nhật thông tin nhân viên thành công!' });
  } catch (error) {
    console.error('>>> PUT /api/users/[id] error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    await dbConnect();
    const user = await getSession(request);
    if (!user) {
      return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
    }

    if (!checkRole(user, ['ROLE_ADMIN'])) {
      return NextResponse.json({ message: 'Lỗi: Bạn không có quyền truy cập.' }, { status: 403 });
    }

    const { id } = await params;
    const dbUser = await User.findById(id);
    if (!dbUser) {
      return NextResponse.json({ message: 'Không tìm thấy tài khoản nhân viên' }, { status: 404 });
    }

    // Reassign assigned records to null
    await DataRecord.updateMany(
      { assignedTo: id },
      {
        $set: {
          assignedTo: null,
          assignedToName: null
        }
      }
    );

    // Delete User and Profile
    await User.findByIdAndDelete(id);
    await EmployeeProfile.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Đã xóa nhân viên thành công!' });
  } catch (error) {
    console.error('>>> DELETE /api/users/[id] error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}

function parseProfileDate(value) {
  if (!value || !value.trim()) return null;
  const str = value.trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  
  const parts = str.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
  }
  return null;
}

function validateEmployeeProfileRequest(request) {
  if (request.cccd && !/^\d{12}$/.test(request.cccd.trim())) {
    return 'CCCD phải gồm đúng 12 số!';
  }

  if (request.bankAccount && !/^\d+$/.test(request.bankAccount.trim())) {
    return 'Số tài khoản ngân hàng chỉ được nhập số!';
  }

  const dob = parseProfileDate(request.dob);
  const cccdIssueDate = parseProfileDate(request.cccdIssueDate);
  const start = parseProfileDate(request.start);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (request.dob && !dob) {
    return 'Ngày sinh không hợp lệ!';
  }
  if (request.cccdIssueDate && !cccdIssueDate) {
    return 'Ngày cấp CCCD không hợp lệ!';
  }
  if (!request.start || !request.start.trim()) {
    return 'Ngày bắt đầu không được để trống!';
  }
  if (!start) {
    return 'Ngày bắt đầu không hợp lệ!';
  }
  if (dob && dob > today) {
    return 'Ngày sinh không được lớn hơn ngày hiện tại!';
  }
  if (cccdIssueDate && cccdIssueDate > today) {
    return 'Ngày cấp CCCD không được lớn hơn ngày hiện tại!';
  }
  if (dob && cccdIssueDate && cccdIssueDate < dob) {
    return 'Ngày cấp CCCD không được trước ngày sinh!';
  }
  if (dob && start < dob) {
    return 'Ngày bắt đầu không được trước ngày sinh!';
  }

  return null;
}

function getRequestFullName(request) {
  return request.fullName || request.empName || request.name || '';
}

async function saveEmployeeProfile(employeeId, request) {
  let profile = await EmployeeProfile.findOne({ employeeId });
  if (!profile) {
    profile = new EmployeeProfile({
      _id: employeeId,
      employeeId
    });
  }

  profile.name = request.name || getRequestFullName(request);
  profile.empName = request.empName || getRequestFullName(request);
  profile.avatarUrl = request.avatarUrl || '';
  profile.phone = request.phone || '';
  profile.email = request.email || '';
  profile.gender = request.gender || '';
  profile.dob = request.dob || '';
  profile.cccd = request.cccd || '';
  profile.cccdIssueDate = request.cccdIssueDate || '';
  profile.cccdIssuePlace = request.cccdIssuePlace || '';
  profile.dept = request.dept || '';
  profile.job = request.job || '';
  profile.contractType = request.contractType || '';
  profile.status = request.status || '';
  profile.start = request.start || '';
  profile.endIntern = request.endIntern || '';
  profile.resignDate = request.resignDate || '';
  profile.university = request.university || '';
  profile.bankName = request.bankName || '';
  profile.bankAccount = request.bankAccount || '';
  profile.note = request.note || '';
  
  if (request.currentAddress) {
    profile.currentAddress = {
      province: request.currentAddress.province || '',
      district: request.currentAddress.district || '',
      ward: request.currentAddress.ward || '',
      street: request.currentAddress.street || ''
    };
  }
  if (request.hometown) {
    profile.hometown = {
      province: request.hometown.province || '',
      district: request.hometown.district || '',
      ward: request.hometown.ward || '',
      street: request.hometown.street || ''
    };
  }

  // Normalize gallery images
  const normalizedGallery = [];
  const reqGallery = request.galleryImages || [];
  const existGallery = profile.galleryImages || [];
  for (let i = 0; i < 2; i++) {
    const val = reqGallery[i] !== undefined && reqGallery[i] !== null ? reqGallery[i] : (existGallery[i] || '');
    normalizedGallery.push(val);
  }
  profile.galleryImages = normalizedGallery;

  // Normalize work history
  const normalizedHistory = [];
  const reqHistory = request.workHistory || [];
  if (reqHistory.length > 0 && reqHistory[0]) {
    normalizedHistory.push({
      position: reqHistory[0].position || '',
      startDate: reqHistory[0].startDate || '',
      endDate: ''
    });
  } else {
    normalizedHistory.push({ position: '', startDate: '', endDate: '' });
  }
  profile.workHistory = normalizedHistory;

  await profile.save();
}
