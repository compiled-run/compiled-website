Fable-Opus-Unit: scoped-styles-fix/investigate-empty-arm-producer
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 30

## Goal

Read-only root-cause. A compile-time fix (empty ternary class arm on a scoped element bakes to the scope class alone) is verified present in the shipped compiler dist, and works for ternaries whose arms are BOTH non-empty — yet the consuming docs site's built payload still emits the OLD shape for empty-arm ternaries. Find the actual producer of those targets.

**Hard evidence, all fresh:**
- Installed compiler dist (`/Users/jacksm5pro/dev/open-source/markless/.claude/worktrees/compiled-website/node_modules/@markless/compiler/dist/index.js`) contains the NEW logic: `scopeClass ? arm === "" ? scopeClass : \`${arm} ${scopeClass}\` : arm` — verified by direct grep.
- The docs site was fully wiped and reinstalled from tarballs packed off integration tip e9353b0a (which includes the fix; its unit's tests assert falseValue carries the scope class alone, 179 green), then `npm run build` rebuilt `.output` fresh.
- Freshly built payload (prod AND dev identical): ternary `'line hot'/'line'` (both arms non-empty) → `{"trueValue":"line hot mk-gxl5ud","falseValue":"line mk-gxl5ud"}` — CORRECT. Ternary `'hot'/''` (empty false arm) → `{"trueValue":"hot mk-gxl5ud","falseValue":""}` — the PRE-fix shape (non-empty arm scoped, empty arm untouched).
- The dist has exactly one `trueValue: scoped(trueValue)` producer (the fixed one) plus a `{ trueValue: target.trueValue }` copy site (protocol-view) plus a `kind:"text"` conditional-branch-text producer (irrelevant).
- The affected bindings live on a `.tsrx` component (`components/demos/hero-card.tsrx` in the docs site) reached from an MDX page via the router pipeline (`?markless-render-data&markless-reached-from=…mdx` style transforms).

**Your job:** in the framework source (your worktree; run `git reset --hard e9353b0a` first and confirm), trace how an empty-arm class ternary on a scoped element compiles END TO END for a component reached via the router/MDX path, and name the exact producer that emits `falseValue: ""` — with file:line. Candidates to check: whether `conditionalClassTarget` is even reached for these bindings (or whether a pre-check like `isAlwaysPresentValue` / the T007 always-present class routing sends empty-arm ternaries down a DIFFERENT lowering that mints its own target); whether `emitDynamicHost` or the attribute-slot path mints class targets for ternaries; whether protocol-view's arm-record path re-derives arms from AST rather than copying the fixed target; and whether the router's MDX transform invokes a different compile entry with different options. You may also read the docs site's built output (`.claude/worktrees/compiled-website/.output/`) and its node_modules dists as evidence. No edits, no installs (pnpm install in YOUR worktree only if you need to run a focused compiler test to reproduce — that is allowed), no builds of the docs site, no servers.

Reproduce minimally if you can: a scoped component with `class={cond ? 'hot' : ''}` compiled through whatever entry the router path uses, showing the bad target.

## Return

The producer file:line, why the fixed `scoped()` is bypassed for this shape, the minimal fix and its test home, and whether the same bypass affects the both-arms case in ways we have not noticed. Fenced JSON receipt.

## File contract

- none

## Forbidden moves

- No edits or writes outside your own worktree's node_modules (install only). Why: evidence-gathering; a fix unit follows.
- No docs-site builds or servers; no budget tests.

## Verification

```verify
```

Read-only unit.

## Blocked permission

If the reset cannot reach e9353b0a or the evidence contradicts itself irreconcilably, return status "blocked" with specifics in open_questions.