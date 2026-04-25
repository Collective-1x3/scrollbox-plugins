# Scrollbox channel for Claude Code

Pousse les prompts de **scroll-box.com** directement dans ta session Claude Code.

L'agent reçoit l'event en live, appelle les MCP tools Scrollbox sur
`scroll-box.com/api/mcp`, et la réponse remonte dans le canvas du site.

> Research preview — requires Claude Code v2.1.80+ and a claude.ai login
> (Console / API key auth not supported).

## Comment ça marche

```
[Toi sur scroll-box.com]
   │
   │  clic « Décliner en 5 angles » sur la sélection canvas
   ▼
[POST /api/channel/push (Next.js)]
   │
   │  Met l'event en queue Postgres avec ton user_id
   ▼
[Plugin Bun local — ce repo]
   │  long-poll GET /api/channel/dequeue (auth Bearer ta clé)
   │  reçoit { pieceId, instruction, axes, context }
   ▼
[<channel source="scrollbox" event_id="..." piece_id="...">]
   │  arrive comme tag dans ta session Claude Code
   ▼
[Agent Claude]
   │  appelle Scrollbox MCP tools (declinate_piece, batch_render…)
   │  appelle l'outil `reply` avec event_id + résumé
   ▼
[POST /api/channel/reply]
   │  affiche le résumé dans l'activity panel du site
```

## Prérequis

- [Bun](https://bun.sh) — le serveur MCP tourne sous Bun.
- Claude Code **v2.1.80+** avec login `claude.ai`.
- Compte scroll-box.com avec une clé API utilisateur (générée sur
  `/compte/cle-mcp`).

## Installation

### Une fois le plugin publié sur GitHub

```
/plugin marketplace add scrollbox/scrollbox-plugins
/plugin install scrollbox@scrollbox-plugins
/reload-plugins
```

### Dev local (avant publication)

```
git clone https://github.com/scrollbox/scrollbox-plugins
/plugin marketplace add ./scrollbox-plugins
/plugin install scrollbox@scrollbox-plugins
```

## Configuration

1. **Récupère ta clé.** Va sur [scroll-box.com/compte/cle-mcp](https://scroll-box.com/compte/cle-mcp)
   et clique « + Générer une clé ». Copie le token `sk_user_…` immédiatement.

2. **Sauvegarde-le côté plugin.**
   ```
   /scrollbox:configure sk_user_a1b2c3d4...
   ```
   Écrit dans `~/.claude/channels/scrollbox/.env`. Tu peux aussi le mettre
   dans ton shell : `export SCROLLBOX_TOKEN=sk_user_…` (le shell prime sur
   le fichier).

3. **Lance Claude Code avec le channel activé.**
   ```bash
   claude --channels plugin:scrollbox@scrollbox-plugins
   ```
   Pendant la research preview, si le plugin n'est pas encore sur la
   allowlist Anthropic :
   ```bash
   claude --dangerously-load-development-channels plugin:scrollbox@scrollbox-plugins
   ```

4. **Vérifie l'état.**
   ```
   /scrollbox:configure
   ```
   (sans argument) — affiche le token masqué et l'horodatage du dernier poll.

## Usage

Une fois connecté :

- Va sur scroll-box.com `/studio` ou `/design`.
- Sélectionne une piece, clique sur l'action « Décliner / Rerender / Modifier ».
- L'instruction arrive dans ton terminal Claude Code dans la seconde.
- L'agent fait le boulot via les MCP tools, puis appelle `reply` pour rapporter.

## Sécurité

- Le token est une `sk_user_*` Scrollbox — **scoped à ton user**.
- Long-polling sortant uniquement — **aucun port exposé**.
- Le serveur de queue est sur scroll-box.com côté Next.js. Si tu révoques
  ta clé sur `/compte/cle-mcp`, le plugin se voit refusé en 30s max.
- Permission relay (Bash/Write/Edit) **non activé** dans cette version : les
  prompts d'approbation restent dans ton terminal local.

## Architecture

| Composant | Rôle | Code |
|-----------|------|------|
| `server.ts` | MCP channel + long-poll loop | dans ce repo |
| `/api/channel/push` | Endpoint Next.js qui accepte les events depuis le frontend | `app/api/channel/push/route.ts` côté scrollbox |
| `/api/channel/dequeue` | Long-poll endpoint, retourne le 1er event en queue | `app/api/channel/dequeue/route.ts` |
| `/api/channel/reply` | POST optionnel pour relayer le résultat dans l'activity panel | `app/api/channel/reply/route.ts` |
| `channel_events` table | Queue Postgres : `id, user_id, payload, created_at, delivered_at, replied_at, reply_payload` | migration 0035 |

## Limites

- Research preview = features peut bouger.
- Cap soft de 100 events queue par user (older = dropped).
- Long-poll = 30s max par requête, le plugin re-poll automatiquement.
- 1 plugin = 1 session = 1 user. Pour multi-user (équipes), il faudra
  router par sub-channel — pas implémenté.

## Licence

Apache-2.0 — voir `LICENSE` (à ajouter côté repo public).
