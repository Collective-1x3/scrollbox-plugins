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
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Config ────────────────────────────────────────────────────────────────

const CONFIG_DIR = join(homedir(), ".claude", "channels", "scrollbox");
const ENV_FILE = join(CONFIG_DIR, ".env");
const STATE_FILE = join(CONFIG_DIR, "state.json");
const PID_FILE = join(CONFIG_DIR, "server.pid");
const DEFAULT_BASE_URL = "https://scroll-box.com";

// ── Single-instance enforcement ──────────────────────────────────────────
// Claude Code spawns plugins per session but doesn't always clean them up
// (force-quit, crash, system sleep). Without this, instances pile up and
// each one polls /api/channel/dequeue → Vercel cost explosion. At startup
// we kill any previous PID we recorded ; only one plugin process survives.

function killPreviousInstance(): void {
  if (!existsSync(PID_FILE)) return;
  try {
    const raw = readFileSync(PID_FILE, "utf-8").trim();
    const oldPid = Number.parseInt(raw, 10);
    if (!Number.isFinite(oldPid) || oldPid <= 0 || oldPid === process.pid) return;
    try {
      // Signal 0 = "is the process alive" without actually signaling.
      process.kill(oldPid, 0);
    } catch {
      // ESRCH — already dead, nothing to do.
      return;
    }
    try {
      process.kill(oldPid, "SIGTERM");
      console.error(`[scrollbox-channel] killed previous instance PID ${oldPid}`);
      // SIGKILL fallback after a short delay if it didn't die.
      setTimeout(() => {
        try {
          process.kill(oldPid, 0);
          process.kill(oldPid, "SIGKILL");
        } catch {
          // already gone, good
        }
      }, 500);
    } catch (err) {
      console.error(
        `[scrollbox-channel] could not kill previous PID ${oldPid}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  } catch {
    // unreadable pid file — ignore
  }
}

function writePidFile(): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(PID_FILE, String(process.pid), "utf-8");
}

function cleanupPidFile(): void {
  try {
    if (!existsSync(PID_FILE)) return;
    const raw = readFileSync(PID_FILE, "utf-8").trim();
    if (Number.parseInt(raw, 10) === process.pid) {
      unlinkSync(PID_FILE);
    }
  } catch {
    // best-effort
  }
}

// ── Parent-disconnect detection ──────────────────────────────────────────
// MCP transports use stdio. When Claude Code dies, its stdio pipes close
// → our stdin emits 'end' / 'close'. We exit so we don't become a zombie
// re-parented to init that keeps polling forever.

function installParentDisconnectGuard(): void {
  process.stdin.on("end", () => {
    console.error("[scrollbox-channel] stdin closed (parent disconnect) — exiting");
    process.exit(0);
  });
  process.stdin.on("close", () => {
    console.error("[scrollbox-channel] stdin closed (parent disconnect) — exiting");
    process.exit(0);
  });
  // Also handle the standard signals so cleanup runs.
  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
    process.on(sig, () => {
      console.error(`[scrollbox-channel] received ${sig} — exiting`);
      process.exit(0);
    });
  }
  process.on("exit", cleanupPidFile);
}

killPreviousInstance();
writePidFile();
installParentDisconnectGuard();

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
    /** Snapshot léger fetché côté serveur — économise un get_piece_v2 initial. */
    pieceSnapshot?: {
      id?: string;
      name?: string;
      mode?: string;
      slideCount?: number;
      skeletonSlug?: string;
      styleSlug?: string;
      accountName?: string;
      accountHandle?: string;
      productName?: string;
      /**
       * Layers que l'user a explicitement verrouillés. L'agent NE doit PAS
       * les modifier, ni leur position, ni leur contenu (cf. skill).
       */
      lockedLayers?: Array<{ id: string; type: string; label: string }>;
    };
  };
  createdAt: string;
}

/**
 * Poll outcome — `retryAfterMs` is honored by pollLoop to back off cheaply
 * when the server tells us the bridge is inactive (cost-optim Vercel).
 */
type PollResult =
  | { kind: "event"; event: QueuedEvent }
  | { kind: "timeout"; retryAfterMs?: number }
  | { kind: "error"; retryAfterMs?: number }
  | { kind: "auth_error"; retryAfterMs?: number };

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  // RFC 7231 — Retry-After is delta-seconds OR an HTTP-date. We support seconds.
  const seconds = Number.parseInt(headerValue.trim(), 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds, 600) * 1000; // cap at 10min
  }
  return undefined;
}

// ── Heartbeat → site ──────────────────────────────────────────────────────
// Le site /api/channel/status dérive online/silent/absent à partir du
// timestamp `users.channel_plugin_last_seen_at`. On le bumpe à chaque poll
// réussi (timeout OU event), dédupliqué à 30s pour ne pas spammer Vercel.

// 60s — assez fréquent pour que le serveur (ONLINE_WINDOW=90s) garde l'user
// "online", mais pas plus, pour minimiser le coût Vercel. Un user actif sur
// le canvas génère donc ≤1 POST/min (vs 2/min à 30s).
const HEARTBEAT_DEDUP_MS = 60_000;
let lastHeartbeatAt = 0;

async function sendHeartbeat(token: string, baseUrl: string): Promise<void> {
  const now = Date.now();
  if (now - lastHeartbeatAt < HEARTBEAT_DEDUP_MS) return;
  lastHeartbeatAt = now;
  try {
    await fetch(`${baseUrl}/api/channel/heartbeat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pluginVersion: process.env.npm_package_version ?? "0.1.0",
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    // Best-effort — heartbeat failures don't break the loop.
    console.error(
      `[scrollbox-channel] heartbeat failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function pollOnce(token: string, baseUrl: string): Promise<PollResult> {
  try {
    const res = await fetch(`${baseUrl}/api/channel/dequeue?wait=30`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": `scrollbox-channel/${process.env.npm_package_version ?? "0.1.0"}`,
      },
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS + 5_000),
    });

    const retryAfterMs = parseRetryAfter(res.headers.get("Retry-After"));

    // 204 No Content = long-poll timed out OR bridge inactive (server hint).
    // When inactive the server sends Retry-After:60 ; honor it to drop polling
    // frequency from continuous to 1/min.
    if (res.status === 204) return { kind: "timeout", retryAfterMs };

    // 401/403 = bad token, back off harder
    if (res.status === 401 || res.status === 403) {
      console.error(`[scrollbox-channel] auth rejected (HTTP ${res.status}). Run /scrollbox:configure with a valid token.`);
      return { kind: "auth_error", retryAfterMs };
    }

    // 400 = often "owner key without x-act-as-user". Print actionable
    // guidance so the user doesn't have to spelunk the API.
    if (res.status === 400) {
      const body = await res.text().catch(() => "");
      if (body.toLowerCase().includes("owner") || body.toLowerCase().includes("act-as-user")) {
        console.error(
          "[scrollbox-channel] dequeue rejected — your token is an OWNER key (sk_owner_* or env key).",
          "The bridge needs a USER-scoped key (sk_user_*). Create one at scroll-box.com/compte/cle-mcp,",
          "then run /scrollbox:configure with the new token.",
        );
      } else {
        console.error(`[scrollbox-channel] dequeue 400: ${body.slice(0, 240)}`);
      }
      return { kind: "auth_error", retryAfterMs: BACKOFF_4XX_MS };
    }

    if (!res.ok) {
      console.error(`[scrollbox-channel] dequeue HTTP ${res.status}`);
      return { kind: "error", retryAfterMs };
    }

    const event = (await res.json()) as QueuedEvent;
    return { kind: "event", event };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { kind: "timeout" };
    }
    console.error(
      `[scrollbox-channel] dequeue network error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { kind: "error" };
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

  // Pre-loaded snapshot of the piece — saves an initial get_piece_v2 call.
  // Only printed when present (push always sends it for canvas-scoped events).
  const snap = event.payload.pieceSnapshot;
  if (snap) {
    lines.push("");
    lines.push("Piece snapshot:");
    if (snap.name) lines.push(`  name: ${snap.name}`);
    if (snap.mode) lines.push(`  mode: ${snap.mode}`);
    if (typeof snap.slideCount === "number") {
      lines.push(`  slide_count: ${snap.slideCount}`);
    }
    if (snap.skeletonSlug) lines.push(`  skeleton: ${snap.skeletonSlug}`);
    if (snap.styleSlug) lines.push(`  style: ${snap.styleSlug}`);
    if (snap.accountName) {
      const handle = snap.accountHandle ? ` (${snap.accountHandle})` : "";
      lines.push(`  account: ${snap.accountName}${handle}`);
    }
    if (snap.productName) lines.push(`  product: ${snap.productName}`);

    // Layers verrouillés — l'user les a explicitement marqués comme protégés.
    // NE JAMAIS les modifier (position, contenu, taille). Voir skill section
    // "Layers verrouillés et sélection user".
    if (snap.lockedLayers && snap.lockedLayers.length > 0) {
      lines.push("");
      lines.push("🔒 Locked layers (NE PAS MODIFIER):");
      for (const l of snap.lockedLayers) {
        const label = l.label ? ` "${l.label}"` : "";
        lines.push(`  - ${l.id} (${l.type})${label}`);
      }
    }
  }

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
  // Boot heartbeat — envoyé une fois au démarrage du plugin, AVANT le
  // premier poll. Même si le bridge n'est pas actif côté serveur (donc on
  // ne fera plus de heartbeat dans la boucle ensuite), ça évite le deadlock
  // "lastSeenAt=null → UI bloquée sur 'never' → user ne peut pas activer".
  // Avec ce boot, l'UI passe immédiatement à "Agent prêt · tape pour activer"
  // dès que Claude Code lance le plugin.
  let bootDone = false;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const token = loadToken();
    if (!token) {
      // Silent — the configure skill tells the user how to set it
      await new Promise((r) => setTimeout(r, BACKOFF_NO_TOKEN_MS));
      continue;
    }
    if (!bootDone) {
      void sendHeartbeat(token, loadBaseUrl());
      bootDone = true;
    }

    const baseUrl = loadBaseUrl();
    const result = await pollOnce(token, baseUrl);

    // Heartbeat — UNIQUEMENT quand le bridge est actif côté serveur.
    // Cost-optim Vercel : si le server retourne 204 + Retry-After ≥ 30s
    // c'est le signal "bridge inactif" (gate channel_active_until null/expiré).
    // Dans ce cas le plugin entre en mode "présence silencieuse" — il poll
    // pour rester réactif si l'user active, mais ne ping pas /heartbeat
    // (qui couterait 1 fonction Vercel par minute pour rien). Auth_error
    // skip aussi (token invalide → heartbeat rejeté).
    const bridgeInactiveSignal =
      result.kind === "timeout" &&
      typeof result.retryAfterMs === "number" &&
      result.retryAfterMs >= 30_000;
    const shouldHeartbeat =
      result.kind !== "auth_error" && !bridgeInactiveSignal;
    if (shouldHeartbeat) {
      void sendHeartbeat(token, baseUrl);
    }

    if (result.kind === "timeout") {
      // Update last poll for /scrollbox:configure status
      const state = loadState();
      state.lastPollAt = new Date().toISOString();
      saveState(state);
      // Server can ask us to back off (Retry-After) when the bridge isn't
      // active on the canvas — cost-optim Vercel. Honor it.
      if (result.retryAfterMs && result.retryAfterMs > 0) {
        await new Promise((r) => setTimeout(r, result.retryAfterMs));
      }
      continue;
    }

    if (result.kind === "auth_error") {
      const wait = result.retryAfterMs ?? BACKOFF_4XX_MS;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (result.kind === "error") {
      const wait = result.retryAfterMs ?? BACKOFF_NETWORK_MS;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    // Got a real event — push it into the session
    try {
      await mcp.notification({
        method: "notifications/claude/channel",
        params: {
          content: buildContent(result.event),
          meta: buildMeta(result.event),
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
