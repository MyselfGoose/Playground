import assert from 'node:assert/strict';
import request from 'supertest';

export const SOCKET_TEST_PASSWORD = 'SockUser123!@#';

/**
 * @param {import('http').Server | string} serverOrBaseUrl Express server or base URL for supertest
 * @param {string} label
 */
export async function registerSocketUser(serverOrBaseUrl, label) {
  const stamp = Date.now();
  const reg = await request(serverOrBaseUrl)
    .post('/api/v1/auth/register')
    .send({
      username: `sock${label}${stamp}`,
      email: `sock_${label}_${stamp}@example.com`,
      password: SOCKET_TEST_PASSWORD,
    })
    .expect(201);

  const cookies = reg.headers['set-cookie'];
  assert.ok(Array.isArray(cookies));
  const cookieHeader = cookies.map((c) => String(c).split(';')[0]).join('; ');

  const hs = await request(serverOrBaseUrl)
    .get('/api/v1/auth/socket-admission')
    .set('Cookie', cookieHeader)
    .expect(200);

  const token = hs.body?.data?.token;
  assert.ok(typeof token === 'string' && token.length > 10, 'expected socket admission token');
  return { token, cookieHeader, userId: reg.body?.data?.user?.id };
}

/**
 * @param {import('socket.io-client').Socket} socket
 * @param {string} event
 * @param {unknown} [payload]
 * @param {number} [timeoutMs]
 */
export function emitAck(socket, event, payload = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} ack timeout`)), timeoutMs);
    socket.timeout(timeoutMs).emit(event, payload, (err, res) => {
      clearTimeout(t);
      if (err) {
        reject(err);
        return;
      }
      resolve(res);
    });
  });
}

/**
 * @param {import('socket.io-client').Socket} socket
 * @param {number} [timeoutMs]
 */
export function waitSocketConnected(socket, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('connect timeout')), timeoutMs);
    socket.once('connect', () => {
      clearTimeout(t);
      resolve(undefined);
    });
    socket.once('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}
