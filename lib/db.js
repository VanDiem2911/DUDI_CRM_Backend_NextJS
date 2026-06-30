import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User';
import EmployeeProfile from './models/EmployeeProfile';
import DataRecord from './models/DataRecord';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dudi_chiadata';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (mongooseInstance) => {
      console.log('>>> Connected to MongoDB');
      // Initialize Seeding after successful connection
      try {
        await seedDatabase();
      } catch (seedErr) {
        console.error('>>> Database Seeding failed:', seedErr);
      }
      return mongooseInstance;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

async function seedDatabase() {
  // Check if admin is present
  const adminExists = await User.findOne({ username: 'admin' });
  if (adminExists) {
    // console.log('>>> Database already initialized. Skipping Seeding.');
    // Let's run status migration though
    await migrateStatuses();
    return;
  }

  console.log('>>> Initializing default database seeding...');

  // 1. Initializing default admin user
  const adminId = new mongoose.Types.ObjectId().toString();
  const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);
  const adminUser = new User({
    _id: adminId,
    employeeId: 'admin',
    fullName: 'Quản trị viên DuDi',
    username: 'admin',
    email: 'admin@dudi.vn',
    password: hashedPasswordAdmin,
    phone: '0999888777',
    role: 'ROLE_ADMIN',
    active: true,
  });
  await adminUser.save();
  console.log('>>> Đã khởi tạo tài khoản Admin mặc định: admin / admin123');

  // 2. Initializing a default employee
  let empObj = null;
  const employeeExists = await User.findOne({ username: 'nv1' });
  if (!employeeExists) {
    const hashedPasswordEmp = await bcrypt.hash('123456', 10);
    const empUser = new User({
      _id: 'nv1',
      employeeId: 'nv1',
      fullName: 'Nguyễn Văn Nhân Viên 1',
      username: 'nv1',
      email: 'nhanvien1@dudi.vn',
      password: hashedPasswordEmp,
      phone: '0901234567',
      role: 'ROLE_EMPLOYEE',
      active: true,
      department: '',
    });
    empObj = await empUser.save();
    console.log('>>> Đã khởi tạo tài khoản Nhân viên mẫu: nv1 / 123456');

    // Create a default Profile for nv1
    const empProfile = new EmployeeProfile({
      _id: 'nv1',
      employeeId: 'nv1',
      name: 'Nguyễn Văn Nhân Viên 1',
      empName: 'Nguyễn Văn Nhân Viên 1',
      phone: '0901234567',
      email: 'nhanvien1@dudi.vn',
      dept: '',
      status: 'Đang làm việc',
      start: '01/06/2026',
    });
    await empProfile.save();
  } else {
    empObj = employeeExists;
  }

  // 3. Initializing sample data records
  const recordsCount = await DataRecord.countDocuments();
  if (recordsCount === 0) {
    const r1 = new DataRecord({
      businessName: 'Văn phòng cho thuê quận 5 - Office Saigon',
      address: '86 Đ. Tản Đà',
      area: 'Chợ Lớn, Hồ Chí Minh',
      phone: '+84 987 110 011',
      website: 'https://www.officesaigon.vn/van-phong-cho-thue-quan-5.html',
      businessType: 'Đại lý cho thuê văn phòng',
      googleMapUrl: 'https://www.google.com/maps/search/?api=1&query=V%C4%83n%20ph%C3%B2ng%20cho%20thu%C3%AA%20qu%E1%BA%ADn%205%20-%20Office%20Saigon',
      status: 'Chưa xử lý',
    });

    const r2 = new DataRecord({
      businessName: 'Cà phê Trung Nguyên Legend Quận 1',
      address: '12 Đ. Alexandre de Rhodes',
      area: 'Quận 1, Hồ Chí Minh',
      phone: '+84 28 3825 8585',
      website: 'https://trungnguyenlegend.com',
      businessType: 'Quán cà phê',
      googleMapUrl: 'https://www.google.com/maps/search/?api=1&query=C%C3%A0%20ph%C3%AA%20Trung%20Nguy%C3%AAn%20Legend%20Qu%E1%BA%ADn%201',
      status: 'Đã gửi tin nhắn',
      assignedTo: empObj ? empObj._id : null,
      assignedToName: empObj ? empObj.fullName : null,
    });

    const r3 = new DataRecord({
      businessName: 'Khách sạn Majestic Sài Gòn',
      address: '1 Đ. Đồng Khởi',
      area: 'Quận 1, Hồ Chí Minh',
      phone: '+84 28 3829 5517',
      website: 'https://majesticsaigon.com',
      businessType: 'Khách sạn',
      googleMapUrl: 'https://www.google.com/maps/search/?api=1&query=Kh%C3%A1ch%20s%E1%BA%A1n%20Majestic%20S%C3%A0i%20G%C3%B2n',
      status: 'Trả lời',
      assignedTo: empObj ? empObj._id : null,
      assignedToName: empObj ? empObj.fullName : null,
    });

    const r4 = new DataRecord({
      businessName: 'Bệnh viện Đa khoa Tâm Anh',
      address: '2B Đ. Phổ Quang',
      area: 'Tân Bình, Hồ Chí Minh',
      phone: '+84 287 102 6789',
      website: 'https://tamanhhospital.vn',
      businessType: 'Bệnh viện tư nhân',
      googleMapUrl: 'https://www.google.com/maps/search/?api=1&query=B%E1%BB%87nh%20vi%E1%BB%87n%20%C4%90a%20khoa%20T%C3%A2m%20Anh',
      status: 'Chưa xử lý',
    });

    await DataRecord.insertMany([r1, r2, r3, r4]);
    console.log('>>> Đã khởi tạo 4 bản ghi dữ liệu khách hàng mẫu!');
  }

  await migrateStatuses();
}

async function migrateStatuses() {
  const allRecords = await DataRecord.find({});
  let changed = false;
  
  for (const r of allRecords) {
    const status = r.status;
    let newStatus = null;
    
    if (status === 'Đang xử lý' || status === 'Đã liên hệ') {
      newStatus = 'Đã gửi tin nhắn';
    } else if (status === 'Đã hoàn thành' || status === 'Có tiềm năng') {
      newStatus = 'Trả lời';
    } else if (
      status &&
      status !== 'Chưa xử lý' &&
      status !== 'Chặn người lạ' &&
      status !== 'Đã gửi tin nhắn' &&
      status !== 'Không có Zalo' &&
      status !== 'Trả lời'
    ) {
      newStatus = 'Chưa xử lý';
    }
    
    if (newStatus !== null) {
      r.status = newStatus;
      changed = true;
      await r.save();
    }
  }

  if (changed) {
    console.log('>>> Đã cập nhật trạng thái dữ liệu cũ sang bộ trạng thái mới!');
  }
}

export default dbConnect;
