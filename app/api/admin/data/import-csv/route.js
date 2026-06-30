import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import dbConnect from '@/lib/db';
import { getSession, checkRole } from '@/lib/auth';
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

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ message: 'File rỗng' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse using SheetJS
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ message: 'File không có dữ liệu' }, { status: 400 });
    }

    // First row contains headers
    const headers = rows[0].map(h => String(h).trim());

    let nameIdx = getColumnIndex(headers, ["Tên doanh nghiệp", "Ten doanh nghiep", "Business Name", "businessName", "Name"]);
    let addrIdx = getColumnIndex(headers, ["Địa chỉ", "Dia chi", "Address", "address", "Đường", "Duong"]);
    let areaIdx = getColumnIndex(headers, ["Khu vực", "Khu vuc", "Area", "area"]);
    let phoneIdx = getColumnIndex(headers, ["Số điện thoại", "So dien thoai", "Số ĐT", "SĐT", "SDT", "Phone", "phone"]);
    let webIdx = getColumnIndex(headers, ["Website", "website", "Trang web"]);
    let typeIdx = getColumnIndex(headers, ["Loại hình", "Loai hinh", "Danh mục", "Danh muc", "Type", "businessType"]);
    let mapsIdx = getColumnIndex(headers, ["Google Maps", "Google Map", "Maps", "googleMapUrl"]);
    let noteIdx = getColumnIndex(headers, ["Ghi chú", "Ghi chu", "Note", "note"]);

    let hasHeader = true;
    if (nameIdx === -1 || phoneIdx === -1 || addrIdx === -1 || areaIdx === -1) {
      if (headers.length >= 4) {
        hasHeader = false;
        nameIdx = 0;
        addrIdx = 1;
        areaIdx = 2;
        phoneIdx = 3;
        webIdx = headers.length > 4 ? 4 : -1;
        typeIdx = headers.length > 5 ? 5 : -1;
        mapsIdx = headers.length > 6 ? 6 : -1;
        noteIdx = headers.length > 7 ? 7 : -1;
      } else {
        return NextResponse.json(
          { message: 'File không khớp các cột bắt buộc (Tên doanh nghiệp, Địa chỉ, Khu vực, Số điện thoại). Hãy tải file mẫu để kiểm tra.' },
          { status: 400 }
        );
      }
    }

    let totalRows = 0;
    let successCount = 0;
    let failedCount = 0;
    const errors = [];
    const validRecords = [];
    const rowPhones = new Set();

    const startRowIndex = hasHeader ? 1 : 0;
    for (let rNum = startRowIndex; rNum < rows.length; rNum++) {
      const columns = rows[rNum];
      
      // Skip empty rows
      if (!columns || columns.length === 0 || (columns.length === 1 && String(columns[0]).trim() === '')) {
        continue;
      }

      const isEmptyRow = columns.every(val => String(val).trim() === '');
      if (isEmptyRow) continue;

      totalRows++;

      const maxIdx = Math.max(nameIdx, addrIdx, areaIdx, phoneIdx, webIdx, typeIdx, mapsIdx, noteIdx);
      if (columns.length <= maxIdx) {
        failedCount++;
        errors.push({ row: rNum + 1, message: 'Dòng không đủ số cột dữ liệu' });
        continue;
      }

      const businessName = String(columns[nameIdx]).trim();
      const address = String(columns[addrIdx]).trim();
      const area = String(columns[areaIdx]).trim();
      const phone = String(columns[phoneIdx]).trim();
      const website = webIdx !== -1 ? String(columns[webIdx]).trim() : '';
      const businessType = typeIdx !== -1 ? String(columns[typeIdx]).trim() : '';
      const googleMapUrl = mapsIdx !== -1 ? String(columns[mapsIdx]).trim() : '';
      const note = noteIdx !== -1 ? String(columns[noteIdx]).trim() : '';

      if (!businessName) {
        failedCount++;
        errors.push({ row: rNum + 1, message: 'Thiếu tên doanh nghiệp' });
        continue;
      }

      if (phone && rowPhones.has(phone)) {
        failedCount++;
        errors.push({ row: rNum + 1, message: 'So dien thoai da ton tai' });
        continue;
      }

      if (phone) {
        rowPhones.add(phone);
      }

      validRecords.push({
        row: rNum + 1,
        data: {
          businessName,
          address,
          area,
          phone,
          website,
          businessType,
          googleMapUrl,
          note,
          status: 'Ch\u01b0a x\u1eed l\u00fd',
          assignedTo: null,
          assignedToName: null,
          createdBy: user._id.toString()
        }
      });
    }

    const existingPhones = rowPhones.size > 0
      ? new Set(
          (await DataRecord.find({ phone: { $in: Array.from(rowPhones) } }).select('phone').lean())
            .map(record => record.phone)
        )
      : new Set();

    const recordsToInsert = [];
    for (const record of validRecords) {
      if (record.data.phone && existingPhones.has(record.data.phone)) {
        failedCount++;
        errors.push({ row: record.row, message: 'So dien thoai da ton tai' });
        continue;
      }

      recordsToInsert.push(record.data);
    }

    if (recordsToInsert.length > 0) {
      try {
        const insertedRecords = await DataRecord.insertMany(recordsToInsert, { ordered: false });
        successCount = insertedRecords.length;
      } catch (err) {
        const insertedCount = err.insertedDocs?.length || 0;
        successCount = insertedCount;
        failedCount += recordsToInsert.length - insertedCount;
        errors.push({ row: null, message: 'Loi luu database: ' + err.message });
      }
    }

    return NextResponse.json({
      totalRows,
      successCount,
      failedCount,
      errors
    });
  } catch (error) {
    console.error('>>> Import data CSV/Excel error:', error);
    return NextResponse.json(
      { message: 'Lỗi xử lý file CSV/Excel: ' + error.message },
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
