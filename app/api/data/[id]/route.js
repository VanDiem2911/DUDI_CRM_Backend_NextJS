import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
import DataRecord from '@/lib/models/DataRecord';

export async function GET(request, { params }) {
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
    const record = await DataRecord.findById(id);
    if (!record) {
      return NextResponse.json({ message: 'Không tìm thấy data' }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('>>> GET /api/data/[id] error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();
    const {
      businessName,
      address,
      area,
      phone,
      website,
      businessType,
      googleMapUrl,
      note,
      status
    } = body;

    const record = await DataRecord.findById(id);
    if (!record) {
      return NextResponse.json({ message: 'Không tìm thấy data' }, { status: 404 });
    }

    record.businessName = businessName !== undefined ? businessName : record.businessName;
    record.address = address !== undefined ? address : record.address;
    record.area = area !== undefined ? area : record.area;
    record.phone = phone !== undefined ? phone : record.phone;
    record.website = website !== undefined ? website : record.website;
    record.businessType = businessType !== undefined ? businessType : record.businessType;
    record.googleMapUrl = googleMapUrl !== undefined ? googleMapUrl : record.googleMapUrl;
    record.note = note !== undefined ? note : record.note;
    if (status !== undefined && status.trim() !== '') {
      record.status = status;
    }

    await record.save();
    return NextResponse.json(record);
  } catch (error) {
    console.error('>>> PUT /api/data/[id] error:', error);
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
    const record = await DataRecord.findById(id);
    if (!record) {
      return NextResponse.json({ message: 'Không tìm thấy data' }, { status: 404 });
    }

    await DataRecord.findByIdAndDelete(id);
    return NextResponse.json({ message: 'Xóa data thành công!' });
  } catch (error) {
    console.error('>>> DELETE /api/data/[id] error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
