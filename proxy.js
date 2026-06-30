import { NextResponse } from 'next/server';

// Đọc origin được phép từ env var, fallback về * nếu chưa cấu hình
const ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGINS || '*';

function setCorsHeaders(response, origin) {
  // Nếu cấu hình cụ thể, reflect đúng origin của request (nếu khớp)
  if (ALLOWED_ORIGIN !== '*') {
    const allowedList = ALLOWED_ORIGIN.split(',').map(o => o.trim());
    response.headers.set(
      'Access-Control-Allow-Origin',
      allowedList.includes(origin) ? origin : allowedList[0]
    );
  } else {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'X-Requested-With, Accept, Content-Type, Authorization'
  );
  // Vary header giúp CDN cache đúng cách khi dùng specific origin
  if (ALLOWED_ORIGIN !== '*') {
    response.headers.set('Vary', 'Origin');
  }
}

export function proxy(request) {
  const origin = request.headers.get('origin') || '';

  // Phản hồi ngay preflight OPTIONS — không chuyển tiếp lên route handler
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    setCorsHeaders(response, origin);
    return response;
  }

  const response = NextResponse.next();
  setCorsHeaders(response, origin);
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
