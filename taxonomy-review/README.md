# Taxonomy Review

Open `/taxonomy-review/` from the deployed site or a local HTTP server.

## Workflow

1. Select a primary domain in the left rail.
2. Drag a Benchmark card to a subfield column, or edit its classification in the inspector.
3. Mark it as `已确认` or `需讨论` and optionally add a note.
4. Export `taxonomy_review_patch.json`.
5. Validate the downloaded file:

```bash
node scripts/validate-taxonomy-review-patch.js ~/Downloads/taxonomy_review_patch_YYYY-MM-DD.json
```

The page never writes `data/benchmark_taxonomy.json`. Review progress is stored in browser `localStorage`. Import the exported patch to continue in another browser.

Cards are keyed by exact `benchmark_name`, matching `benchmark_overrides`. A card can contain multiple rank groups; moving it intentionally changes the classification for all linked metric and variant groups.
