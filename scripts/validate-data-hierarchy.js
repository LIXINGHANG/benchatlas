#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "site_data.bundle.js"), "utf8"), sandbox);

const data = sandbox.window.BENCHATLAS_DATA;
const summary = data?.summary || {};
const catalog = data?.benchmark_catalog || [];
const pages = Object.values(data?.benchmark_pages || {});
const rows = pages.flatMap(page => page.rows || []);
const errors = [];

const familyCount = new Set(
  catalog.filter(item => !item.map_excluded).map(item => item.map_family_id).filter(Boolean)
).size;
const resultGroupCount = catalog.length;
const mapEligibleGroupCount = catalog.filter(item => !item.map_excluded).length;
const comparableGroupCount = new Set(rows.map(row => row.comparability_group_id).filter(Boolean)).size;

const expected = {
  reported_result_count: rows.length,
  benchmark_family_count: familyCount,
  benchmark_result_group_count: resultGroupCount,
  map_eligible_result_group_count: mapEligibleGroupCount,
  comparable_setup_group_count: comparableGroupCount,
};

for (const [field, value] of Object.entries(expected)) {
  if (summary[field] !== value) errors.push(`${field}: summary=${summary[field]} computed=${value}`);
}

for (const [name, family] of [["Claw Eval", "claw-eval"], ["Claw Eval [Multimodal]", "claw-eval"], ["OfficeQA-Pro", "officeqa-pro"], ["OfficeQA-Pro [Multimodal]", "officeqa-pro"]]) {
  const items = catalog.filter(item => item.benchmark_name === name);
  if (!items.length) errors.push(`${name}: missing from catalog`);
  for (const item of items) {
    if (item.benchmark_family_id !== family || item.map_family_id !== family) {
      errors.push(`${name}: expected family ${family}, got benchmark=${item.benchmark_family_id} map=${item.map_family_id}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Validated data hierarchy: ${summary.reported_result_count} results · ` +
  `${summary.benchmark_family_count} families · ${summary.benchmark_result_group_count} result groups · ` +
  `${summary.comparable_setup_group_count} comparable setup groups · ${summary.protocol_record_count} protocol records.`
);
