#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "site_data.bundle.js"), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);

const data = context.window.BENCHATLAS_DATA;
const rows = Object.values(data?.benchmark_pages || {}).flatMap((page) =>
  (page.rows || []).map((row) => ({
    ...row,
    benchmark_name: page.benchmark_name,
  }))
);
const errors = [];
const reportIds = new Set();

for (const row of rows) {
  const label = `${row.benchmark_name || "unknown"} / ${row.model_name || "unknown"}`;
  if (!String(row.vendor || "").trim()) {
    errors.push(`${label}: missing model vendor`);
  }

  const reports = Array.isArray(row.source_reports) ? row.source_reports : [];
  if (!reports.length) {
    errors.push(`${label}: missing source report metadata`);
    continue;
  }

  for (const report of reports) {
    for (const field of ["report_id", "report_title", "source_publisher", "source_url"]) {
      if (!String(report[field] || "").trim()) {
        errors.push(`${label}: source report missing ${field}`);
      }
    }
    if (report.report_id) reportIds.add(report.report_id);
  }
}

const aaBriefcaseRows = rows.filter((row) => row.benchmark_name === "AA-Briefcase");
for (const row of aaBriefcaseRows) {
  for (const report of row.source_reports || []) {
    if (report.report_id === "kimi_k3_release_2026_07_16" && report.source_publisher !== "Moonshot AI") {
      errors.push(`AA-Briefcase / ${row.model_name}: Kimi K3 source publisher must be Moonshot AI`);
    }
  }
}

if (errors.length) {
  console.error(`Score provenance validation failed with ${errors.length} issue(s):`);
  errors.slice(0, 50).forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Validated score provenance: ${rows.length} rows across ${reportIds.size} reports.`);
