---
name: access
description: Manage Scrollbox channel pairing — verify a pairing code shown on scroll-box.com to confirm this terminal is yours. Use when the user runs `/scrollbox:access pair <code>`, asks who can push to their session, or wants to revoke pairing.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(curl *)
  - Bash(cat ~/.claude/channels/scrollbox/*)
---

# /scrollbox:access — Scrollbox Channel Access Control

Pairing model :

- The user creates a `sk_user_*` API key on scroll-box.com (`/compte/cle-mcp`).
- That key already authenticates them to the Scrollbox MCP. Reusing it as the
  channel token means **only their own canvas events reach their terminal.**
- The pairing flow below is an extra confirmation : the user types a 5-letter
  code shown in the site UI to prove the terminal is theirs (defends against
  a stolen-and-pasted token).

Arguments passed: `$ARGUMENTS`

---

## Dispatch on arguments

### `pair <code>` — confirm pairing

When the user runs `/scrollbox:access pair abcde`:

1. Read the token from `~/.claude/channels/scrollbox/.env`.
   - If missing, tell the user to run `/scrollbox:configure <token>` first.

2. POST to `${SCROLLBOX_BASE_URL}/api/channel/pair`:
   ```bash
   curl -X POST -H "Authorization: Bearer $SCROLLBOX_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"code":"<code>"}' \
     "$SCROLLBOX_BASE_URL/api/channel/pair"
   ```
   (Default base URL : `https://scroll-box.com`.)

3. On success (HTTP 200), report:
   - "Paired successfully. Events from scroll-box.com will arrive in this
      terminal."
4. On 4xx, report the error message from the response body. Common cases :
   - 404 = code expired or wrong account.
   - 410 = code already used.

### `status` — show paired sessions

POST or GET on `${SCROLLBOX_BASE_URL}/api/channel/sessions` with the same
auth header, list active pairings (terminal sessions registered to this user).

If the endpoint returns 404, this feature is not yet implemented on the
server — fall back to "Pairing is per-key. Revoke the key on
`/compte/cle-mcp` to invalidate this terminal."

### `revoke` — log out this terminal

There is no "revoke pairing" yet — the simplest way is to revoke the API key
on the website. Tell the user :

- "To revoke this terminal's access, go to `/compte/cle-mcp` on scroll-box.com
   and delete the `Claude Code` key. Then run `/scrollbox:configure <new-token>`
   with a fresh one."

### No args

Print the dispatch table :
- `/scrollbox:access pair <code>` — confirm pairing with a 5-letter code from the site.
- `/scrollbox:access status` — list paired sessions.
- `/scrollbox:access revoke` — instructions to revoke.

---

## Important

- **Never paste the token into chat.** Read it from the env file, use it only
  in the `Authorization` header passed to `curl`.
- A pairing code is short-lived (5 minutes). If `pair` returns 404, ask the
  user to refresh the code on the site.
