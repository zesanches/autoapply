import pino from "pino";

const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.token",
  "*.apiKey",
  "*.api_key",
  "*.secret",
];

const isDev = process.env["NODE_ENV"] === "development";

const baseOptions = {
  level: process.env["LOG_LEVEL"] ?? (process.env["NODE_ENV"] === "test" ? "silent" : "info"),
  redact: {
    paths: REDACTED_PATHS,
    censor: "[REDACTED]",
  },
};

export const logger = isDev
  ? pino({ ...baseOptions, transport: { target: "pino-pretty", options: { colorize: true } } })
  : pino(baseOptions);

export type Logger = typeof logger;
