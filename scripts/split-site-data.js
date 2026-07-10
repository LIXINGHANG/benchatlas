#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const fullBundlePath = path.join(root, "site_data.bundle.js");
const indexBundlePath = path.join(root, "site_data.index.bundle.js");
const benchmarkDir = path.join(root, "data", "benchmarks");
const pageBundleDir = path.join(root, "data", "pages");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(fullBundlePath, "utf8"), sandbox);
const data = sandbox.window.BENCHATLAS_DATA;

if (!data?.benchmark_pages || !Array.isArray(data.benchmark_catalog)) {
  throw new Error("site_data.bundle.js does not contain the expected BenchAtlas payload");
}

fs.rmSync(benchmarkDir, { recursive: true, force: true });
fs.rmSync(pageBundleDir, { recursive: true, force: true });
fs.mkdirSync(benchmarkDir, { recursive: true });
fs.mkdirSync(path.join(pageBundleDir, "benchmarks"), { recursive: true });
fs.mkdirSync(path.join(pageBundleDir, "models"), { recursive: true });

const catalog = data.benchmark_catalog.map(item => {
  const page = data.benchmark_pages[item.rank_group_key];
  const searchModels = [...new Set((page?.rows || []).map(row => row.model_name).filter(Boolean))];
  return { ...item, search_models: searchModels };
});

const indexPayload = {
  summary: data.summary,
  model_catalog: data.model_catalog,
  benchmark_catalog: catalog,
};

function comparisonGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const id = row.comparability_group_id || `legacy--${row.source_report_id || "unknown"}`;
    if (!groups.has(id)) groups.set(id, {
      status: row.comparability_status || "source_scoped",
      rows: [],
    });
    groups.get(id).rows.push(row);
  }
  return [...groups.values()].map(group => {
    group.modelCount = new Set(group.rows.map(row => row.model_id || row.model_name)).size;
    group.rows.sort((a, b) => Number(a.rank) - Number(b.rank));
    return group;
  }).sort((a, b) => (
    Number(b.status === "strict") - Number(a.status === "strict")
    || b.modelCount - a.modelCount
    || b.rows.length - a.rows.length
  ));
}

function preferredRows(rows) {
  const group = comparisonGroups(rows)[0];
  if (!group) return [];
  const seen = new Set();
  return group.rows.filter(row => {
    const key = row.model_id || row.model_name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildOverallData() {
  const modelByName = new Map(data.model_catalog.map(model => [model.model_name, model]));
  const observations = new Map();
  let benchmarkGroupCount = 0;
  for (const [benchmarkKey, page] of Object.entries(data.benchmark_pages)) {
    const rows = preferredRows(page.rows);
    if (rows.length < 3 || new Set(rows.map(row => row.vendor)).size < 2) continue;
    benchmarkGroupCount += 1;
    let previousScore = null;
    let rank = 0;
    rows.forEach((row, index) => {
      if (previousScore === null || String(row.score) !== previousScore) {
        rank = index + 1;
        previousScore = String(row.score);
      }
      if (!observations.has(row.model_name)) observations.set(row.model_name, []);
      observations.get(row.model_name).push({
        benchmark_key: benchmarkKey,
        domain: page.domain,
        percentile: 100 * (rows.length - rank) / (rows.length - 1),
      });
    });
  }

  const rankings = [];
  for (const [modelName, rows] of observations) {
    const domains = new Map();
    for (const row of rows) {
      if (!domains.has(row.domain)) domains.set(row.domain, []);
      domains.get(row.domain).push(row.percentile);
    }
    if (rows.length < 5 || domains.size < 2) continue;
    const domainMeans = [...domains.values()].map(values => values.reduce((sum, value) => sum + value, 0) / values.length);
    const rawScore = domainMeans.reduce((sum, value) => sum + value, 0) / domainMeans.length;
    const indexScore = 50 + (rawScore - 50) * (rows.length / (rows.length + 10));
    const model = modelByName.get(modelName);
    rankings.push({
      model_name: modelName,
      vendor: model?.vendor || "Unknown",
      index_score: Number(indexScore.toFixed(1)),
      raw_score: Number(rawScore.toFixed(1)),
      benchmark_count: rows.length,
      domain_count: domains.size,
      report_count: Number(model?.report_count || 0),
      confidence: rows.length >= 25 && domains.size >= 5 ? "high" : rows.length >= 10 && domains.size >= 3 ? "medium" : "limited",
    });
  }
  rankings.sort((a, b) => b.index_score - a.index_score || b.benchmark_count - a.benchmark_count);
  let previousIndex = null;
  let rank = 0;
  rankings.forEach((row, index) => {
    if (previousIndex === null || row.index_score !== previousIndex) {
      rank = index + 1;
      previousIndex = row.index_score;
    }
    row.overall_rank = rank;
  });
  return { rankings, benchmarkGroupCount };
}

function writeBundle(destination, payload, merge = false) {
  const assignment = merge
    ? `window.BENCHATLAS_DATA = Object.assign({}, window.BENCHATLAS_DATA, ${JSON.stringify(payload)});\n`
    : `window.BENCHATLAS_DATA = ${JSON.stringify(payload)};\n`;
  fs.writeFileSync(destination, assignment, "utf8");
}

function scopedPayload(scope, scopeKey, pages, overallData) {
  return {
    scope,
    scope_key: scopeKey,
    benchmark_pages: pages,
    overall_data: overallData,
  };
}

const overallData = buildOverallData();

fs.writeFileSync(
  indexBundlePath,
  `window.BENCHATLAS_DATA = ${JSON.stringify(indexPayload)};\n`,
  "utf8",
);

for (const [key, page] of Object.entries(data.benchmark_pages)) {
  fs.writeFileSync(path.join(benchmarkDir, `${key}.json`), JSON.stringify(page), "utf8");
  writeBundle(
    path.join(pageBundleDir, "benchmarks", `${key}.bundle.js`),
    scopedPayload("benchmark", key, { [key]: page }, overallData),
    true,
  );
}

for (const model of data.model_catalog) {
  const modelPages = {};
  for (const [key, page] of Object.entries(data.benchmark_pages)) {
    const rows = page.rows.filter(row => row.model_id === model.model_id);
    if (rows.length) modelPages[key] = { ...page, rows };
  }
  writeBundle(
    path.join(pageBundleDir, "models", `${model.model_id}.bundle.js`),
    scopedPayload("model", model.model_name, modelPages, overallData),
    true,
  );
}

writeBundle(
  path.join(pageBundleDir, "ranking.bundle.js"),
  scopedPayload("ranking", "overall", {}, overallData),
  true,
);

console.log(
  `Wrote ${catalog.length} catalog rows, ${Object.keys(data.benchmark_pages).length} benchmark bundles, ${data.model_catalog.length} model bundles, and ranking data.`,
);
