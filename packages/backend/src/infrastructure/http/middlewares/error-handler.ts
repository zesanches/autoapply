import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { InsufficientCreditsError } from "../../../domain/errors/InsufficientCreditsError.js";
import { ProfileIncompleteError } from "../../../domain/errors/ProfileIncompleteError.js";
import { MaxRetriesExceededError } from "../../../domain/errors/MaxRetriesExceededError.js";
import { PlatformUnavailableError } from "../../../domain/errors/PlatformUnavailableError.js";
import { logger } from "../../../shared/logger/index.js";

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

function mapDomainError(err: Error): { status: number; code: string; message: string } | null {
  if (err instanceof InsufficientCreditsError) {
    return {
      status: 402,
      code: err.code,
      message: err.message,
    };
  }
  if (err instanceof ProfileIncompleteError) {
    return { status: 422, code: err.code, message: err.message };
  }
  if (err instanceof MaxRetriesExceededError) {
    return { status: 422, code: err.code, message: err.message };
  }
  if (err instanceof PlatformUnavailableError) {
    return { status: 503, code: err.code, message: err.message };
  }
  return null;
}

export function errorHandler(
  err: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply
): void {
  logger.error(
    { err, method: req.method, url: req.url },
    "Request error"
  );

  // Zod/Fastify validation errors
  if (err.statusCode === 400 || err.validation) {
    void reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid request data" },
    } satisfies ErrorResponse);
    return;
  }

  // Domain errors
  const domainError = mapDomainError(err as Error);
  if (domainError) {
    void reply.status(domainError.status).send({
      success: false,
      error: { code: domainError.code, message: domainError.message },
    } satisfies ErrorResponse);
    return;
  }

  // Generic server error — never expose internals
  void reply.status(500).send({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  } satisfies ErrorResponse);
}
