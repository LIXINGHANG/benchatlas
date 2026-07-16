# Taxonomy Review

Open `/taxonomy-review/` from the deployed site or a local HTTP server.

## Workflow

1. Select one of the six capability domains in the left rail.
2. Drag a Benchmark card to a capability subfield, or edit its capability classification in the inspector.
3. Open the cross-domain `安全与对齐` board to review evaluation purpose and drag safety benchmarks between the seven safety categories.
4. Mark the Benchmark as `已确认` or `需讨论` and optionally add a note.
5. Export `taxonomy_review_patch.json`.
6. Validate the downloaded file:

```bash
node scripts/validate-taxonomy-review-patch.js ~/Downloads/taxonomy_review_patch_YYYY-MM-DD.json
```

The page never writes `data/benchmark_taxonomy.json`. Review progress is stored in browser `localStorage`. Import the exported patch to continue in another browser.

Cards are keyed by exact `benchmark_name`, matching `benchmark_overrides`. A card can contain multiple rank groups; moving it intentionally changes the classification for all linked metric and variant groups. Capability classification and Safety & Alignment purpose are independent: changing one does not overwrite the other in the exported patch.
