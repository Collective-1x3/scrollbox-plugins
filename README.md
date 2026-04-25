# scrollbox-plugins

Marketplace officiel des plugins [Scrollbox](https://scroll-box.com) pour Claude Code.

## Installer

Dans Claude Code :

```text
/plugin marketplace add Collective-1x3/scrollbox-plugins
/plugin install scrollbox@scrollbox
/scrollbox:configure <ton_token>
```

Ensuite démarre Claude Code avec le channel activé :

```bash
claude --channels plugin:scrollbox@scrollbox
```

Récupère ton token sur [scroll-box.com/compte/cle-mcp](https://scroll-box.com/compte/cle-mcp).

## Plugins

| Plugin | Version | Description |
| --- | --- | --- |
| `scrollbox` | 0.1.0 | Channel — pousse des prompts depuis scroll-box.com vers ton terminal Claude Code (long-poll bidirectionnel via `/api/channel/dequeue` + `/api/channel/reply`). |

## Pré-requis

- Claude Code v2.1.80+ (research preview Channels)
- Compte claude.ai (pas API key Console)
- [Bun](https://bun.sh) installé (les plugins channels tournent via Bun)

## License

Apache 2.0 — voir le LICENSE dans chaque plugin.
