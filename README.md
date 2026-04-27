# scrollbox-plugins

Marketplace officiel des plugins [Scrollbox](https://scroll-box.com) pour Claude Code.

## Installer

Dans Claude Code :

```text
/plugin marketplace add Collective-1x3/scrollbox-plugins
/plugin install scrollbox@scrollbox
/reload-plugins
```

C'est tout. La skill `tiktok-carousel-design` est désormais auto-chargée par ton agent dès qu'il bosse sur des carousels TikTok / IG via le MCP scrollbox.

## Plugins

| Plugin | Version | Description |
| --- | --- | --- |
| `scrollbox` | 1.0.0 | **Skills-only** — playbook design TikTok/IG carousel (loop validate→autofix→ship, safe zones, copy rules, locked layers, mass gen). Pour les agents qui pilotent scroll-box.com via le MCP. |

## Prérequis

- Claude Code récent (`/plugin install` doit être dispo).
- Compte [scroll-box.com](https://scroll-box.com) avec une clé MCP (`/compte/cle-mcp`) — la skill appelle les MCP tools `scrollbox` (declinate_piece, validate_piece, batch_render, etc.).

## License

Apache 2.0 — voir le LICENSE dans chaque plugin.
