import { NextRequest } from 'next/server';
import { readAuthBody, authResponse, authErrorResponse } from '@/server/auth-response';
import { signInWithMax } from '@/server/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await readAuthBody(req);
    const maxUserId = typeof body.maxUserId === 'string' ? body.maxUserId.trim() : '';
    const role = body.role === 'driver' ? 'driver' : 'passenger';
    if (!/^\d+$/.test(maxUserId)) throw new Error('Некорректный MAX ID');
    const result = await signInWithMax(maxUserId, role);
    return authResponse(req, result, 200);
  } catch (error) {
    return authErrorResponse(error);
  }
}
