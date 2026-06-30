import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const area = searchParams.get('area');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '0', 10);
    const size = parseInt(searchParams.get('size') || '10', 10);

    const query = {};

    if (status && status.trim()) {
      query.status = status;
    }

    if (assignedTo && assignedTo.trim()) {
      if (assignedTo === 'unassigned') {
        query.$or = [
          { assignedTo: null },
          { assignedTo: '' }
        ];
      } else {
        query.assignedTo = assignedTo;
      }
    }

    if (area && area.trim()) {
      query.area = { $regex: area, $options: 'i' };
    }

    if (search && search.trim()) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await DataRecord.countDocuments(query);
    const records = await DataRecord.find(query)
      .sort({ createdAt: -1 })
      .skip(page * size)
      .limit(size);

    return NextResponse.json({
      content: records,
      totalElements: total,
      totalPages: Math.ceil(total / size),
      number: page,
      size: size
    });
  } catch (error) {
    console.error('>>> GET /api/data error:', error);
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

    if (!businessName || !businessName.trim()) {
      return NextResponse.json({ message: 'Tên doanh nghiệp không được để trống' }, { status: 400 });
    }

    const record = new DataRecord({
      businessName,
      address: address || '',
      area: area || '',
      phone: phone || '',
      website: website || '',
      businessType: businessType || '',
      googleMapUrl: googleMapUrl || '',
      note: note || '',
      status: status || 'Chưa xử lý',
      createdBy: user._id.toString()
    });

    await record.save();
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('>>> POST /api/data error:', error);
    return NextResponse.json(
      { message: 'Lỗi máy chủ nội bộ: ' + error.message },
      { status: 500 }
    );
  }
}
