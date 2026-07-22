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
  const alternateUrl = page.alternateUrl || page.url;
  const englishUrl = page.lang === "zh-CN" ? alternateUrl : page.url;
  const chineseUrl = page.lang === "zh-CN" ? page.url : alternateUrl;
  html = html.replace('<html lang="en">', `<html lang="${page.lang || "en"}">`);
  html = html.replace(/\s*<meta name="robots" content="noindex, nofollow">/, "");
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(page.description)}">`);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(page.url)}">`);
  html = html.replace(/(<link rel="canonical" href="[^"]*">)/, `$1\n  <link rel="alternate" hreflang="en" href="${escapeHtml(englishUrl)}">\n  <link rel="alternate" hreflang="zh-CN" href="${escapeHtml(chineseUrl)}">\n  <link rel="alternate" hreflang="x-default" href="${escapeHtml(englishUrl)}">`);
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
  ["models", "benchmarks", "ranking"].forEach(directory => {
    fs.rmSync(path.join(root, "zh", directory), { recursive: true, force: true });
  });

  const englishHome = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const chineseHome = englishHome
    .replace('<html lang="en">', '<html lang="zh-CN">')
    .replace('<title>BenchAtlas - Explore the AI Benchmark Landscape</title>', '<title>BenchAtlas - 探索 AI Benchmark 全景</title>')
    .replace('content="Explore reported AI benchmark scores as an interactive landscape with model rankings, evaluation protocols, method notes, and primary source evidence."', 'content="以交互地图探索 AI Benchmark 公开分数、模型排名、评测协议、运行配置和原始证据。"')
    .replace('<link rel="canonical" href="https://benchatlas.cn/">', '<link rel="canonical" href="https://benchatlas.cn/zh/">')
    .replaceAll('content="https://benchatlas.cn/"', 'content="https://benchatlas.cn/zh/"')
    .replaceAll('content="BenchAtlas - Explore the AI Benchmark Landscape"', 'content="BenchAtlas - 探索 AI Benchmark 全景"')
    .replace('content="Navigate AI benchmarks, compare reported model scores, and inspect the exact evaluation protocols behind every result."', 'content="浏览 AI Benchmark、比较模型公开分数，并检查每条结果对应的评测协议。"')
    .replace('content="Reported scores, evaluation protocols, source evidence, and model rankings in one benchmark atlas."', 'content="在同一张 Benchmark 地图中查看公开分数、评测协议、来源证据和模型排名。"');
  writePage("zh", chineseHome);
  const chineseGuide = fs.readFileSync(path.join(root, "guide", "zh", "index.html"), "utf8")
    .replaceAll("https://benchatlas.cn/guide/zh/", "https://benchatlas.cn/zh/guide/")
    .replace('href="/guide/zh/"', 'href="/zh/guide/"')
    .replace('<a class="brand" href="/">', '<a class="brand" href="/zh/">')
    .replaceAll('<a href="/">打开地图</a>', '<a href="/zh/">打开地图</a>')
    .replaceAll('<a href="/ranking/">', '<a href="/zh/ranking/">')
    .replaceAll('<a href="/">地图</a>', '<a href="/zh/">地图</a>');
  writePage(path.join("zh", "guide"), chineseGuide);

  const urls = [
    { url: `${siteUrl}/`, priority: "1.0", changefreq: "daily" },
    { url: `${siteUrl}/guide/`, priority: "0.8", changefreq: "monthly" },
    { url: `${siteUrl}/zh/`, priority: "1.0", changefreq: "daily" },
    { url: `${siteUrl}/zh/guide/`, priority: "0.8", changefreq: "monthly" },
  ];
  const rankingUrl = `${siteUrl}/ranking/`;
  writePage("ranking", renderPage(template, {
    title: "AI Model Reported Average Percentile | BenchAtlas",
    description: "Compare base models by normalized rank across eligible public leaderboards, balanced across capability fields and adjusted for coverage.",
    url: rankingUrl,
    kicker: "Reported Average Percentile",
    heading: "Overall Base-Model Ranking",
    dataBundle: "/data/pages/ranking.bundle.js?v=reported-percentile-1",
    type: "WebPage",
    lang: "en",
    alternateUrl: `${siteUrl}/zh/ranking/`
  }));
  urls.push({ url: rankingUrl, priority: "0.9", changefreq: "daily" });
  const zhRankingUrl = `${siteUrl}/zh/ranking/`;
  writePage(path.join("zh", "ranking"), renderPage(template, {
    title: "AI 模型公开榜单平均百分位 | BenchAtlas",
    description: "按模型在有效公开榜单中的归一化名次比较，并对 Benchmark family、能力领域和覆盖数量进行校正。",
    url: zhRankingUrl,
    kicker: "公开榜单平均百分位",
    heading: "基础模型整体排名",
    dataBundle: "/data/pages/ranking.bundle.js?v=reported-percentile-1",
    type: "WebPage",
    lang: "zh-CN",
    alternateUrl: rankingUrl
  }));
  urls.push({ url: zhRankingUrl, priority: "0.9", changefreq: "daily" });

  data.model_catalog.forEach(model => {
    const slug = modelSlugs.byKey.get(model.model_name);
    const url = `${siteUrl}/models/${slug}/`;
    const description = `${model.model_name} benchmark results from ${model.vendor}: ${model.benchmark_count} benchmark result groups with source evidence, protocols, and method notes.`;
    writePage(path.join("models", slug), renderPage(template, {
      title: `${model.model_name} Benchmark Results | BenchAtlas`,
      description,
      url,
      kicker: model.vendor || "AI model",
      heading: model.model_name,
      dataBundle: `/data/pages/models/${model.model_id}.bundle.js?v=hierarchy-1`,
      type: "WebPage",
      lang: "en",
      alternateUrl: `${siteUrl}/zh/models/${slug}/`
    }));
    urls.push({ url, priority: "0.8", changefreq: "weekly" });
    const zhUrl = `${siteUrl}/zh/models/${slug}/`;
    writePage(path.join("zh", "models", slug), renderPage(template, {
      title: `${model.model_name} Benchmark 结果 | BenchAtlas`,
      description: `${model.vendor} 的 ${model.model_name}：${model.benchmark_count} 个 Benchmark 结果分组的公开结果、来源证据、评测协议和运行配置。`,
      url: zhUrl,
      kicker: model.vendor || "AI 模型",
      heading: model.model_name,
      dataBundle: `/data/pages/models/${model.model_id}.bundle.js?v=hierarchy-1`,
      type: "WebPage",
      lang: "zh-CN",
      alternateUrl: url
    }));
    urls.push({ url: zhUrl, priority: "0.8", changefreq: "weekly" });
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
      dataBundle: `/data/pages/benchmarks/${benchmark.rank_group_key}.bundle.js?v=hierarchy-1`,
      type: "WebPage",
      lang: "en",
      alternateUrl: `${siteUrl}/zh/benchmarks/${slug}/`
    }));
    urls.push({ url, priority: "0.7", changefreq: "weekly" });
    const zhUrl = `${siteUrl}/zh/benchmarks/${slug}/`;
    writePage(path.join("zh", "benchmarks", slug), renderPage(template, {
      title: `${benchmark.benchmark_name}${variant} 结果 | BenchAtlas`,
      description: `比较 ${benchmark.model_count} 个 AI 模型在 ${benchmark.benchmark_name}${variant} 上的公开分数，并查看评测协议与来源证据。`,
      url: zhUrl,
      kicker: String(benchmark.domain || "AI benchmark").replace(/_/g, " "),
      heading: `${benchmark.benchmark_name}${variant}`,
      dataBundle: `/data/pages/benchmarks/${benchmark.rank_group_key}.bundle.js?v=hierarchy-1`,
      type: "WebPage",
      lang: "zh-CN",
      alternateUrl: url
    }));
    urls.push({ url: zhUrl, priority: "0.7", changefreq: "weekly" });
  });

  const lastmod = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(item => `  <url>\n    <loc>${escapeXml(item.url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${item.changefreq}</changefreq>\n    <priority>${item.priority}</priority>\n  </url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap);

  console.log(`Generated ${data.model_catalog.length} model pages, ${data.benchmark_catalog.length} benchmark pages, 1 ranking page, and ${urls.length} sitemap URLs.`);
}

main();
