# Contributing to BenchAtlas

BenchAtlas welcomes evidence-backed corrections, new official model reports, protocol details, and improvements to the explorer.

## Before submitting

1. Prefer primary sources: official model cards, technical reports, vendor release pages, or benchmark documentation.
2. Identify the exact page, table, figure, footnote, or section supporting the change.
3. Preserve the reported metric and evaluation setting. Do not normalize a score without documenting the transformation.
4. Keep protocol variants separate when harnesses, tools, judges, task subsets, or sampling settings differ.

## Submit a model report

Open the **New model report** issue template and include:

- vendor and model name;
- official release or report URL;
- publication date;
- whether the source is PDF, HTML, or both;
- any known evaluation methodology pages.

## Report a data correction

Open the **Data correction** issue template. Include the current BenchAtlas row, the expected value, and exact source evidence. Screenshots are helpful, but always include the original source URL when available.

## Pull requests

1. Create a focused branch.
2. Keep generated files synchronized with their inputs.
3. Run `node scripts/generate-seo-pages.js` after changing `site_data.bundle.js`, page metadata, or routing.
4. Run `node --check app.js` and `node --check scripts/generate-seo-pages.js`.
5. Verify the main explorer and at least one generated model and benchmark URL locally.
6. Explain the source evidence and user-visible effect in the pull request.

## Data review standard

A result is ready to publish when its model, benchmark, metric, score, source report, evidence location, and available protocol notes agree with the primary source. If evidence is incomplete, mark the limitation rather than inferring an unsupported setting.

## Community expectations

Be precise, cite evidence, and assume good faith. Benchmark comparability is often ambiguous; disagreements should focus on sources, methodology, and reproducible definitions.
