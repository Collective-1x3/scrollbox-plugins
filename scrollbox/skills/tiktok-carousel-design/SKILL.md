---
name: tiktok-carousel-design
description: Produce publishable TikTok / Instagram carousels via the Scrollbox MCP. Use for reproducing a reference, launching a single piece for a persona, or batching N pieces for one account+product. Covers the full refonte 2026 loop — platform specs, typography, primitives, inspiration decomposition, validation, autocorrect, mass generation.
---

# TikTok & IG Carousel Design — Scrollbox playbook 2026

This skill is the full playbook the agent must follow. The refonte shipped in 2026 changed how the system enforces quality: **every piece now passes a deterministic validator before it's considered shippable.** Your job is to fill slots with on-brand, on-voice text + real assets. The system catches the mistakes.

If a tool or rule here contradicts your pre-trained priors — trust the skill. The priors are 2023 AI-slop.

---

## 🚨 TikTok ≠ Instagram editorial — read this first

The default look you're producing is NOT :
- Serif headlines (Playfair / Fraunces / DM Serif) on cream / beige backgrounds
- Thin rule dividers + eyebrow mono caps + generous whitespace
- Italic attribution quotes in magazine-editorial 45%/55% split layouts

That's **Instagram Feed editorial** for wellness coaches, book clubs, and "creative entrepreneurship" accounts. If a user specifically asks for IG Feed 4:5 + explicit editorial vibe, OK. **Otherwise, never**.

TikTok carousel defaults in 2026 are :
- **Hormozi stack** : black BG, condensed display ALL CAPS white (Anton / Archivo Black), one word highlighted on yellow pill
- **Photo + stroked caption** : full-bleed photo of persona, white display text with 6-8px black stroke
- **Saturated callout** : pure color background (magenta / lime / cyan / electric yellow), ALL CAPS stack
- **Stat punch** : one giant number centered (300px+), tiny label above/below
- **Meme annotation** : photo + marker circle + arrow SVG pointing at a detail + pill label
- **Dropship badge** : product photo + starburst with price/mega-word + mega headline
- **Before/after split** : 50/50 horizontal, contrast colors, big chiffre each half

If you catch yourself generating a style with Playfair Display on #F7F3EC paper for a TikTok piece → stop, delete, restart. Default preset = `scrollbox_tiktok_hormozi`. If unsure, that.

---

## 0. Read this section first — session bootstrap

At the start of every session that touches content creation, load these resources (MCP `resources/read`) — they're cached for the whole session:

- `playbook://creation/framework` — the 6-tool loop overview
- `playbook://tiktok/safe-zones` — supplementary detail on TikTok-specific placement
- `playbook://tiktok/copy-rules` — hooks / specificity / show-don't-tell
- `playbook://tiktok/asset-first` — never invent proofs, always ask the user
- `playbook://tiktok/text-style` — the three Style A / B / C + font weights

Then call **once per session** (cheap, cacheable):

- `list_platforms()` — safe zones & typography ranges per platform
- `list_typography_scale()` — mobile-first scale (roles, ranges, limits)

You now know exactly where text can go and how big it can be for every format.

---

## 1. The Loop (non-negotiable)

Every piece goes through this sequence. Skipping steps produces pieces that look AI. Doing it all produces pieces indistinguishable from a real creator.

```
(1) CONTEXT        → list_accounts, get_account_context, list_products,
                     list_influencers, list_style_references, list_media
(2) INSPIRATION    → analyze_inspiration({imageUrl})
                     OR get_reference_tiktok({url})
(3) PLAN           → single piece : pick skeleton + style
                     batch : plan_batch_campaign({accountId, count, ...})
(4) FILL           → write slot_data (respect hook formula + voice)
(5) RENDER         → create_piece_from_skeleton  OR  batch_render
(6) VALIDATE       → validate_piece({pieceId})
(7) FIX (if any)   → autofix_piece  →  update_piece  →  back to (6)
(8) SHIP           → blockers == 0  →  piece.status = ready
```

Until `validate_piece` returns `passed: true`, the piece is not shipped. Period.

---

## 2. The 6 platform-level tools

### `list_platforms` / `get_platform_spec(slug)`
Returns canvas (1080×1920 for TikTok + Reels + Stories, 1080×1350 for IG Feed 4:5), every UI overlay zone (opaque vs semi-transparent), safe rect in % + pixels, platform-specific typography ranges. **Source: 2026 creator studio specs, cross-referenced across 10+ authoritative guides.**

Use it to:
- Know the safe rect before positioning anything
- Understand why text in zone X won't render visible
- See TikTok vs IG differences (right rail is 120px on TT, 84px on IG Reels)

### `list_typography_scale` / `validate_typography`
Returns roles: `mega`, `hook`, `subhook`, `body`, `cta`, `micro`, `label`. Each with canvas px range, mobile px equivalent, weight, line-height, letter-spacing, word ceiling, hint.

Key numbers (canvas pixels, 1080 wide):
- **Hook** 80–120 (mobile 29–43)
- **Body** 44–56 (mobile 16–20, target 50 for 90% of body slides)
- **CTA** 52–72
- **Mega** 120–180 (cover slide, 1–3 words isolé)
- **Micro** 26–34 (page numbers, tags)
- **Label** 28–38 (Style B pill, UPPERCASE 1–3 mots)

Hard rules: **max 3 sizes + 2 fonts per slide**. More = instant AI-slop signal.

### `list_design_primitives` / `get_design_primitive(slug)`
45+ inline SVGs bundled with Scrollbox. Zero external deps, commercial-safe, use `currentColor` so they cascade from CSS parent. Categories: arrow, tick, social (heart/star/flame/bolt/eye/thumb/bell), shape, badge (starburst/ribbon/ticket/shield/seal), divider, frame, pattern (grain/halftone/crosshatch/grid/diagonal), marker, bubble, mark (quotes/brackets/wobble-underline/circle-highlight).

### `list_layouts` / `get_layout(slug)`

**14 TikTok-native** compositions + 14 also-ran compositions for IG Feed. TikTok-native are listed first — pick from them by default :

- `tiktok_hormozi_stack` — black BG, condensed stacked text, yellow pill highlight. **Default hook**.
- `tiktok_photo_stroke_top` / `tiktok_photo_stroke_bottom` — photo full-bleed + stroked caption
- `tiktok_colored_callout` — saturated BG + ALL CAPS stack
- `tiktok_stat_punch` — giant number + tiny context. **Default body for stats**.
- `tiktok_before_after` — horizontal 50/50 split
- `tiktok_numbered_block` — huge number corner + body bloc
- `tiktok_handwritten_overlay` — photo + marker circle + curved arrow SVG
- `tiktok_gradient_mega` — saturated gradient + MEGA mot stroked
- `tiktok_screenshot_caption` — screenshot hero + bold caption above
- `tiktok_face_confession` — close-up face + giant quote stroked
- `tiktok_dropship_badge` — product photo + starburst badge + mega caption
- `tiktok_meme_annotation` — photo + 2-3 pills + arrows
- `tiktok_text_only_caps` — no photo, solid BG, dense ALL CAPS stack

**Magazine / editorial layouts** (`editorial_staggered`, `magazine_split_horizontal`, `magazine_split_vertical`, `quote_serif_center`, `block_callout`) exist but use them ONLY when the user explicitly requests IG Feed editorial.

Use them instead of:
- 4th-party emoji in a hook (plat et signal générique)
- External icon libs (extra http = skipped on render)
- Plain rectangles where a primitive badge would punch harder

Drop the SVG into a style HTML via `{{{primitive_svg}}}` (raw Handlebars) or embed in `slotData` as inline HTML.

### `analyze_inspiration({imageUrl})`
Input: URL of any image (TikTok screenshot, IG post, Pinterest, Figma export).
Output: structured `StyleDNA`:
- `palette` (5 hex: dominant, accent, paper, ink, highlight)
- `typography` (family_class, weight_band, case, tracking, 2–3 **closest Google Fonts**, stroke {color, width_px_est}, shadow)
- `layout` (density, alignment, symmetric, grid_cols, text_y_band)
- `vibe` (minimalist | editorial | bold_streetwear | corporate | organic_handmade | grunge | neon_cyberpunk | pastel_kawaii | maximalist_collage | brutalist)
- `era_reference` + `energy` + `color_temperature` + `mood_keywords`
- `brief` : natural-language summary ready to paste into a style creation or piece creation prompt

This is the antidote to the #1 competitor gap : real style reproduction, not "brand kit colors". Under the hood, Gemini Vision + a structured prompt. Typography is NOT detected by name (unreliable) — we map to closest Google Fonts family (renders-ready, reliable).

**Use cases:**
- "Reproduis ce TikTok" → `get_reference_tiktok` puis `analyze_inspiration` sur la slide 0 → piece avec `brandOverrides` (palette) + `extraFontUrls` (fonts) + style choisi selon `layout.alignment`
- "Fais-moi un style comme ça" → `analyze_inspiration` → `create_style` avec le HTML/CSS généré depuis la DNA
- Batch campaign → passe `inspirationImageUrl` à `plan_batch_campaign`, les angles seront cohérents avec la ref

### `validate_piece({pieceId})`
Runs the full validator pipeline over an existing piece :
- **Typography** : ranges per role, font count, size count
- **Copy** : vocab blacklist (AI-slop / engagement-bait / dead-CTA / hook-tease / fake-intimacy / empty-superlative / hedging / dated-opener), hook length (5-9 words), CTA present on CTA slide, no meta-info (@handle / URL / date) in body
- **Assets** : media refs valides, pas de stock photo sur slot de preuve (revenue / testimonial / certification / before-after / screenshot)

Returns `{passed, blockers[], warnings[], summary}`. `passed = false` means the piece is NOT shippable.

### `autofix_piece({pieceId})`
Produces patches :
- **Deterministic replacements** for vocab blacklist, hook truncation, meta-info strip, trailing filler
- **LLM rewrite prompts** for semantic cases (hook tease, missing CTA, engagement bait)

Apply the deterministic patches via `update_piece({pieceId, slotPatch: proposedSlotPatch})`. For rewrite prompts, run them through your own LLM pass, then `update_piece_slot`. Re-run `validate_piece` after each round — keep looping until `passed: true`.

---

## 3. Mass generation — `plan_batch_campaign`

For requests like "fais-moi 15 TikToks pour @account X autour de produit Y", this is the orchestrator.

Input:
```
{
  accountId, productId, count (1-30),
  skeletonSlug?, styleSlug?, inspirationImageUrl?,
  hookCategories? (whitelist de hook formulas),
  designPhotoMix? (0..1, default 0.5),
  userHint? (free text)
}
```

Output:
- `assignments[]` : N entries, each with a DISTINCT angle (thesis + pain + payoff + psychology lever), a rotated hook formula (spec + examples), a kind (`design` | `photo`), + a seed (hookHint, kindHint) ready to feed your LLM pass for slot filling.
- `context` (account, product, influencer) pour conditionner la voix.
- `styleDNA` (if inspiration provided) pour conditionner le design.
- `nextSteps` : instructions explicites de ce que tu fais ensuite.

The tool does **not** render. It plans. This is intentional — filling slots needs your full conversation context + account voice + hook formula execution. The tool gives you variance planning + psychology diversity + hook rotation.

### Your job after the plan

For each assignment :
1. Use `assignments[i].hookFormula.spec.structure` to craft the hook. Use `goodExample` as calibration, `badExample` as anti-pattern.
2. Use `angle.thesis` + `angle.pain` + `angle.payoff` to populate body slides.
3. Use the account's voice (from `list_style_references`) — tutoiement, phrase length, emoji rate.
4. Pick images:
   - `kind == "photo"` : call `search_account_media({influencerId})` → pick a persona photo
   - `kind == "design"` : let the style handle the background (or pick a texture pattern)
5. Call `batch_render({skeletonSlug, styleSlug, variants: [...]})` with all variants.
6. Post-render : `list_pieces({batchId})` → for each, `validate_piece` → if blockers, `autofix_piece` → `batch_update_pieces` with all autofix patches.
7. Loop validate/fix until 100% pass. Then report to user.

Guidelines baked into the planner :
- Hook formulas rotate stratified — never 15× the same formula.
- Psychology levers diversify — never all "curiosity". Plan outputs `sanityChecks.distinctLevers` (should be ≥ 5 for count ≥ 10).
- Design/photo mix respects your ratio with interleaving (DPDPDPDP, not DDDPPPPP).

### When NOT to use `plan_batch_campaign`

- Count < 5 and each piece is bespoke → skip the planner, create_piece_from_skeleton directly
- User is iterating an existing batch → `list_pieces({batchId})` + `batch_update_pieces`, not a new plan
- No product context (broad "make me content") → ask for product first via `post_agent_message`

---

## 4. Skeleton + style choice

Canvas is 1080×1920 by default. The PIECE_CANVAS constant + `list_platforms()` gives you safe zones in % — apply them to your skeleton / style choice.

**Default choices per format:**
- **TikTok carousel / video** → skeleton `handoff-1x3` (or extracted skeleton matching the reference), preset style **`scrollbox_tiktok_hormozi`** (default), `scrollbox_tiktok_creator_punch` (photo-hero creator), or `scrollbox_tiktok_drop_loud` (saturated + stats). NEVER Playfair / Fraunces / editorial serif on TikTok.
- **Instagram Reels** → same defaults as TikTok 9:16 (the 3 TikTok presets work perfectly on Reels too — they share format).
- **Instagram Feed 4:5** → this is the ONLY place editorial/magazine makes sense. Skeleton `listicle-*` + explicit `vibeHint: editorial` in `compose_piece_plan` → uses `editorial_staggered` / `magazine_split_vertical`.
- **Stories** → TikTok presets work. Less chrome, so larger text safe.

**Per account: one locked style.** The variance is in the copy + photos, not in switching style every piece. Use `duplicate_style` + `update_account({defaultStyleSlugOrId})` to lock.

### First step for any new account

If the 3 preset styles aren't in the DB yet → call `install_creation_presets()` once. Then `update_account({accountId, defaultStyleSlugOrId: "scrollbox_tiktok_hormozi"})` (or creator_punch / drop_loud) to lock the account's look.

---

## 5. Copywriting — what didn't change

(These rules predate the refonte. The validator enforces the hardest ones. Live by them.)

### 5.1 Hooks — 5-9 words, LIVRE ne TEAZE pas

The 10 hook formulas are exposed programmatically via `rotateHooks()` and surfaced in `plan_batch_campaign.assignments[*].hookFormula.spec`. Examples below; see the full list in MCP.

Pattern **interdit absolu** (validator catches it) :
> `[Phrase déclarative]. [Clause contrarian qui promet un reveal].`

Exemples to jeter :
- ❌ "4 outils dropshipping. Un seul paie."
- ❌ "J'ai testé 10 formations. Une seule marche."
- ❌ "Spoiler : ça va te choquer."
- ❌ "Le n°3 va te surprendre."
- ❌ "Wait for it."

Rule : if you can split your hook into `[A]. [B]` and B is a teaser supprimable without losing concrete info — kill B.

### 5.2 Body : 1 slide = 1 idée

Never stack `corner label + body + CTA` on one slide. One block, one beat, one idea. If you have 6 ideas, make 6 slides — not one dense slide.

Density targets :
- 8–20 mots par bloc body
- 3–8 mots par CTA
- Phrase 8–14 mots max
- 1 pronom sujet dominant (tu, toi, je), pas de mix nous/vous/tu

### 5.3 CTA : action spécifique, pas "follow for more"

Validator catches `/follow for more/`, `/suis-moi pour plus/`, `/like (et|\+) (suis-moi|follow)/`, `/tu (en )?veux (une autre|la prochaine|plus)/`.

Replacements that work on TikTok/IG 2026 :
- `Save ceci` — drives saves, algorithmically weighted
- `Commente X et je DM Y` — drives comments + DMs
- `DM 'TEMPLATE' pour [specific resource]` — direct conversion
- `Si tu fais X, arrête.` — controversy closer

### 5.4 Vocabulaire banned (validator flags them)

Voir `lib/creation/validation/vocab.ts` pour la liste complète. High-signal categories :
- **AI-slop** : `déverrouille`, `game-changer`, `transforme`, `propulse`, `ce n'est pas X c'est Y`, `moins de ... plus de ...`, `harnesses power`
- **Engagement bait** (algorithm-suppressed) : `wait for it`, `you won't believe`, `stop scrolling`, `spoiler:`, `le n°X va te choquer`
- **Fake intimacy** : `crois-moi`, `entre nous`, `franchement`, `honnêtement`, `je te jure`
- **Empty superlatives** : `incroyable`, `magique`, `épique`, `unique`, `puissant`
- **Hedging** : `peut-être`, `normalement`, `j'espère`
- **Dated openers** : `dans le monde d'aujourd'hui`, `aujourd'hui je vais te parler`, `swipe pour découvrir`, `bonjour/salut/hello` en première ligne

### 5.5 Pas de méta-info sur la slide

Validator catches `@handle`, URLs, bare years (`2026`), dates (`14/04/2026`) in body slides. Règle : la slide porte l'idée, pas la carte de visite. Handle / date / URL vont dans la bio, jamais sur la slide.

---

## 6. Asset-first : règle non-négociable

See `playbook://tiktok/asset-first` for the full text. Short version :

Avant d'écrire une piece qui mentionne une preuve (chiffre, screenshot, testimonial, visage persona) :
1. `list_media` ou `search_account_media` avec le bon filtre (`proofKind`, `influencerId`)
2. Si match : pass the `media:<uuid>` ref as the slot value
3. Si pas match : `post_agent_message` au user pour demander l'upload PRÉCIS. Mets `[UPLOAD REQUIS : <description>]` dans le slot. La piece est shippable EN ATTENDANT l'upload.

Validator (`validate_piece`) flags :
- `missing_asset` (blocker) : image slot vide
- `invalid_url` (blocker) : valeur ni `media:` ni URL http
- `placeholder_unresolved` (warning) : `[UPLOAD REQUIS]` encore présent
- `fabricated_stock_on_proof_slot` (blocker) : slot `revenue/testimonial/etc.` rempli avec URL externe = risque asset bidon

Don't get around these by filling a proof slot with a random generic URL. The system catches it.

---

## 7. Iterate, never re-create

When the user says "corrige X sur ces 40 pieces" :

- ✅ `list_pieces({batchId})` → récupère les 40 ids → `batch_update_pieces({patches: [...]})` en UNE call. Surgical re-render des slides impactées.
- ❌ `batch_render` avec les 40 mêmes variants. Crée 40 doublons. Saccage l'organisation.

When the user wants to keep the old version AND test a new one :
- Pass `preserveAsVersion: true` dans le patch → la piece originale reste intacte, une v2 est créée, `parent_piece_id` lie les deux. `list_piece_versions({pieceId})` montre l'historique.

When the user says "change le style sur ce compte" :
- `rerender_with_style({pieceId, styleSlug})` — swaps style, garde skeleton + slot_data, re-render complet.
- OR `update_piece({pieceId, brandOverrides: {primary:'#XXX', accent:'#YYY'}})` si ce n'est que des couleurs.

---

## 8. Handle user feedback via /design annotations

The user can click on a rendered slide on `/design` and annotate it. Each annotation has `xPct/yPct`, `note`, optional `actionHints` like `["bigger","smaller","replace_word"]`.

Workflow :
1. `list_piece_annotations({status:'open'})` au début d'une session ou sur ping user
2. Pour chaque annotation, applique le fix (update_piece_slot / rerender_with_style / update_piece selon la cible)
3. `resolve_annotation({annotationId, status:'applied', resolutionNote})`

Les annotations non-résolues restent visibles pour l'user sur /design — c'est ta todo.

---

## 9. Complete session example — "fais-moi 15 TikToks pour @blvdr autour du produit Z"

```
(bootstrap) resources/read playbook://creation/framework
            list_platforms()  → TikTok 9:16 safe y [10.9, 78], right rail 88.9%
            list_typography_scale()  → hook 80-120, body 44-56

(context)   list_accounts() → find @blvdr → accountId
            get_account_context(accountId)  → voice, defaultStyleId
            list_style_references(accountId)  → load codes

(optional)  If user mentioned a ref : analyze_inspiration({imageUrl}) → styleDNA

(plan)      plan_batch_campaign({
              accountId: 'blvdr-uuid',
              productId: 'Z-uuid',
              count: 15,
              inspirationImageUrl: ?,  // if applicable
              designPhotoMix: 0.4,     // 40% photo persona, 60% design
              userHint: 'hooks orientés curiosité'
            })
            → 15 distinct angles, 6-7 distinct levers, rotated hook formulas

(fill)      For each of 15 assignments :
              - Pick hook using hookFormula.spec.structure
              - Fill body using angle.thesis + angle.payoff, in @blvdr's voice
              - If kind=photo : search_account_media({influencerId, proofKind? }) → pick
              - If kind=design : let style handle background
              - If asset manquant : post_agent_message + [UPLOAD REQUIS]

(render)    batch_render({
              skeletonSlug, styleSlug,
              variants: [ ... 15 variants with slot_data + photoAssignments ... ]
            })

(validate)  list_pieces({batchId}) → for each pieceId, validate_piece
            Expected output : 0 blockers (the planner + validator-aware fill
            minimizes issues). Typical warnings : 1-2 slides per piece.

(fix)       If any blockers :
              autofix_piece({pieceId}) → patches + rewritePrompts
              For rewritePrompts, run LLM pass → update_piece_slot
              For patches, batch_update_pieces({patches: proposedSlotPatches})
              Re-run validate_piece → continue until all pass

(ship)      Report to user with 15 piece URLs + validation summary
```

---

## 10. Sanity checklist before claiming a batch "done"

- [ ] Every piece has `status === "ready"` and validated (`validate_piece.passed === true`)
- [ ] Every piece is rendered (non-empty `renderedUrls[]`)
- [ ] No `[UPLOAD REQUIS]` placeholder remaining anywhere
- [ ] No annotation in `status === "open"` on these pieces
- [ ] Distinct hook formulas across the batch (min 5 distinct on a batch of 10+)
- [ ] Distinct psychology levers (min 5 on a batch of 10+)
- [ ] All CTAs are action-specific (no "Follow for more")
- [ ] No piece has `warnings` > 3 that suggest a rushed pass

If any checkbox fails, you're not done. Loop.

---

## 11. When to stop and ask

`post_agent_message` the user when :
- Missing asset (proof, persona photo, product shot) — describe precisely what you need
- Product context is thin (no niche, no audience, no description) — ask before batching 15
- User said "fais comme @X" but you can't find an image or URL — ask for the ref
- Validator keeps returning the same semantic blocker after 2 autofix rounds — surface the stuck piece to user for direction

Asking is not a cost. Asking is the workflow. Fabricating is the failure.

---

## 12. What this skill deliberately does not cover

- **Publishing / scheduling** : not our surface. Scrollbox is generation-only. Users post manually.
- **Video rendering** : the skill is for image carousels (1080×1920 / 1080×1350 PNG). Video is a separate pipeline.
- **API integrations to TikTok / IG / Meta** : none. We don't touch creator APIs.

If the user asks "publish this to TikTok", explain the scope and remind them Scrollbox generates, doesn't post.

---

## Appendix — pointer to code

The rules above are enforced by code under `lib/creation/*` :

- `lib/creation/platforms/` — platform specs
- `lib/creation/typography/` — scale + validator
- `lib/creation/primitives/` — SVG library (45+)
- `lib/creation/inspiration/` — Style DNA decomposer
- `lib/creation/validation/` — vocab blacklist + copy rules + asset checks
- `lib/creation/autocorrect/` — patch generator
- `lib/creation/variants/` — angle generator + hook rotator + mix orchestrator

MCP surface : `lib/mcp/tools/creation/*` registered in `lib/mcp/server.ts`.

If a rule feels wrong, check the code first. If the code is wrong, PR it. The skill evolves with the validator — keep them in sync.
