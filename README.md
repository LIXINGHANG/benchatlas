# BenchAtlas

**An evidence-first atlas of AI benchmarks, reported model scores, evaluation settings, and capability coverage.**

[English](README.md) | [简体中文](README.zh-CN.md)

[Open BenchAtlas](https://benchatlas.cn/) · [Chinese site](https://benchatlas.cn/zh/) · [Overall ranking](https://benchatlas.cn/ranking/) · [Report a data issue](https://github.com/LIXINGHANG/benchatlas/issues/new?template=data-correction.yml)

![BenchAtlas interface preview](social-preview.png)

BenchAtlas converts official model cards, system cards, release pages, and technical reports into a searchable benchmark dataset. It keeps the reported score together with its source, evidence location, model configuration, evaluation setup, and method notes whenever those details are available.

The goal is not to create another context-free leaderboard. BenchAtlas helps readers understand **what was measured, under which conditions, by whom, and whether two reported scores are actually comparable**.

## What BenchAtlas answers

1. Which benchmarks appear in a model's official report?
2. Which scores were reported for each base model and configuration?
3. What harness, tools, reasoning mode, context window, sampling settings, judge, task subset, and run count were used?
4. Which results share sufficiently similar evaluation settings to compare directly?
5. What does a model's best publicly reported capability coverage look like across domains?

## Current dataset

| Data | Current snapshot |
| --- | ---: |
| Reported result rows | 1,681 |
| Base models | 32 |
| Reported entities and configurations | 58 |
| Raw model labels preserved | 65 |
| Normalized benchmark pages | 401 |
| Source reports | 11 |
| Evaluation configuration records | 386 |
| Rows in documented shared-comparison groups | 695 |
| Source-scoped rows | 986 |

The dataset grows as new official reports are imported. The [live site](https://benchatlas.cn/) is the source of truth for current totals.

## Core features

### Spatial Atlas

- Explore benchmarks across six stable capability regions.
- Filter the map by capability field, base model, or safety evaluation.
- Search for a benchmark or model and open its evidence panel.
- Use semantic zoom to reveal progressively more benchmarks: 42 landmarks at field level, 54 at detail level, and 60 at deep level.
- Read map position semantically: broader, better-documented landmarks sit closer to a field center; newer or more specialized benchmarks sit farther out.

### Benchmark comparison

- See a unified ranking of reported base-model scores for one benchmark.
- Use **Comparison Group A/B/...** colors to identify evaluation settings that may be compared directly.
- Keep cross-group scores visible without pretending that different setups are equivalent.
- Inspect alternative source rows when the same model and benchmark have multiple reported values.

### Evidence and method notes

- Open the originating report or release page for every result.
- Preserve table, figure, page, line, or section locations when available.
- Separate method notes into evaluation setup, reasoning configuration, agent/tool scaffold, dataset variant, runs and aggregation, and source caveats.

### Model and ranking views

- Open a model page to inspect its benchmark coverage, configurations, reports, and source-linked scores.
- Filter the atlas to one model to see where it has and has not reported results.
- Explore the **Reported Capability Ceiling**, which summarizes each base model using its best publicly reported eligible configurations.
- Keep agent systems, checkpoints, and baselines separate from base-model ranking entities.

### Catalog and Matrix

- Switch from the visual map to a dense benchmark catalog.
- Compare selected models in a benchmark-by-model matrix.
- Treat matrix colors as reported-value context, not as proof that cross-group evaluations are strictly comparable.

## How to use the site

1. Start on the [Spatial Atlas](https://benchatlas.cn/).
2. Choose a capability field or model from the top filters.
3. Zoom into a region to reveal additional, more specialized benchmarks.
4. Select a benchmark node to open its unified reported ranking.
5. Compare rows with the same **Comparison Group** color.
6. Select a score to inspect its source, configuration, structured method notes, and evidence location.
7. Open the primary source before using a number in research, procurement, or model evaluation.

## Comparison groups

A comparison group is not a formal benchmark standard and is not merely a source label. It is BenchAtlas's user-facing representation of rows whose documented evaluation settings are sufficiently aligned for direct comparison.

Grouping considers, where available:

- benchmark version, subset, and metric;
- score direction and aggregation;
- agent harness, tools, and external access;
- context window, timeout, and compute environment;
- sampling and reasoning configuration;
- judge model or grading procedure;
- number of runs and task corrections;
- source-specific methodology notes.

Rows with a documented shared setup may appear in the same comparison group. Rows without enough methodology remain source-scoped. Different colors indicate different groups; only same-color rows should be treated as directly comparable.

## Reported Capability Ceiling

The overall ranking represents a model's **publicly reported capability ceiling**, not its default product experience, API latency, cost, or an absolute intelligence score.

1. Each benchmark contributes an eligible comparison group with enough cross-vendor coverage.
2. Model ranks are converted into a 0–100 percentile within that group.
3. Benchmark percentiles are averaged within capability domains.
4. Domains receive equal weight so one heavily reported field does not dominate the index.
5. Limited coverage is shrunk toward 50 and shown with a confidence signal.
6. Agent systems, checkpoints, baselines, and other non-base-model entities are excluded.
7. The best eligible publicly reported configuration may represent a model's upper bound rather than its default setting.

Because the index is built from vendor-published reports, it may inherit benchmark-selection and reporting bias. Always inspect the underlying result rows.

## Map taxonomy

BenchAtlas maps report-native domain labels into six capability regions:

1. Reasoning & Knowledge
2. Coding & Software Engineering
3. Agents & Computer Use
4. Multimodal & Perception
5. Language & Long Context
6. Expert & Frontier Domains

Safety is an orthogonal filter rather than a separate capability region. Original report-native labels remain preserved in the dataset and evidence views.

Within each region:

- direction represents a secondary field such as mathematics, software engineering, terminal systems, tools, long context, or health;
- distance from the center combines model coverage (60%), report coverage (25%), and documented method signals (15%);
- semantic zoom expands each region from 7 to 9 and then 10 benchmark families;
- solid red routes connect variants from the same benchmark family;
- dashed blue routes connect landmarks with strongly overlapping reported-model coverage.

## Data policy

- Preserve official reported values rather than silently recalculating them.
- Keep multiple source rows when reports disagree.
- Preserve model configurations while mapping them to a stable base model.
- Separate base models from agent systems, checkpoints, and baselines.
- Keep benchmark variants separate when their datasets, metrics, harnesses, or task subsets differ materially.
- Attach every imported row to a report and evidence location whenever possible.
- Mark uncertain or incomplete methodology as source-scoped instead of forcing comparability.

Normalization rules are public in [`data/normalization_rules.json`](data/normalization_rules.json).

## Contributing

High-value contributions include:

- submitting a newly released official model card or technical report;
- correcting a score, model label, benchmark name, metric, or evidence location;
- adding missing evaluation settings or method notes;
- improving model and benchmark normalization rules;
- improving extraction, review, validation, or frontend workflows.

Read [CONTRIBUTING.md](CONTRIBUTING.md), then open an issue or pull request. Data corrections should cite an official report page, table, figure, footnote, or methodology section.

## Local development

BenchAtlas is a static site with no required frontend build framework.

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/`.

After updating the bundled dataset, regenerate split data and indexable pages with:

```bash
node scripts/generate-seo-pages.js
```

Validate base-model, configuration, and reference-entity separation with:

```bash
node scripts/validate-model-entities.js
```

## Repository structure

| Path | Purpose |
| --- | --- |
| `index.html`, `zh/index.html` | English and Chinese Spatial Atlas applications |
| `spatial-app.js` | Map, filters, comparison groups, inspector, Matrix, and ranking behavior |
| `site_data.bundle.js` | Full normalized benchmark dataset |
| `site_data.index.bundle.js` | Compact homepage catalog |
| `data/benchmarks/` | Per-benchmark rows and evidence loaded on demand |
| `data/pages/` | Route-scoped benchmark, model, and ranking bundles |
| `data/normalization_rules.json` | Auditable model and benchmark normalization rules |
| `scripts/` | Data splitting, page generation, and entity validation |
| `benchmarks/`, `models/`, `ranking/` | Generated English detail pages |
| `zh/benchmarks/`, `zh/models/`, `zh/ranking/` | Generated Chinese detail pages |

## Citation

```text
BenchAtlas: Explore the landscape of AI benchmarks.
https://github.com/LIXINGHANG/benchatlas
Accessed YYYY-MM-DD.
```

## License

Original source code is released under the [MIT License](LICENSE). Official model reports, quoted excerpts, model names, benchmark names, and other third-party materials remain the property of their respective owners. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
