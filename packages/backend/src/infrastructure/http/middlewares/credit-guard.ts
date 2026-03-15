import type { FastifyRequest, FastifyReply } from "fastify";
import type { ICreditRepository } from "../../../application/ports/ICreditRepository.js";
import { InsufficientCreditsError } from "../../../domain/errors/InsufficientCreditsError.js";

export function createCreditGuard(
  creditRepository: ICreditRepository,
  required = 1
) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userId = (req as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      void reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const balance = await creditRepository.findBalanceByUserId(userId);
    if (!balance || !balance.canReserve(required)) {
      throw new InsufficientCreditsError(balance?.available ?? 0, required);
    }
  };
}
