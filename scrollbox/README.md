# Scrollbox skills for Claude Code

Plugin **skills-only** — bundle le playbook design **TikTok / Instagram carousel** pour les agents Claude Code qui pilotent [scroll-box.com](https://scroll-box.com) via le MCP `scrollbox`.

> **Note** — ce plugin contenait précédemment un bridge Channel (push depuis le site vers le terminal). Anthropic Channels reste en research preview avec une allowlist stricte qui le rend non-distribuable. Le bridge a été retiré ; on garde uniquement la skill, qui apporte 90% de la valeur.

## Ce que la skill fait

`tiktok-carousel-design` est un playbook de 436 lignes qui dicte à l'agent :

- **Loop non-négociable** : create → render → validate → autofix → ship
- **Safe zones platform-aware** : TikTok video/carousel, IG Reels, Stories, Feed
- **Typography mobile-first** : scale 7 rôles (mega/hook/subhook/body/cta/micro/label), max 3 tailles + 2 polices par slide
- **Copy rules** : hook 5-9 mots livré (pas teasé), 1 slide = 1 idée, CTA spécifique
- **Vocab banned** : 8 catégories AI-slop / engagement-bait / hedging
- **Asset-first** : jamais inventer une preuve, demander à l'user
- **Locked layers** : règle dure pour les preuves marquées `locked: true` côté studio
- **Mass gen orchestration** : `plan_batch_campaign` avec 10 hook formulas + design/photo mix
- **TikTok ≠ Instagram editorial** : défaut Hormozi/saturé, jamais Playfair sur cream

L'agent la charge **automatiquement** dès qu'il bosse sur un carousel (Claude Code surveille `description` et match auto).

## Installation

### Via marketplace (recommandé)

```
/plugin marketplace add Collective-1x3/scrollbox-plugins
/plugin install scrollbox@scrollbox
/reload-plugins
```

### Dev local

```
git clone https://github.com/Collective-1x3/scrollbox-plugins
/plugin marketplace add ./scrollbox-plugins
/plugin install scrollbox@scrollbox
```

## Prérequis

- Claude Code récent (v2.1.80+ recommandé pour `/plugin install`).
- Compte [scroll-box.com](https://scroll-box.com) avec une **clé MCP** (générée sur `/compte/cle-mcp`) — la skill suppose que le serveur MCP `scrollbox` est connecté pour pouvoir appeler les tools (`declinate_piece`, `validate_piece`, `batch_render`, etc.).

## Vérifier que la skill est chargée

Dans Claude Code :

```
/help
```

Tu dois voir `tiktok-carousel-design` listé sous le namespace `scrollbox:`.

Pour l'invoquer manuellement :

```
/scrollbox:tiktok-carousel-design
```

Sinon, demande simplement à Claude un truc qui colle à la `description` (ex: "décline mon master TikTok en 5 variantes") et il la chargera tout seul.

## Licence

Apache-2.0 — voir `LICENSE`.
