#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const patchPath = process.argv[2];
if (!patchPath) {
  console.error("Usage: node scripts/validate-taxonomy-review-patch.js <taxonomy_review_patch.json>");
  process.exit(2);
}

const taxonomy = JSON.parse(fs.readFileSync(path.join(root, "data", "benchmark_taxonomy.json"), "utf8"));
const patch = JSON.parse(fs.readFileSync(path.resolve(patchPath), "utf8"));
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "site_data.index.bundle.js"), "utf8"), sandbox);
const catalog = sandbox.window.BENCHATLAS_DATA?.benchmark_catalog || [];
const benchmarkNames = new Set(catalog.map(item => item.benchmark_name));
const domains = new Map(taxonomy.primary_domains.map(domain => [domain.id, domain]));
const purposes = new Set((taxonomy.evaluation_purposes || []).map(purpose => purpose.id));
const safetyCategories = new Set((taxonomy.safety_alignment?.categories || []).map(category => category.id));
const statuses = new Set(["todo", "approved", "needs_review"]);
const errors = [];

if (patch.patch_schema_version !== 1) errors.push("Unsupported patch_schema_version");
if (patch.taxonomy_schema_version !== taxonomy.schema_version) errors.push("taxonomy_schema_version does not match authority file");
if (!Array.isArray(patch.review_records)) errors.push("review_records must be an array");
if (!patch.benchmark_overrides || typeof patch.benchmark_overrides !== "object") errors.push("benchmark_overrides must be an object");

for (const record of patch.review_records || []) {
  if (!benchmarkNames.has(record.benchmark_name)) errors.push(`${record.benchmark_name}: unknown benchmark_name`);
  if (!statuses.has(record.status)) errors.push(`${record.benchmark_name}: invalid review status ${record.status}`);
  if (!record.current || !domains.has(record.current.primary_domain)) {
    errors.push(`${record.benchmark_name}: invalid current primary_domain`);
    continue;
  }
  const domain = domains.get(record.current.primary_domain);
  if (!domain.subfields.some(subfield => subfield.id === record.current.subfield)) {
    errors.push(`${record.benchmark_name}: ${record.current.subfield} is not a subfield of ${record.current.primary_domain}`);
  }
  if (!purposes.has(record.current.evaluation_purpose)) {
    errors.push(`${record.benchmark_name}: invalid evaluation_purpose ${record.current.evaluation_purpose}`);
  }
  if (record.current.evaluation_purpose === "safety_alignment" && !safetyCategories.has(record.current.safety_category)) {
    errors.push(`${record.benchmark_name}: invalid safety_category ${record.current.safety_category}`);
  }
  if (record.current.evaluation_purpose === "capability" && record.current.safety_category) {
    errors.push(`${record.benchmark_name}: capability record must not have safety_category`);
  }
  if (record.changed && !patch.benchmark_overrides[record.benchmark_name]) {
    errors.push(`${record.benchmark_name}: changed record is missing benchmark_overrides entry`);
  }
}

for (const [name, override] of Object.entries(patch.benchmark_overrides || {})) {
  if (!benchmarkNames.has(name)) errors.push(`${name}: override targets unknown benchmark`);
  if (override.source_domain || override.subfield) {
    const domain = taxonomy.primary_domains.find(item => item.source_domains.includes(override.source_domain));
    if (!domain) {
      errors.push(`${name}: source_domain ${override.source_domain} is not mapped`);
      continue;
    }
    if (!domain.subfields.some(subfield => subfield.id === override.subfield)) {
      errors.push(`${name}: override subfield ${override.subfield} does not belong to ${domain.id}`);
    }
  }
  if (override.evaluation_purpose && !purposes.has(override.evaluation_purpose)) {
    errors.push(`${name}: invalid override evaluation_purpose ${override.evaluation_purpose}`);
  }
  if (override.evaluation_purpose === "safety_alignment" && !safetyCategories.has(override.safety_category)) {
    errors.push(`${name}: invalid override safety_category ${override.safety_category}`);
  }
  if (override.evaluation_purpose === "capability" && override.safety_category) {
    errors.push(`${name}: capability override must not have safety_category`);
  }
  if (!(Number(override.confidence) >= 0 && Number(override.confidence) <= 1)) {
    errors.push(`${name}: confidence must be between 0 and 1`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated taxonomy review patch · ${patch.review_records.length} review records · ${Object.keys(patch.benchmark_overrides).length} changed overrides`);
