import { NextResponse } from 'next/server';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const allowedOrigins = [
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'X-Requested-With, Accept, Content-Type, Authorization',
};

function isLocalDevOrigin(origin) {
  try {
    const url = new URL(origin);
    const isVitePort = ['5173', '5174'].includes(url.port);
    const isLocalHost =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.startsWith('192.168.') ||
      url.hostname.startsWith('10.');

    return url.protocol === 'http:' && isVitePort && isLocalHost;
  } catch {
    return false;
  }
}

function applyCorsHeaders(request, response) {
  const origin = request.headers.get('origin') || '';

  if (allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  }

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export function proxy(request) {
  if (request.method === 'OPTIONS') {
    return applyCorsHeaders(request, new NextResponse(null, { status: 204 }));
  }

  return applyCorsHeaders(request, NextResponse.next());
}

export const config = {
  matcher: '/api/:path*',
};
