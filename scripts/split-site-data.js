#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const fullBundlePath = path.join(root, "site_data.bundle.js");
const indexBundlePath = path.join(root, "site_data.index.bundle.js");
const benchmarkDir = path.join(root, "data", "benchmarks");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(fullBundlePath, "utf8"), sandbox);
const data = sandbox.window.BENCHATLAS_DATA;

if (!data?.benchmark_pages || !Array.isArray(data.benchmark_catalog)) {
  throw new Error("site_data.bundle.js does not contain the expected BenchAtlas payload");
}

fs.rmSync(benchmarkDir, { recursive: true, force: true });
fs.mkdirSync(benchmarkDir, { recursive: true });

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

fs.writeFileSync(
  indexBundlePath,
  `window.BENCHATLAS_DATA = ${JSON.stringify(indexPayload)};\n`,
  "utf8",
);

for (const [key, page] of Object.entries(data.benchmark_pages)) {
  fs.writeFileSync(path.join(benchmarkDir, `${key}.json`), JSON.stringify(page), "utf8");
}

console.log(
  `Wrote ${catalog.length} catalog rows and ${Object.keys(data.benchmark_pages).length} lazy benchmark files.`,
);
