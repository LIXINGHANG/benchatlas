#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

require("./split-site-data.js");

const root = path.resolve(__dirname, "..");
const siteUrl = "https://benchatlas.cn";

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  }[character]));
}

function loadData() {
  const context = { window: {} };
  const bundle = fs.readFileSync(path.join(root, "site_data.bundle.js"), "utf8");
  vm.runInNewContext(bundle, context, { filename: "site_data.bundle.js" });
  return context.window.BENCHATLAS_DATA;
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < String(value).length; index += 1) {
    hash ^= String(value).charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 6);
}

function createSlugIndexes(items, key, label) {
  const counts = new Map();
  items.forEach(item => {
    const base = slugify(key(item));
    counts.set(base, (counts.get(base) || 0) + 1);
  });
  const byKey = new Map();
  const bySlug = new Map();
  items.forEach(item => {
    const value = key(item);
    const base = slugify(value);
    const slug = counts.get(base) > 1 ? `${base}-${stableHash(value)}` : base;
    if (bySlug.has(slug)) {
      throw new Error(`${label} slug collision: ${bySlug.get(slug)} and ${value} -> ${slug}`);
    }
    byKey.set(value, slug);
    bySlug.set(slug, value);
  });
  return { byKey, bySlug };
}

function structuredData({ title, description, url, type }) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": type || "WebPage",
    name: title,
    description,
    url,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "BenchAtlas",
      url: `${siteUrl}/`
    },
    about: {
      "@type": "Dataset",
      "@id": `${siteUrl}/#dataset`,
      name: "BenchAtlas AI Benchmark Dataset"
    }
  }, null, 2);
}

function renderPage(template, page) {
  let html = template;
  html = html.replace(/\s*<meta name="robots" content="noindex, nofollow">/, "");
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(page.description)}">`);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(page.url)}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(page.title)}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(page.description)}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapeHtml(page.url)}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escapeHtml(page.title)}">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escapeHtml(page.description)}">`);
  html = html.replace(/<script type="application\/ld\+json" id="structuredData">[\s\S]*?<\/script>/, `<script type="application/ld+json" id="structuredData">\n${structuredData(page)}\n  </script>`);
  html = html.replace("__DATA_BUNDLE__", page.dataBundle);
  html = html.replace('<div class="kicker" id="domainLabel">Benchmark</div>', `<div class="kicker" id="domainLabel">${escapeHtml(page.kicker)}</div>`);
  html = html.replace('<h2 id="pageTitle">Loading</h2>', `<h2 id="pageTitle">${escapeHtml(page.heading)}</h2>`);
  return html;
}

function writePage(relativePath, html) {
  const destination = path.join(root, relativePath, "index.html");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html);
}

function main() {
  const data = loadData();
  const template = fs.readFileSync(path.join(root, "scripts", "detail-page-template.html.inc"), "utf8");
  const modelSlugs = createSlugIndexes(data.model_catalog, item => item.model_name, "model");
  const benchmarkSlugs = createSlugIndexes(data.benchmark_catalog, item => item.rank_group_key, "benchmark");

  ["models", "benchmarks", "ranking"].forEach(directory => {
    fs.rmSync(path.join(root, directory), { recursive: true, force: true });
  });

  const urls = [
    { url: `${siteUrl}/`, priority: "1.0", changefreq: "daily" },
    { url: `${siteUrl}/guide/`, priority: "0.8", changefreq: "monthly" },
    { url: `${siteUrl}/guide/zh/`, priority: "0.8", changefreq: "monthly" },
  ];
  const rankingUrl = `${siteUrl}/ranking/`;
  writePage("ranking", renderPage(template, {
    title: "AI Model Reported Capability Ceiling | BenchAtlas",
    description: "Compare base models using their best publicly reported configuration within eligible benchmark and protocol groups.",
    url: rankingUrl,
    kicker: "Reported Performance Index",
    heading: "Reported Capability Ceiling",
    dataBundle: "/data/pages/ranking.bundle.js?v=capability-ceiling-2",
    type: "WebPage"
  }));
  urls.push({ url: rankingUrl, priority: "0.9", changefreq: "daily" });

  data.model_catalog.forEach(model => {
    const slug = modelSlugs.byKey.get(model.model_name);
    const url = `${siteUrl}/models/${slug}/`;
    const description = `${model.model_name} benchmark results from ${model.vendor}: ${model.benchmark_count} benchmark groups with source evidence, protocols, and method notes.`;
    writePage(path.join("models", slug), renderPage(template, {
      title: `${model.model_name} Benchmark Results | BenchAtlas`,
      description,
      url,
      kicker: model.vendor || "AI model",
      heading: model.model_name,
      dataBundle: `/data/pages/models/${model.model_id}.bundle.js?v=entities-1`,
      type: "WebPage"
    }));
    urls.push({ url, priority: "0.8", changefreq: "weekly" });
  });

  data.benchmark_catalog.forEach(benchmark => {
    const slug = benchmarkSlugs.byKey.get(benchmark.rank_group_key);
    const url = `${siteUrl}/benchmarks/${slug}/`;
    const variant = benchmark.benchmark_variant ? ` (${benchmark.benchmark_variant})` : "";
    const description = `Compare ${benchmark.benchmark_name}${variant} scores reported for ${benchmark.model_count} AI models, including evaluation protocols and source evidence.`;
    writePage(path.join("benchmarks", slug), renderPage(template, {
      title: `${benchmark.benchmark_name}${variant} Results | BenchAtlas`,
      description,
      url,
      kicker: String(benchmark.domain || "AI benchmark").replace(/_/g, " "),
      heading: `${benchmark.benchmark_name}${variant}`,
      dataBundle: `/data/pages/benchmarks/${benchmark.rank_group_key}.bundle.js?v=entities-1`,
      type: "WebPage"
    }));
    urls.push({ url, priority: "0.7", changefreq: "weekly" });
  });

  const lastmod = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(item => `  <url>\n    <loc>${escapeXml(item.url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${item.changefreq}</changefreq>\n    <priority>${item.priority}</priority>\n  </url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap);

  console.log(`Generated ${data.model_catalog.length} model pages, ${data.benchmark_catalog.length} benchmark pages, 1 ranking page, and ${urls.length} sitemap URLs.`);
}

main();
