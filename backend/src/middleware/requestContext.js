import { randomUUID } from 'node:crypto';

const MAX_REQUEST_ID_LEN = 128;

/**
 * Stable request correlation id for logs and client debugging.
 */
export function requestContext() {
  return (req, res, next) => {
    const header = req.headers['x-request-id'];
    const fromClient =
      typeof header === 'string' && header.length > 0
        ? header.slice(0, MAX_REQUEST_ID_LEN)
        : Array.isArray(header)
          ? header[0]?.slice(0, MAX_REQUEST_ID_LEN)
          : undefined;

    const id = fromClient && fromClient.length > 0 ? fromClient : randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}
