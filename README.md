# BenchAtlas

**Explore the landscape of AI benchmarks with source evidence and evaluation context.**

[Open BenchAtlas](https://benchatlas.cn/) · [Overall model ranking](https://benchatlas.cn/ranking/) · [Report a data issue](https://github.com/LIXINGHANG/benchatlas/issues/new?template=data-correction.yml)

![BenchAtlas social preview](social-preview.png)

BenchAtlas turns official model cards and technical reports into an explorable benchmark atlas. Instead of showing a score without context, every result keeps its source, evidence location, evaluation protocol, and method notes whenever the report provides them.

## Why BenchAtlas

AI benchmark numbers are often difficult to compare. Two vendors may report the same benchmark with different agent harnesses, context windows, tool access, sampling settings, task subsets, judges, or run counts.

BenchAtlas is designed to answer four questions:

1. Which benchmarks appear in each model report?
2. What scores were reported for each model?
3. Under what environment and evaluation protocol were those scores produced?
4. How do models rank when the available reports contain comparable results?

## Current coverage

| Data | Coverage |
| --- | ---: |
| Reported result rows | 1,681 |
| Models | 65 |
| Benchmark groups | 410 |
| Source reports | 11 |
| Rows with protocol information | 386 |

Coverage changes as new official reports are imported. The live site is the source of truth for current totals.

## Features

- **Spatial Atlas**: discover high-coverage benchmarks as domain-clustered, searchable map nodes.
- **Registry and Matrix**: switch from spatial discovery to dense lookup or model-by-benchmark comparison.
- **Benchmark view**: compare reported scores, protocols, and source evidence.
- **Model view**: inspect every benchmark result associated with one model.
- **Overall ranking**: explore the Reported Performance Index with coverage and confidence signals.
- **Method notes**: preserve harnesses, tools, judges, run counts, context limits, and other evaluation settings.
- **Shareable pages**: every model and benchmark has an indexable permalink.
- **Evidence-first data**: each row remains linked to its originating report and evidence location.

## Overall ranking methodology

The Reported Performance Index (RPI) is a coverage-adjusted summary of published benchmark rankings. It is not an absolute model capability score.

1. Within each eligible benchmark group, model ranks are converted to a 0–100 percentile.
2. Benchmark percentiles are averaged within each domain.
3. Domains receive equal weight so one heavily reported domain does not dominate the result.
4. Limited benchmark coverage is shrunk toward 50.
5. A benchmark group needs at least three models from two vendors.
6. A model needs at least five eligible benchmark groups across two domains.

Because the index uses vendor-published reports, it may inherit benchmark-selection and reporting bias. Always inspect the underlying rows before drawing strong conclusions.

## Data policy

- Reported numbers are preserved rather than silently normalized.
- Protocol variants remain visible when evaluation settings differ.
- Multiple reported results may be retained for the same model and benchmark.
- Source evidence and short quotations are included for verification.
- Corrections should cite an official report page, table, figure, footnote, or methodology section.

## Contributing

The most useful contributions are:

- submitting a newly released official model card;
- correcting a score, model name, metric, or evidence location;
- adding missing evaluation protocol details;
- improving benchmark normalization and comparability rules;
- improving the explorer and data-review workflow.

Read [CONTRIBUTING.md](CONTRIBUTING.md), then use one of the issue templates or open a pull request.

## Local development

BenchAtlas is a static site with no required build framework.

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/`.

To regenerate model pages, benchmark pages, ranking pages, and `sitemap.xml` after updating the bundled data:

```bash
node scripts/generate-seo-pages.js
```

## Repository structure

| Path | Purpose |
| --- | --- |
| `index.html` | Spatial Atlas homepage, Registry, Matrix, and evidence inspector |
| `app.js` | Legacy detail views, filtering, routing, and ranking logic |
| `site_data.bundle.js` | Bundled normalized benchmark dataset |
| `scripts/generate-seo-pages.js` | Generates clean, indexable detail URLs |
| `models/` | Generated model pages |
| `benchmarks/` | Generated benchmark pages |
| `ranking/` | Generated overall ranking page |

## Citation

If BenchAtlas supports your research or analysis, cite the repository and include the date you accessed the data:

```text
BenchAtlas: Explore the landscape of AI benchmarks.
https://github.com/LIXINGHANG/benchatlas
Accessed YYYY-MM-DD.
```

## License

Original source code is released under the [MIT License](LICENSE). Official model reports, quoted excerpts, model names, benchmark names, and other third-party materials remain the property of their respective owners; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## 中文简介

BenchAtlas 将模型厂商发布的 Model Card 和技术报告整理成可检索、可核验的 benchmark 数据库。网站不仅展示分数，还保留运行环境、Agent Harness、工具权限、采样参数、评测次数、裁判模型和原始证据位置。欢迎通过 Issue 提交新报告或指出数据问题。
