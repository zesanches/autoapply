import { spawn } from "child_process";
import type { ClaudeProvider } from "./ClaudeFormAnalyzer.js";

/**
 * Invokes the local `claude` CLI in non-interactive mode (`--print` flag).
 * No ANTHROPIC_API_KEY needed — uses whatever auth Claude Code has configured.
 *
 * Prompt is written to stdin to avoid shell injection via args.
 * Tools are disabled (`--allowedTools ""`) — we only need text completion.
 */
export class LocalClaudeProvider implements ClaudeProvider {
  constructor(
    private readonly options: {
      claudePath?: string;
      model?: string;
      maxBudgetUsd?: number;
    } = {}
  ) {}

  complete(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const claudeBin = this.options.claudePath ?? "claude";

      const args = [
        "--print",
        "--output-format", "text",
        "--allowedTools", "",
        "--dangerously-skip-permissions",
      ];

      if (this.options.model) {
        args.push("--model", this.options.model);
      }

      if (this.options.maxBudgetUsd !== undefined) {
        args.push("--max-budget-usd", String(this.options.maxBudgetUsd));
      }

      const child = spawn(claudeBin, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          // Unset CLAUDECODE so the nested session check is bypassed
          CLAUDECODE: undefined,
        },
        timeout: 120_000,
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      child.on("error", reject);

      child.on("close", (code) => {
        const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();

        if (code !== 0 && !stdout) {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
          return;
        }

        if (!stdout && stderr) {
          reject(new Error(`Claude CLI error: ${stderr}`));
          return;
        }

        resolve(stdout);
      });

      // Write prompt to stdin and close
      child.stdin.write(prompt, "utf8");
      child.stdin.end();
    });
  }
}
