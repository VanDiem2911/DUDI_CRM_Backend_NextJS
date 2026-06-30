import { NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';

export async function POST(request) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ message: 'Chưa cấu hình Cloudinary' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ message: 'File ảnh không được để trống' }, { status: 400 });
    }

    const contentType = file.type;
    if (!contentType || !contentType.match(/^image\/(jpeg|jpg|png|webp)$/)) {
      return NextResponse.json({ message: 'Chỉ hỗ trợ ảnh jpg, jpeg, png, webp' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = process.env.CLOUDINARY_FOLDER || 'quanlynhansu';

    // Upload stream to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image'
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json({ url: uploadResult.secure_url });
  } catch (error) {
    console.error('>>> POST /api/upload/image error:', error);
    return NextResponse.json(
      { message: 'Upload ảnh thất bại: ' + error.message },
      { status: 500 }
    );
  }
}
