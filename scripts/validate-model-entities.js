#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadBundle(file) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  return context.window.BENCHATLAS_DATA;
}

function fail(message) {
  throw new Error(message);
}

const data = loadBundle("site_data.bundle.js");
const ranking = loadBundle("data/pages/ranking.bundle.js").overall_data.rankings;
const rows = Object.values(data.benchmark_pages).flatMap(page => page.rows);
const catalogIds = new Set(data.model_catalog.map(model => model.model_id));
const excludedTypes = new Set(["agent_system", "baseline", "checkpoint"]);

for (const row of rows) {
  const eligible = row.ranking_eligible !== false && !excludedTypes.has(row.entity_type);
  if (eligible && !row.base_model_id) fail(`Eligible row has no base model: ${row.reported_model_name}`);
  if (eligible && !catalogIds.has(row.base_model_id)) fail(`Missing base model in catalog: ${row.base_model_name}`);
  if (!eligible && catalogIds.has(row.reported_model_id)) fail(`Reference entity leaked into model catalog: ${row.reported_model_name}`);
}

const rankedIds = new Set();
for (const model of ranking) {
  if (!catalogIds.has(model.model_id)) fail(`Ranked model is missing from catalog: ${model.model_name}`);
  if (rankedIds.has(model.model_id)) fail(`Base model appears twice in overall ranking: ${model.model_name}`);
  rankedIds.add(model.model_id);
}

const requiredMappings = new Map([
  ["GPT-5.6 Sol Ultra", "GPT-5.6 Sol"],
  ["GPT-5.6 Sol Railfree", "GPT-5.6 Sol"],
  ["Claude Opus 4.6 (Thinking)", "Claude Opus 4.6"],
  ["Gemini 3.1 Pro (thinking high)", "Gemini 3.1 Pro"],
]);

for (const [reportedName, baseName] of requiredMappings) {
  const matches = rows.filter(row => row.reported_model_name === reportedName);
  if (!matches.length) fail(`Expected reported configuration is missing: ${reportedName}`);
  if (matches.some(row => row.base_model_name !== baseName || row.ranking_eligible === false)) {
    fail(`Incorrect base-model mapping: ${reportedName} -> ${baseName}`);
  }
}

const referenceEntities = new Set(rows
  .filter(row => row.ranking_eligible === false || excludedTypes.has(row.entity_type))
  .map(row => row.reported_model_name));

console.log([
  `Validated ${data.model_catalog.length} base models`,
  `${new Set(rows.map(row => row.reported_model_name)).size} reported entities`,
  `${ranking.length} ranked base models`,
  `${referenceEntities.size} reference entities excluded from ranking`,
].join(" · "));
