#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, "data", "benchmark_taxonomy.json"), "utf8"));
const normalization = JSON.parse(fs.readFileSync(path.join(root, "data", "normalization_rules.json"), "utf8"));
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "site_data.index.bundle.js"), "utf8"), sandbox);

const catalog = sandbox.window.BENCHATLAS_DATA?.benchmark_catalog || [];
const domains = new Map(taxonomy.primary_domains.map(domain => [domain.id, domain]));
const purposes = new Map((taxonomy.evaluation_purposes || []).map(purpose => [purpose.id, purpose]));
const benchmarkTypes = new Map((taxonomy.benchmark_types || []).map(type => [type.id, type]));
const secondaryTags = new Map((taxonomy.secondary_tags || []).map(tag => [tag.id, tag]));
const safetyCategories = new Map((taxonomy.safety_alignment?.categories || []).map(category => [category.id, category]));
const benchmarkExclusions = new Map(
  Object.entries(taxonomy.benchmark_exclusions || {}).map(([name, exclusion]) => [name.toLowerCase(), exclusion])
);
const benchmarkAliases = new Map(Object.entries(normalization.benchmark_aliases || {}));
const errors = [];

if (!catalog.length) errors.push("Benchmark catalog is empty");
if (!domains.has(taxonomy.fallback_primary_domain)) errors.push("Fallback primary domain is not defined");
if (!purposes.has("capability") || !purposes.has("safety_alignment")) errors.push("Capability and safety_alignment evaluation purposes must be defined");
if (!benchmarkTypes.has("atomic") || !benchmarkTypes.has("composite_index")) errors.push("Atomic and composite_index benchmark types must be defined");
if (!safetyCategories.size) errors.push("Safety & Alignment categories are not defined");
if (!domains.has("safety")) errors.push("Safety & Alignment must be a primary capability domain");

for (const item of catalog) {
  if (benchmarkAliases.has(item.benchmark_name)) {
    errors.push(`${item.rank_group_key}: unresolved benchmark alias ${item.benchmark_name} -> ${benchmarkAliases.get(item.benchmark_name)}`);
  }
  const exclusion = benchmarkExclusions.get(item.benchmark_name.toLowerCase());
  if (exclusion) {
    errors.push(`${item.rank_group_key}: excluded ${exclusion.entity_type || "non-benchmark"} re-entered the benchmark catalog (${item.benchmark_name})`);
    continue;
  }
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
  if (!purposes.has(item.evaluation_purpose)) {
    errors.push(`${item.rank_group_key}: unknown evaluation purpose ${item.evaluation_purpose}`);
  }
  if (!benchmarkTypes.has(item.benchmark_type)) {
    errors.push(`${item.rank_group_key}: unknown benchmark type ${item.benchmark_type}`);
  }
  for (const tag of item.secondary_tags || []) {
    if (!secondaryTags.has(tag)) errors.push(`${item.rank_group_key}: unknown secondary tag ${tag}`);
  }
  if (typeof item.map_excluded !== "boolean" || typeof item.ranking_excluded !== "boolean") {
    errors.push(`${item.rank_group_key}: map_excluded and ranking_excluded must be boolean`);
  }
  if (item.benchmark_type === "composite_index" && (!item.map_excluded || !item.ranking_excluded)) {
    errors.push(`${item.rank_group_key}: composite index must be excluded from maps and aggregate rankings`);
  }
  if (typeof item.is_safety !== "boolean") {
    errors.push(`${item.rank_group_key}: is_safety must be boolean`);
  }
  if (item.is_safety !== (item.evaluation_purpose === "safety_alignment")) {
    errors.push(`${item.rank_group_key}: is_safety and evaluation_purpose disagree`);
  }
  if (item.is_safety && !safetyCategories.has(item.safety_category)) {
    errors.push(`${item.rank_group_key}: unknown safety category ${item.safety_category}`);
  }
  if (!item.is_safety && item.safety_category) {
    errors.push(`${item.rank_group_key}: capability benchmark has safety category ${item.safety_category}`);
  }
  if (item.is_safety && item.primary_domain !== "safety") {
    errors.push(`${item.rank_group_key}: safety benchmark must use the safety primary domain`);
  }
  if (!item.is_safety && item.primary_domain === "safety") {
    errors.push(`${item.rank_group_key}: non-safety benchmark cannot use the safety primary domain`);
  }
}

const fallbackItems = catalog.filter(item => item.taxonomy_source === "fallback");
if (fallbackItems.length) {
  errors.push(`Unresolved fallback classifications: ${fallbackItems.map(item => item.benchmark_name).join(", ")}`);
}

const benchmarkClassifications = new Map();
for (const item of catalog) {
  const signature = `${item.evaluation_purpose}/${item.safety_category || ""}`;
  if (!benchmarkClassifications.has(item.benchmark_name)) benchmarkClassifications.set(item.benchmark_name, new Set());
  benchmarkClassifications.get(item.benchmark_name).add(signature);
}
for (const [name, signatures] of benchmarkClassifications) {
  if (signatures.size > 1) errors.push(`${name}: conflicting taxonomy across rank groups: ${[...signatures].join(", ")}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const counts = Object.fromEntries([...domains].map(([id]) => [id, catalog.filter(item => item.primary_domain === id).length]));
const safetyCounts = Object.fromEntries([...safetyCategories].map(([id]) => [id, catalog.filter(item => item.safety_category === id).length]));
console.log(`Validated taxonomy v${taxonomy.schema_version} · ${catalog.length} benchmark groups · capabilities ${JSON.stringify(counts)} · safety ${JSON.stringify(safetyCounts)}`);
