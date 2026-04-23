import { z } from "zod";

/**
 * @typedef {{ ok: true, data: any }} AckSuccess
 * @typedef {{ ok: false, error: { code: string, message: string } }} AckFailure
 * @typedef {AckSuccess | AckFailure} Ack
 */

/**
 * @param {unknown} ack
 * @param {Ack} payload
 * @param {import('pino').Logger} logger
 */
export function deliverAck(ack, payload, logger) {
  if (typeof ack !== "function") {
    return;
  }
  try {
    ack(payload);
  } catch (err) {
    logger.warn({ err, event: "typing_race_ack_failed" }, "typing_race");
  }
}

/**
 * @param {unknown} err
 * @returns {AckFailure}
 */
export function toAckFailure(err) {
  if (err instanceof z.ZodError) {
    const first = err.issues[0];
    const message = first
      ? `${first.path.length ? `${first.path.join(".")}: ` : ""}${first.message}`
      : "Validation failed";
    return { ok: false, error: { code: "VALIDATION_ERROR", message } };
  }
  if (err && typeof err === "object" && "code" in err) {
    return {
      ok: false,
      error: {
        code: String(/** @type {any} */ (err).code),
        message: err instanceof Error ? err.message : "Request failed",
      },
    };
  }
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: err instanceof Error ? err.message : "Request failed",
    },
  };
}

/**
 * @param {{
 *   socket: import('socket.io').Socket,
 *   logger: import('pino').Logger,
 *   userId: string,
 *   username: string,
 *   rateState: Record<string, number>,
 * }} ctx
 */
export function makeTypingRegister(ctx) {
  const { socket, logger, userId } = ctx;
  /**
   * @template T
   * @param {string} event
   * @param {{
   *   schema?: import('zod').ZodType<T>,
   *   rateLimit?: { key: string, intervalMs: number },
   *   handler: (input: { data: T, socket: import('socket.io').Socket }) => Promise<unknown> | unknown,
   * }} def
   */
  return function register(event, def) {
    socket.on(event, async (payload, ack) => {
      try {
        if (def.rateLimit) {
          const now = Date.now();
          const last = ctx.rateState[def.rateLimit.key] ?? 0;
          if (now - last < def.rateLimit.intervalMs) {
            deliverAck(
              ack,
              {
                ok: false,
                error: { code: "RATE_LIMITED", message: "Too many requests" },
              },
              logger,
            );
            return;
          }
          ctx.rateState[def.rateLimit.key] = now;
        }
        const data = def.schema
          ? def.schema.parse(payload ?? {})
          : /** @type {T} */ (undefined);
        const result = await def.handler({ data, socket });
        deliverAck(ack, { ok: true, data: result ?? null }, logger);
      } catch (err) {
        const failure = toAckFailure(err);
        logger.warn(
          {
            err,
            event: `${event}_fail`,
            userId,
            socketId: socket.id,
            code: failure.error.code,
          },
          "typing_race",
        );
        deliverAck(ack, failure, logger);
      }
    });
  };
}
