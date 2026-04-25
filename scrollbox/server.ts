#!/usr/bin/env bun
/**
 * Scrollbox channel for Claude Code.
 *
 * Bridges scroll-box.com → user's Claude Code session via MCP channel protocol.
 *
 * Strategy : long-poll Scrollbox's /api/channel/dequeue endpoint with the user's
 * API key. When an event arrives ({ pieceId?, instruction, axes?, context? }),
 * push it into the session as a <channel source="scrollbox"> tag. Claude reads
 * it, calls Scrollbox MCP tools at https://scroll-box.com/api/mcp, and replies
 * back through the `reply` tool which POSTs to /api/channel/reply.
 *
 * Auth : SCROLLBOX_TOKEN env var or ~/.claude/channels/scrollbox/.env. The
 * token IS a Scrollbox user API key (sk_user_*) created at /compte/cle-mcp.
 *
 * Notes :
 * - Long-polling (not webhook) survives NAT — no need to expose a public port.
 * - Stateless server : the queue lives in Postgres on Scrollbox's side.
 * - One-way "notify" + two-way "reply" tool exposed.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Config ────────────────────────────────────────────────────────────────

const CONFIG_DIR = join(homedir(), ".claude", "channels", "scrollbox");
const ENV_FILE = join(CONFIG_DIR, ".env");
const STATE_FILE = join(CONFIG_DIR, "state.json");
const DEFAULT_BASE_URL = "https://scroll-box.com";

interface State {
  /** scroll-box.com user email — surfaced for /scrollbox:configure status */
  pairedEmail?: string;
  /** ISO timestamp of last successful poll */
  lastPollAt?: string;
}

// ── Token + state loading ─────────────────────────────────────────────────

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  const raw = readFileSync(path, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    out[k] = v;
  }
  return out;
}

function loadToken(): string | null {
  // Shell env wins, then file
  const fromEnv = process.env.SCROLLBOX_TOKEN;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const fileEnv = readEnvFile(ENV_FILE);
  return fileEnv.SCROLLBOX_TOKEN || null;
}

function loadBaseUrl(): string {
  // Allow override for staging / self-hosted
  const fromEnv = process.env.SCROLLBOX_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, "");
  const fileEnv = readEnvFile(ENV_FILE);
  if (fileEnv.SCROLLBOX_BASE_URL) {
    return fileEnv.SCROLLBOX_BASE_URL.replace(/\/$/, "");
  }
  return DEFAULT_BASE_URL;
}

function loadState(): State {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as State;
  } catch {
    return {};
  }
}

function saveState(state: State): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// ── MCP server ────────────────────────────────────────────────────────────

const mcp = new Server(
  { name: "scrollbox", version: "0.1.0" },
  {
    capabilities: {
      experimental: { "claude/channel": {} },
      tools: {},
    },
    instructions:
      [
        "Events from scroll-box.com arrive as <channel source=\"scrollbox\" event_id=\"...\" piece_id=\"...\" kind=\"...\">.",
        "Each event carries an instruction the user typed in the canvas (e.g. 'décline en 5 angles', 'rerender en style B', 'change le hook').",
        "Workflow:",
        "  1. Read the instruction inside the <channel> body — it tells you exactly what to do.",
        "  2. Call Scrollbox MCP tools at https://scroll-box.com/api/mcp (already wired via /compte/cle-mcp).",
        "     Common ones: declinate_piece, update_piece, rerender_with_style, batch_render, get_piece_v2.",
        "  3. After the work is done, call the `reply` tool with the event_id from the channel tag and a short text summary. The summary appears in the activity panel on the site.",
        "Never invent a piece_id — always use the one in the channel tag.",
        "Permission prompts (Bash, Write, Edit) only appear in the local terminal — they are not relayed.",
      ].join(" "),
  },
);

// ── Reply tool — Claude posts an outcome back to the site ─────────────────

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "reply",
      description:
        "Reply to a Scrollbox channel event. Posts a short summary to scroll-box.com so it appears in the activity panel of the canvas. Pass the event_id from the <channel> tag.",
      inputSchema: {
        type: "object",
        properties: {
          event_id: {
            type: "string",
            description: "The event_id attribute from the inbound <channel> tag.",
          },
          text: {
            type: "string",
            description: "Short human-readable summary of what was done (max 280 chars).",
          },
          status: {
            type: "string",
            enum: ["ok", "error", "info"],
            description: "Outcome flavor — controls the activity panel icon.",
          },
        },
        required: ["event_id", "text"],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== "reply") {
    throw new Error(`unknown tool: ${req.params.name}`);
  }
  const args = req.params.arguments as {
    event_id: string;
    text: string;
    status?: "ok" | "error" | "info";
  };

  const token = loadToken();
  if (!token) {
    return {
      content: [
        {
          type: "text",
          text: "No SCROLLBOX_TOKEN configured. Run /scrollbox:configure <token>.",
        },
      ],
      isError: true,
    };
  }

  const baseUrl = loadBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/channel/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        event_id: args.event_id,
        text: args.text,
        status: args.status ?? "ok",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        content: [
          {
            type: "text",
            text: `Reply failed (HTTP ${res.status}): ${body.slice(0, 300)}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        { type: "text", text: "sent" },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Reply network error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
});

await mcp.connect(new StdioServerTransport());

// ── Long-poll loop ────────────────────────────────────────────────────────
// Keeps trying even if no token / network down — recovers gracefully when
// the user runs /scrollbox:configure mid-session.

const POLL_TIMEOUT_MS = 30_000;
const BACKOFF_NO_TOKEN_MS = 60_000;
const BACKOFF_NETWORK_MS = 5_000;
const BACKOFF_4XX_MS = 30_000;

interface QueuedEvent {
  id: string;
  payload: {
    pieceId?: string;
    instruction: string;
    axes?: string[];
    context?: Record<string, unknown>;
    kind?: string;
  };
  createdAt: string;
}

async function pollOnce(token: string, baseUrl: string): Promise<QueuedEvent | "timeout" | "error" | "auth_error"> {
  try {
    const res = await fetch(`${baseUrl}/api/channel/dequeue?wait=30`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": `scrollbox-channel/${process.env.npm_package_version ?? "0.1.0"}`,
      },
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS + 5_000),
    });

    // 204 No Content = long-poll timed out, no event ready
    if (res.status === 204) return "timeout";

    // 401/403 = bad token, back off harder
    if (res.status === 401 || res.status === 403) {
      console.error(`[scrollbox-channel] auth rejected (HTTP ${res.status}). Run /scrollbox:configure with a valid token.`);
      return "auth_error";
    }

    if (!res.ok) {
      console.error(`[scrollbox-channel] dequeue HTTP ${res.status}`);
      return "error";
    }

    const event = (await res.json()) as QueuedEvent;
    return event;
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return "timeout";
    }
    console.error(
      `[scrollbox-channel] dequeue network error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return "error";
  }
}

function buildMeta(event: QueuedEvent): Record<string, string> {
  const meta: Record<string, string> = {
    event_id: event.id,
  };
  if (event.payload.pieceId) meta.piece_id = event.payload.pieceId;
  if (event.payload.kind) meta.kind = event.payload.kind;
  if (event.payload.axes && event.payload.axes.length > 0) {
    meta.axes = event.payload.axes.join(",");
  }
  return meta;
}

function buildContent(event: QueuedEvent): string {
  const lines: string[] = [];
  lines.push(event.payload.instruction.trim());
  if (event.payload.context && Object.keys(event.payload.context).length > 0) {
    lines.push("");
    lines.push("Context:");
    for (const [k, v] of Object.entries(event.payload.context)) {
      lines.push(`  ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
  }
  return lines.join("\n");
}

async function pollLoop(): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const token = loadToken();
    if (!token) {
      // Silent — the configure skill tells the user how to set it
      await new Promise((r) => setTimeout(r, BACKOFF_NO_TOKEN_MS));
      continue;
    }

    const baseUrl = loadBaseUrl();
    const result = await pollOnce(token, baseUrl);

    if (result === "timeout") {
      // Update last poll for /scrollbox:configure status
      const state = loadState();
      state.lastPollAt = new Date().toISOString();
      saveState(state);
      // Immediately re-poll
      continue;
    }

    if (result === "auth_error") {
      await new Promise((r) => setTimeout(r, BACKOFF_4XX_MS));
      continue;
    }

    if (result === "error") {
      await new Promise((r) => setTimeout(r, BACKOFF_NETWORK_MS));
      continue;
    }

    // Got a real event — push it into the session
    try {
      await mcp.notification({
        method: "notifications/claude/channel",
        params: {
          content: buildContent(result),
          meta: buildMeta(result),
        },
      });
      const state = loadState();
      state.lastPollAt = new Date().toISOString();
      saveState(state);
    } catch (err) {
      console.error(
        `[scrollbox-channel] failed to push notification: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

// Fire-and-forget — pollLoop runs forever
void pollLoop();
