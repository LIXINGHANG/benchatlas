#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const bundlePath = path.join(root, "site_data.bundle.js");
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, "data", "benchmark_taxonomy.json"), "utf8"));
const normalization = JSON.parse(fs.readFileSync(path.join(root, "data", "normalization_rules.json"), "utf8"));
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(bundlePath, "utf8"), sandbox);
const data = sandbox.window.BENCHATLAS_DATA;

const aliases = new Map(Object.entries(normalization.benchmark_aliases || {}));
const overrides = new Map(Object.entries(taxonomy.benchmark_overrides || {}));
const domains = new Map(taxonomy.primary_domains.map(domain => [domain.id, domain]));
const sourceDomainToPrimary = new Map(
  taxonomy.primary_domains.flatMap(domain => domain.source_domains.map(source => [source, domain]))
);
const purposes = new Map((taxonomy.evaluation_purposes || []).map(item => [item.id, item]));
const benchmarkTypes = new Map((taxonomy.benchmark_types || []).map(item => [item.id, item]));
const safetyCategories = new Map((taxonomy.safety_alignment?.categories || []).map(item => [item.id, item]));

function canonicalName(name) {
  let value = name;
  const seen = new Set();
  while (aliases.has(value) && !seen.has(value)) {
    seen.add(value);
    value = aliases.get(value);
  }
  return value;
}

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "benchmark";
}

function matchingMapFamily(name) {
  return (taxonomy.map_families || []).find(rule => new RegExp(rule.name_pattern, "i").test(name));
}

function applyTaxonomy(page) {
  const originalName = page.benchmark_name;
  const name = canonicalName(originalName);
  const override = overrides.get(name);
  page.benchmark_name = name;

  if (name !== originalName) {
    page.benchmark_family_id = slug(name);
    page.map_family_id = slug(name);
  }

  if (override) {
    const primaryDomain = sourceDomainToPrimary.get(override.source_domain) || domains.get(taxonomy.fallback_primary_domain);
    const requestedSubfield = override.subfield || override.safety_category;
    const subfield = primaryDomain.subfields.find(item => item.id === requestedSubfield)
      || primaryDomain.subfields.find(item => item.id === primaryDomain.default_subfield);
    const evaluationPurpose = override.evaluation_purpose || "capability";
    const purpose = purposes.get(evaluationPurpose);
    const benchmarkTypeId = override.benchmark_type || page.benchmark_type || "atomic";
    const benchmarkType = benchmarkTypes.get(benchmarkTypeId);
    const safetyCategory = evaluationPurpose === "safety_alignment" ? override.safety_category : "";
    const safety = safetyCategories.get(safetyCategory);

    Object.assign(page, {
      domain: override.source_domain,
      primary_domain: primaryDomain.id,
      primary_domain_label_en: primaryDomain.label_en,
      primary_domain_label_zh: primaryDomain.label_zh,
      subfield: subfield.id,
      subfield_label_en: subfield.label_en,
      subfield_label_zh: subfield.label_zh,
      evaluation_purpose: evaluationPurpose,
      evaluation_purpose_label_en: purpose?.label_en || "Capability",
      evaluation_purpose_label_zh: purpose?.label_zh || "能力评测",
      benchmark_type: benchmarkTypeId,
      benchmark_type_label_en: benchmarkType?.label_en || "Atomic benchmark",
      benchmark_type_label_zh: benchmarkType?.label_zh || "单项 Benchmark",
      secondary_tags: override.secondary_tags || [],
      map_excluded: Boolean(override.map_excluded),
      ranking_excluded: Boolean(override.ranking_excluded),
      is_safety: evaluationPurpose === "safety_alignment",
      safety_category: safetyCategory,
      safety_category_label_en: safety?.label_en || "",
      safety_category_label_zh: safety?.label_zh || "",
      taxonomy_source: "benchmark_override",
      taxonomy_confidence: override.confidence ?? 1,
      taxonomy_reason: override.reason || "",
    });
  }

  const familyRule = matchingMapFamily(name);
  if (familyRule) {
    page.map_family_id = familyRule.id;
    if (familyRule.benchmark_family_id) page.benchmark_family_id = familyRule.benchmark_family_id;
    page.map_representative = familyRule.representative_rank_group_key
      ? page.rank_group_key === familyRule.representative_rank_group_key
      : new RegExp(familyRule.representative_pattern || "$^", "i").test(name);
  }
}

for (const page of Object.values(data.benchmark_pages)) applyTaxonomy(page);

const pageFields = [
  "benchmark_name", "benchmark_family_id", "benchmark_variant", "domain", "primary_domain",
  "primary_domain_label_en", "primary_domain_label_zh", "subfield", "subfield_label_en",
  "subfield_label_zh", "evaluation_purpose", "evaluation_purpose_label_en",
  "evaluation_purpose_label_zh", "benchmark_type", "benchmark_type_label_en",
  "benchmark_type_label_zh", "secondary_tags", "map_excluded", "ranking_excluded", "is_safety",
  "safety_category", "safety_category_label_en", "safety_category_label_zh", "taxonomy_source",
  "taxonomy_confidence", "taxonomy_reason", "map_family_id", "map_representative",
];

data.benchmark_catalog = data.benchmark_catalog.map(item => {
  const page = data.benchmark_pages[item.rank_group_key];
  if (!page) return item;
  const synced = { ...item };
  for (const field of pageFields) synced[field] = page[field];
  return synced;
});

data.taxonomy = taxonomy;

for (const model of data.model_catalog) {
  const families = new Map();
  for (const page of Object.values(data.benchmark_pages)) {
    const hasModel = page.rows.some(row => (
      row.ranking_eligible !== false
      && !["agent_system", "baseline", "checkpoint"].includes(row.entity_type)
      && (row.base_model_id || row.model_id) === model.model_id
    ));
    if (hasModel) families.set(page.benchmark_family_id || page.rank_group_key, page.primary_domain || page.domain);
  }
  const domainCounts = new Map();
  for (const domain of families.values()) domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  model.benchmark_count = families.size;
  model.top_domains = [...domainCounts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([domain, count]) => `${domain}:${count}`)
    .join("; ");
}

const mapEligibleCatalog = data.benchmark_catalog.filter(item => !item.map_excluded);
const resultRows = Object.values(data.benchmark_pages).flatMap(page => page.rows || []);
data.summary.reported_result_count = resultRows.length;
data.summary.benchmark_result_group_count = data.benchmark_catalog.length;
data.summary.benchmark_family_count = new Set(
  mapEligibleCatalog.map(item => item.map_family_id || item.benchmark_family_id || item.rank_group_key)
).size;
data.summary.comparable_setup_group_count = new Set(
  resultRows.map(row => row.comparability_group_id).filter(Boolean)
).size;
data.summary.protocol_record_count = data.summary.protocol_count || data.summary.protocol_record_count || 0;
data.summary.map_eligible_result_group_count = mapEligibleCatalog.length;
data.summary.map_benchmark_group_count = mapEligibleCatalog.length;
data.summary.ranking_benchmark_group_count = new Set(
  data.benchmark_catalog.filter(item => !item.ranking_excluded).map(item => item.benchmark_family_id || item.rank_group_key)
).size;

fs.writeFileSync(bundlePath, `window.BENCHATLAS_DATA = ${JSON.stringify(data, null, 2)};\n`, "utf8");
console.log(
  `Synced taxonomy v${taxonomy.schema_version} · ${data.summary.reported_result_count} results · `
  + `${data.summary.benchmark_family_count} families · ${data.summary.benchmark_result_group_count} result groups · `
  + `${data.summary.comparable_setup_group_count} comparable setup groups.`
);
