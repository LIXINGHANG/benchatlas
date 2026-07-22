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

function normalizedPublisher(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("anthropic")) return "anthropic";
  if (text.includes("openai")) return "openai";
  if (text.includes("google") || text.includes("deepmind") || text.includes("gemini")) return "googledeepmind";
  if (text.includes("qwen")) return "qwen";
  if (text.includes("deepseek")) return "deepseek";
  if (text.includes("bytedance") || text.includes("bytedns") || text.includes("seed")) return "bytedanceseed";
  if (text.includes("moonshot") || text.includes("kimi")) return "moonshotkimi";
  if (text.includes("z.ai") || text.includes("zai") || text.includes("glm")) return "zai";
  if (text.includes("x.ai") || text.includes("xai") || text.includes("grok")) return "xai";
  return text.replace(/[^a-z0-9]/g, "");
}

function isFirstPartyRow(row) {
  const publishers = Array.isArray(row.source_reports)
    ? row.source_reports.map(report => report.source_publisher)
    : String(row.source_publisher || "").split("; ");
  return publishers.some(publisher => normalizedPublisher(row.vendor) === normalizedPublisher(publisher));
}

function isRankingEligible(row) {
  return row.ranking_eligible !== false && !["agent_system", "baseline", "checkpoint"].includes(row.entity_type);
}

function preferredModelRow(rows) {
  return [...rows].sort((a, b) => (
    Number(a.rank || Infinity) - Number(b.rank || Infinity)
    || Number(isFirstPartyRow(b)) - Number(isFirstPartyRow(a))
    || String(a.source_report_id || a.source_url || "").localeCompare(String(b.source_report_id || b.source_url || ""))
  ))[0];
}

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
  const rows = page?.rows || [];
  const searchModels = [...new Set(rows.flatMap(row => [row.model_name, row.reported_model_name]).filter(Boolean))];
  const preferredByModel = new Map(preferredRows(rows).map(row => [row.model_id || row.model_name, row]));
  const modelScores = {};
  for (const row of rows.filter(isRankingEligible)) {
    const modelKey = row.model_id || row.model_name;
    if (!modelKey || modelScores[modelKey]) continue;
    const selected = preferredByModel.get(modelKey) || row;
    modelScores[modelKey] = {
      s: selected.score,
      u: selected.score_unit,
      g: selected.comparability_group_id,
      c: selected.comparability_status,
      n: selected.model_configuration || "Standard",
    };
  }
  return { ...item, search_models: searchModels, model_scores: modelScores };
});

const indexPayload = {
  summary: data.summary,
  taxonomy: data.taxonomy,
  model_catalog: data.model_catalog,
  report_catalog: data.report_catalog || [],
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
    group.modelCount = new Set(group.rows.filter(isRankingEligible).map(row => row.base_model_id || row.model_id || row.model_name)).size;
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
  const rowsByModel = new Map();
  for (const row of group.rows.filter(isRankingEligible)) {
    const key = row.base_model_id || row.model_id || row.model_name;
    if (!rowsByModel.has(key)) rowsByModel.set(key, []);
    rowsByModel.get(key).push(row);
  }
  const preferred = new Map([...rowsByModel].map(([key, modelRows]) => [key, preferredModelRow(modelRows)]));
  return group.rows.filter(row => isRankingEligible(row) && preferred.get(row.base_model_id || row.model_id || row.model_name) === row);
}

function rankingGroups(rows) {
  return comparisonGroups(rows).map(group => {
    const rowsByModel = new Map();
    for (const row of group.rows.filter(isRankingEligible)) {
      const key = row.base_model_id || row.model_id || row.model_name;
      if (!rowsByModel.has(key)) rowsByModel.set(key, []);
      rowsByModel.get(key).push(row);
    }
    const selectedRows = [...rowsByModel.values()]
      .map(preferredModelRow)
      .sort((a, b) => Number(a.rank || Infinity) - Number(b.rank || Infinity));
    return {
      ...group,
      rows: selectedRows,
      vendorCount: new Set(selectedRows.map(row => row.vendor)).size,
    };
  }).filter(group => group.rows.length >= 3 && group.vendorCount >= 2);
}

function buildOverallData() {
  const modelById = new Map(data.model_catalog.map(model => [model.model_id, model]));
  const observations = new Map();
  const benchmarkFamilies = new Set();
  let validComparisonGroupCount = 0;
  for (const [benchmarkKey, page] of Object.entries(data.benchmark_pages)) {
    if (page.ranking_excluded || page.benchmark_type === "composite_index") continue;
    const benchmarkFamilyId = page.benchmark_family_id || benchmarkKey;
    for (const group of rankingGroups(page.rows)) {
      benchmarkFamilies.add(benchmarkFamilyId);
      validComparisonGroupCount += 1;
      let previousScore = null;
      let rank = 0;
      group.rows.forEach((row, index) => {
        if (previousScore === null || String(row.score) !== previousScore) {
          rank = index + 1;
          previousScore = String(row.score);
        }
        const modelId = row.base_model_id || row.model_id;
        if (!observations.has(modelId)) observations.set(modelId, []);
        observations.get(modelId).push({
          benchmark_key: benchmarkKey,
          benchmark_family_id: benchmarkFamilyId,
          comparability_group_id: row.comparability_group_id,
          domain: page.primary_domain || page.domain,
          percentile: 100 * (group.rows.length - rank) / (group.rows.length - 1),
          configuration: row.model_configuration || "Standard",
          source_report_id: row.source_report_id || row.source_url || "unknown",
        });
      });
    }
  }

  const rankings = [];
  for (const [modelId, rows] of observations) {
    const rowsByFamily = new Map();
    for (const row of rows) {
      if (!rowsByFamily.has(row.benchmark_family_id)) rowsByFamily.set(row.benchmark_family_id, []);
      rowsByFamily.get(row.benchmark_family_id).push(row);
    }
    const familyRows = [...rowsByFamily].map(([benchmarkFamilyId, familyObservations]) => ({
      benchmark_family_id: benchmarkFamilyId,
      domain: familyObservations[0].domain,
      percentile: familyObservations.reduce((sum, row) => sum + row.percentile, 0) / familyObservations.length,
    }));
    const domains = new Map();
    for (const row of familyRows) {
      if (!domains.has(row.domain)) domains.set(row.domain, []);
      domains.get(row.domain).push(row.percentile);
    }
    if (familyRows.length < 5 || domains.size < 2) continue;
    const domainMeans = [...domains.values()].map(values => values.reduce((sum, value) => sum + value, 0) / values.length);
    const rawScore = domainMeans.reduce((sum, value) => sum + value, 0) / domainMeans.length;
    const indexScore = 50 + (rawScore - 50) * (familyRows.length / (familyRows.length + 10));
    const model = modelById.get(modelId);
    if (!model) continue;
    const configurations = [...new Set(rows.map(row => row.configuration).filter(Boolean))];
    const reportCount = new Set(rows.map(row => row.source_report_id).filter(Boolean)).size;
    const confidence = familyRows.length >= 25 && domains.size >= 5 && reportCount >= 3
      ? "high"
      : familyRows.length >= 10 && domains.size >= 3 && reportCount >= 2 ? "medium" : "provisional";
    rankings.push({
      model_id: modelId,
      model_name: model.model_name,
      vendor: model.vendor || "Unknown",
      index_score: Number(indexScore.toFixed(1)),
      raw_score: Number(rawScore.toFixed(1)),
      benchmark_count: familyRows.length,
      leaderboard_count: rows.length,
      domain_count: domains.size,
      report_count: reportCount,
      configuration_count: configurations.length,
      configurations,
      confidence,
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
  return {
    rankings,
    benchmarkGroupCount: benchmarkFamilies.size,
    benchmarkFamilyCount: benchmarkFamilies.size,
    comparisonGroupCount: validComparisonGroupCount,
  };
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
    const rows = page.rows.filter(row => isRankingEligible(row) && (row.base_model_id || row.model_id) === model.model_id);
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
