import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Auth } from "../../auth/better-auth.js";

function toWebRequest(req: FastifyRequest): Request {
  const protocol = req.protocol ?? "http";
  const host = req.headers.host ?? "localhost";
  const url = `${protocol}://${host}${req.url}`;
  const hasBody = ["POST", "PUT", "PATCH"].includes(req.method);

  const init: RequestInit = {
    method: req.method,
    headers: req.headers as Record<string, string>,
  };

  if (hasBody) {
    init.body = JSON.stringify(req.body);
  }

  return new Request(url, init);
}

export function authRoutes(auth: Auth) {
  return async function (app: FastifyInstance): Promise<void> {
    app.all("/*", async (req: FastifyRequest, reply: FastifyReply) => {
      const webRequest = toWebRequest(req);
      const response = await auth.handler(webRequest);

      void reply.status(response.status);
      response.headers.forEach((value, key) => {
        void reply.header(key, value);
      });

      return reply.send(await response.text());
    });
  };
}
