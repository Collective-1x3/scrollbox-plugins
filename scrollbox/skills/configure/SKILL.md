---
name: configure
description: Set up the Scrollbox channel — save the user API token and check pairing status. Use when the user pastes a Scrollbox token (sk_user_*), asks to configure Scrollbox, asks "how do I connect to scroll-box.com," or wants to check channel status.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(ls *)
  - Bash(mkdir *)
  - Bash(stat *)
  - Bash(cat ~/.claude/channels/scrollbox/*)
---

# /scrollbox:configure — Scrollbox Channel Setup

Writes the Scrollbox user API key to `~/.claude/channels/scrollbox/.env` and
reports pairing status. The MCP server reads that file at boot AND on every
poll, so a token refresh takes effect without restarting Claude Code.

Arguments passed: `$ARGUMENTS`

---

## Dispatch on arguments

### No args — status

Read the state files and give the user a clear picture:

1. **Token** — check `~/.claude/channels/scrollbox/.env` for `SCROLLBOX_TOKEN`.
   - Missing file or no `SCROLLBOX_TOKEN`: report "not configured."
   - Set: show first 16 chars masked (`sk_user_a1b2c3d4...`).

2. **Last poll** — read `~/.claude/channels/scrollbox/state.json`. If
   `lastPollAt` is within the last 60 seconds, the channel is healthy.
   Older or missing means either (a) Claude Code wasn't started with
   `--channels plugin:scrollbox@scrollbox`, or (b) the token is bad.

3. **Base URL** — `SCROLLBOX_BASE_URL` from `.env` if set, else default
   `https://scroll-box.com`. Show only if non-default.

4. **Next step** — pick one based on state:
   - No token → *"Run `/scrollbox:configure <token>` with the key from
     scroll-box.com/compte/cle-mcp."*
   - Token set, no recent poll → *"Restart Claude Code with
     `claude --channels plugin:scrollbox@scrollbox`."*
   - Token set, recent poll → *"Channel live. Prompt from the canvas at
     scroll-box.com to push events here."*

### Args = `<token>` — save and verify

When the user passes a single token argument:

1. Validate the format:
   - Must start with `sk_user_` (Scrollbox user keys only).
   - Length sanity check (>40 chars).
   - If not, refuse and explain how to grab one from `/compte/cle-mcp`.

2. Ensure `~/.claude/channels/scrollbox/` exists (`mkdir -p`).

3. Write `~/.claude/channels/scrollbox/.env` with:
   ```
   SCROLLBOX_TOKEN=<token>
   ```
   Preserve any existing `SCROLLBOX_BASE_URL` line if present.

4. Set permissions to `0600` (token in plain text — owner-only read).

5. Confirm to the user:
   - "Saved to `~/.claude/channels/scrollbox/.env`."
   - "If Claude Code is running with `--channels plugin:scrollbox@scrollbox`,
      the next poll uses the new token (within 30s). Otherwise restart with
      that flag."

### Args = `base <url>` — staging override (rare)

If the user runs `/scrollbox:configure base https://staging.scroll-box.com`,
write `SCROLLBOX_BASE_URL=<url>` into the same `.env` (preserve token).

---

## Important

- **Never log the token.** Mask after the first 16 chars in any output.
- The token is a `sk_user_*` Scrollbox API key — same format as the one used
  for the Scrollbox MCP at `/api/mcp`. Reusing the same key is fine and
  encouraged (one identity, one auth surface).
- This skill does NOT send any HTTP request. It only writes files. The
  channel server picks them up on the next poll.
