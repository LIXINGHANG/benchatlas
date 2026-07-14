#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, "data", "benchmark_taxonomy.json"), "utf8"));
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "site_data.index.bundle.js"), "utf8"), sandbox);

const catalog = sandbox.window.BENCHATLAS_DATA?.benchmark_catalog || [];
const domains = new Map(taxonomy.primary_domains.map(domain => [domain.id, domain]));
const errors = [];

if (!catalog.length) errors.push("Benchmark catalog is empty");
if (!domains.has(taxonomy.fallback_primary_domain)) errors.push("Fallback primary domain is not defined");

for (const item of catalog) {
  const domain = domains.get(item.primary_domain);
  if (!domain) {
    errors.push(`${item.rank_group_key}: unknown primary domain ${item.primary_domain}`);
    continue;
  }
  if (!domain.subfields.some(subfield => subfield.id === item.subfield)) {
    errors.push(`${item.rank_group_key}: ${item.subfield} is not a subfield of ${item.primary_domain}`);
  }
  for (const key of ["taxonomy_source", "taxonomy_confidence", "map_family_id"]) {
    if (item[key] === undefined || item[key] === null || item[key] === "") {
      errors.push(`${item.rank_group_key}: missing ${key}`);
    }
  }
}

const fallbackItems = catalog.filter(item => item.taxonomy_source === "fallback");
if (fallbackItems.length) {
  errors.push(`Unresolved fallback classifications: ${fallbackItems.map(item => item.benchmark_name).join(", ")}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const counts = Object.fromEntries([...domains].map(([id]) => [id, catalog.filter(item => item.primary_domain === id).length]));
console.log(`Validated taxonomy v${taxonomy.schema_version} · ${catalog.length} benchmark groups · ${JSON.stringify(counts)}`);
