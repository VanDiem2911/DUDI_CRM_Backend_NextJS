import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import User from '@/lib/models/User';
import EmployeeProfile from '@/lib/models/EmployeeProfile';
import DataRecord from '@/lib/models/DataRecord';

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

    const employees = await User.find({ role: 'ROLE_EMPLOYEE' }).lean();
    const employeeIds = employees.map(emp => emp._id.toString());

    const [assignedCounts, profiles] = await Promise.all([
      DataRecord.aggregate([
        { $match: { assignedTo: { $in: employeeIds } } },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
      ]),
      EmployeeProfile.find({ employeeId: { $in: employeeIds } }).lean()
    ]);

    const countByEmployeeId = new Map(assignedCounts.map(item => [String(item._id), item.count]));
    const profileByEmployeeId = new Map(profiles.map(profile => [String(profile.employeeId), profile]));

    const dtos = employees.map((emp) => {
      const empIdStr = emp._id.toString();
      const profile = profileByEmployeeId.get(empIdStr);

      const dto = {
        id: emp._id,
        employeeId: emp.employeeId || emp._id,
        fullName: emp.fullName,
        username: emp.username,
        email: emp.email,
        phone: emp.phone,
        role: emp.role,
        active: emp.active,
        department: emp.department,
        createdAt: emp.createdAt,
        updatedAt: emp.updatedAt,
        assignedDataCount: countByEmployeeId.get(empIdStr) || 0,
        profile: profile || null
      };

      if (profile) {
        dto.fullName = profile.empName || profile.name || dto.fullName;
        dto.email = profile.email || dto.email;
        dto.phone = profile.phone || dto.phone;
        dto.department = profile.dept || dto.department;
        dto.job = profile.job;
        dto.status = profile.status;
        dto.avatarUrl = profile.avatarUrl;
      }

      return dto;
    });

    return NextResponse.json(dtos);
  } catch (error) {
    console.error('>>> GET /api/users error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}

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

    const registerRequest = await request.json();
    const username = registerRequest.username ? String(registerRequest.username).trim() : '';

    if (!username) {
      return NextResponse.json({ message: 'Mã nhân viên không được để trống!' }, { status: 400 });
    }

    const validationError = validateEmployeeProfileRequest(registerRequest);
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const userExists = await User.exists({ username });
    if (userExists) {
      return NextResponse.json({ message: 'Lỗi: Tên đăng nhập đã tồn tại!' }, { status: 400 });
    }

    const fullName = getRequestFullName(registerRequest);
    const email = registerRequest.email || '';
    const phone = registerRequest.phone || '';
    const password = registerRequest.password || '1234';
    const dept = registerRequest.dept || '';

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      _id: username,
      employeeId: username,
      username: username,
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: 'ROLE_EMPLOYEE',
      active: true,
      department: dept
    });

    await newUser.save();
    await saveEmployeeProfile(username, registerRequest);

    return NextResponse.json({ message: 'Đã thêm nhân viên thành công!' });
  } catch (error) {
    console.error('>>> POST /api/users error:', error);
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
  today.setHours(23, 59, 59, 999); // Allow today

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
