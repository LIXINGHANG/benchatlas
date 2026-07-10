(() => {
  const data = window.BENCHATLAS_DATA;
  const benchmarkCatalog = data.benchmark_catalog;
  const modelCatalog = data.model_catalog;
  const pages = data.benchmark_pages;
  const modelByName = new Map(modelCatalog.map(model => [model.model_name, model]));
  const modelSlugIndexes = createSlugIndexes(modelCatalog, model => model.model_name);
  const benchmarkSlugIndexes = createSlugIndexes(benchmarkCatalog, benchmark => benchmark.rank_group_key);
  const modelBySlug = modelSlugIndexes.bySlug;
  const modelSlugByName = modelSlugIndexes.byKey;
  const benchmarkBySlug = benchmarkSlugIndexes.bySlug;
  const benchmarkSlugByKey = benchmarkSlugIndexes.byKey;
  const modelRows = new Map(modelCatalog.map(model => [model.model_name, []]));
  const defaultModel = modelCatalog.slice().sort((a, b) => (
    Number(b.benchmark_count) - Number(a.benchmark_count)
    || Number(b.result_count) - Number(a.result_count)
  ))[0];

  Object.entries(pages).forEach(([benchmarkKey, page]) => {
    page.rows.forEach(row => {
      if (!modelRows.has(row.model_name)) modelRows.set(row.model_name, []);
      modelRows.get(row.model_name).push({
        ...row,
        benchmark_key: benchmarkKey,
        benchmark_name: page.benchmark_name,
        benchmark_variant: page.benchmark_variant,
        domain: page.domain,
        metric_name: page.metric_name
      });
    });
  });

  modelRows.forEach(rows => rows.sort((a, b) => (
    `${a.benchmark_name} ${a.benchmark_variant}`.localeCompare(`${b.benchmark_name} ${b.benchmark_variant}`)
    || Number(a.rank) - Number(b.rank)
  )));

  const overallData = buildOverallRankings();
  const overallRankings = overallData.rankings;

  const el = id => document.getElementById(id);
  const fmt = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-US") : value;
  const plural = (count, singular, pluralForm = `${singular}s`) => Number(count) === 1 ? singular : pluralForm;
  const humanize = value => String(value || "").replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

  function slugify(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < String(value).length; index += 1) {
      hash ^= String(value).charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).slice(0, 6);
  }

  function createSlugIndexes(items, key) {
    const counts = new Map();
    items.forEach(item => {
      const base = slugify(key(item));
      counts.set(base, (counts.get(base) || 0) + 1);
    });
    const bySlug = new Map();
    const byKey = new Map();
    items.forEach(item => {
      const value = key(item);
      const base = slugify(value);
      const slug = counts.get(base) > 1 ? `${base}-${stableHash(value)}` : base;
      bySlug.set(slug, value);
      byKey.set(value, slug);
    });
    return { bySlug, byKey };
  }

  function modelPath(modelName) {
    return `/models/${modelSlugByName.get(modelName) || slugify(modelName)}/`;
  }

  function benchmarkPath(benchmarkKey) {
    return `/benchmarks/${benchmarkSlugByKey.get(benchmarkKey) || slugify(benchmarkKey)}/`;
  }

  function buildOverallRankings() {
    const observations = new Map();
    let benchmarkGroupCount = 0;

    Object.entries(pages).forEach(([benchmarkKey, page]) => {
      const seenModels = new Set();
      const uniqueRows = [];
      page.rows.forEach(row => {
        if (!seenModels.has(row.model_name)) {
          seenModels.add(row.model_name);
          uniqueRows.push(row);
        }
      });

      const vendorCount = new Set(uniqueRows.map(row => row.vendor)).size;
      if (uniqueRows.length < 3 || vendorCount < 2) return;
      benchmarkGroupCount += 1;

      let previousScore = null;
      let competitionRank = 0;
      uniqueRows.forEach((row, index) => {
        if (previousScore === null || String(row.score) !== previousScore) {
          competitionRank = index + 1;
          previousScore = String(row.score);
        }
        const percentile = 100 * (uniqueRows.length - competitionRank) / (uniqueRows.length - 1);
        if (!observations.has(row.model_name)) observations.set(row.model_name, []);
        observations.get(row.model_name).push({
          benchmark_key: benchmarkKey,
          domain: page.domain,
          percentile
        });
      });
    });

    const rankings = [];
    observations.forEach((rows, modelName) => {
      const domainScores = new Map();
      rows.forEach(row => {
        if (!domainScores.has(row.domain)) domainScores.set(row.domain, []);
        domainScores.get(row.domain).push(row.percentile);
      });
      if (rows.length < 5 || domainScores.size < 2) return;

      const domainMeans = Array.from(domainScores.values()).map(values => (
        values.reduce((sum, value) => sum + value, 0) / values.length
      ));
      const rawScore = domainMeans.reduce((sum, value) => sum + value, 0) / domainMeans.length;
      const coverageWeight = rows.length / (rows.length + 10);
      const indexScore = 50 + (rawScore - 50) * coverageWeight;
      const model = modelByName.get(modelName);
      const confidence = rows.length >= 25 && domainScores.size >= 5
        ? "high"
        : rows.length >= 10 && domainScores.size >= 3 ? "medium" : "limited";

      rankings.push({
        model_name: modelName,
        vendor: model?.vendor || "Unknown",
        index_score: Number(indexScore.toFixed(1)),
        raw_score: Number(rawScore.toFixed(1)),
        benchmark_count: rows.length,
        domain_count: domainScores.size,
        report_count: Number(model?.report_count || 0),
        confidence
      });
    });

    rankings.sort((a, b) => b.index_score - a.index_score || b.benchmark_count - a.benchmark_count);
    let previousIndex = null;
    let rank = 0;
    rankings.forEach((row, index) => {
      if (previousIndex === null || row.index_score !== previousIndex) {
        rank = index + 1;
        previousIndex = row.index_score;
      }
      row.overall_rank = rank;
    });
    return { rankings, benchmarkGroupCount };
  }

  function parseHash() {
    try {
      if (location.hash.startsWith("#model=")) {
        const modelName = decodeURIComponent(location.hash.slice(7));
        if (modelByName.has(modelName)) return { mode: "models", key: modelName };
      }
      if (location.hash.startsWith("#benchmark=")) {
        const benchmarkKey = decodeURIComponent(location.hash.slice(11));
        if (pages[benchmarkKey]) return { mode: "benchmarks", key: benchmarkKey };
      }
      if (location.hash === "#overall") return { mode: "overall", key: "overall" };
      const path = location.pathname.replace(/\/+$/, "") || "/";
      if (path === "/ranking") return { mode: "overall", key: "overall" };
      const modelMatch = path.match(/^\/models\/([^/]+)$/);
      if (modelMatch && modelBySlug.has(modelMatch[1])) {
        return { mode: "models", key: modelBySlug.get(modelMatch[1]) };
      }
      const benchmarkMatch = path.match(/^\/benchmarks\/([^/]+)$/);
      if (benchmarkMatch && benchmarkBySlug.has(benchmarkMatch[1])) {
        return { mode: "benchmarks", key: benchmarkBySlug.get(benchmarkMatch[1]) };
      }
    } catch {
      return null;
    }
    return null;
  }

  const initial = parseHash();
  const state = {
    mode: initial?.mode || "benchmarks",
    selected: initial?.key || benchmarkCatalog[0]?.rank_group_key,
    query: "",
    filter: "all",
    sort: initial?.mode === "overall" ? "index" : "coverage"
  };

  function currentCatalog() {
    if (state.mode === "overall") return overallRankings;
    return state.mode === "models" ? modelCatalog : benchmarkCatalog;
  }

  function itemKey(item) {
    return state.mode === "models" || state.mode === "overall" ? item.model_name : item.rank_group_key;
  }

  function modelDisplayRowCount(modelName) {
    return (modelRows.get(modelName) || []).length;
  }

  function updateHash() {
    if (state.mode === "overall") {
      history.replaceState(null, "", "/ranking/");
      return;
    }
    const path = state.mode === "models" ? modelPath(state.selected) : benchmarkPath(state.selected);
    history.replaceState(null, "", path);
  }

  function configureControls() {
    const isModels = state.mode === "models";
    const isOverall = state.mode === "overall";
    el("benchmarkViewTab").classList.toggle("active", !isModels && !isOverall);
    el("modelViewTab").classList.toggle("active", isModels);
    el("overallViewTab").classList.toggle("active", isOverall);
    el("benchmarkViewTab").setAttribute("aria-selected", String(!isModels && !isOverall));
    el("modelViewTab").setAttribute("aria-selected", String(isModels));
    el("overallViewTab").setAttribute("aria-selected", String(isOverall));

    el("search").placeholder = isOverall
      ? "Search ranked model or vendor"
      : isModels
      ? "Search model, vendor, domain"
      : "Search benchmark, domain, model";
    el("search").setAttribute("aria-label", isOverall ? "Search overall ranking" : isModels ? "Search models" : "Search benchmarks and models");

    if (isModels || isOverall) {
      const vendorSource = isOverall ? overallRankings : modelCatalog;
      const vendors = ["all", ...Array.from(new Set(vendorSource.map(item => item.vendor))).sort()];
      el("domainFilter").setAttribute("aria-label", "Vendor filter");
      el("domainFilter").innerHTML = vendors.map(vendor => (
        `<option value="${esc(vendor)}">${vendor === "all" ? "All vendors" : esc(vendor)}</option>`
      )).join("");
      el("sortMode").innerHTML = isOverall ? `
        <option value="index">Sort by index</option>
        <option value="coverage">Sort by coverage</option>
        <option value="name">Sort by name</option>
      ` : `
          <option value="coverage">Sort by coverage</option>
          <option value="name">Sort by name</option>
          <option value="results">Sort by results</option>
          <option value="reports">Sort by reports</option>
        `;
    } else {
      const domains = ["all", ...Array.from(new Set(benchmarkCatalog.map(item => item.domain))).sort()];
      el("domainFilter").setAttribute("aria-label", "Domain filter");
      el("domainFilter").innerHTML = domains.map(domain => (
        `<option value="${esc(domain)}">${domain === "all" ? "All domains" : esc(humanize(domain))}</option>`
      )).join("");
      el("sortMode").innerHTML = `
        <option value="coverage">Sort by coverage</option>
        <option value="name">Sort by name</option>
        <option value="reports">Sort by reports</option>
      `;
    }
    el("domainFilter").value = state.filter;
    el("sortMode").value = state.sort;
  }

  function switchView(mode, key, writeHash = true) {
    state.mode = mode;
    state.query = "";
    state.filter = "all";
    state.sort = mode === "overall" ? "index" : "coverage";
    el("search").value = "";
    configureControls();

    const catalog = currentCatalog();
    if (mode === "overall") {
      state.selected = "overall";
    } else {
      const valid = catalog.some(item => itemKey(item) === key);
      state.selected = valid ? key : itemKey(catalog[0]);
    }
    if (writeHash) updateHash();
    renderList();
  }

  function filteredCatalog() {
    const query = state.query;
    let rows = currentCatalog().filter(item => {
      if (state.mode === "overall") {
        const text = [item.model_name, item.vendor, item.confidence].join(" ").toLowerCase();
        const filterOk = state.filter === "all" || item.vendor === state.filter;
        return filterOk && (!query || text.includes(query));
      }
      if (state.mode === "models") {
        const text = [item.model_name, item.vendor, item.top_domains, item.reports].join(" ").toLowerCase();
        const filterOk = state.filter === "all" || item.vendor === state.filter;
        return filterOk && (!query || text.includes(query));
      }

      const pageModels = (pages[item.rank_group_key]?.rows || []).flatMap(row => [row.model_name, row.vendor]);
      const text = [
        item.benchmark_name,
        item.benchmark_variant,
        item.domain,
        item.best_model,
        item.best_vendor,
        item.protocol_badges,
        ...pageModels
      ].join(" ").toLowerCase();
      const filterOk = state.filter === "all" || item.domain === state.filter;
      return filterOk && (!query || text.includes(query));
    });

    rows = rows.slice();
    if (state.sort === "name") {
      rows.sort((a, b) => (
        state.mode === "models" || state.mode === "overall"
          ? a.model_name.localeCompare(b.model_name)
          : `${a.benchmark_name} ${a.benchmark_variant}`.localeCompare(`${b.benchmark_name} ${b.benchmark_variant}`)
      ));
    } else if (state.sort === "reports") {
      rows.sort((a, b) => Number(b.report_count) - Number(a.report_count) || Number(b.benchmark_count || b.model_count) - Number(a.benchmark_count || a.model_count));
    } else if (state.sort === "results") {
      rows.sort((a, b) => modelDisplayRowCount(b.model_name) - modelDisplayRowCount(a.model_name) || Number(b.benchmark_count) - Number(a.benchmark_count));
    } else if (state.mode === "overall" && state.sort === "coverage") {
      rows.sort((a, b) => Number(b.benchmark_count) - Number(a.benchmark_count) || Number(a.overall_rank) - Number(b.overall_rank));
    } else if (state.mode === "overall") {
      rows.sort((a, b) => Number(a.overall_rank) - Number(b.overall_rank));
    } else if (state.mode === "models") {
      rows.sort((a, b) => Number(b.benchmark_count) - Number(a.benchmark_count) || Number(b.result_count) - Number(a.result_count));
    } else {
      rows.sort((a, b) => Number(b.model_count) - Number(a.model_count) || Number(b.report_count) - Number(a.report_count));
    }
    return rows;
  }

  function renderList() {
    const rows = filteredCatalog();
    if (state.mode !== "overall") {
      const previousSelection = state.selected;
      if (!rows.some(item => itemKey(item) === state.selected)) {
        state.selected = rows[0] ? itemKey(rows[0]) : itemKey(currentCatalog()[0]);
      }
      if (state.selected !== previousSelection) updateHash();
    }

    const noun = state.mode === "overall" ? "ranked model" : state.mode === "models" ? "model" : "benchmark group";
    el("resultMeta").textContent = `${rows.length} ${noun}${rows.length === 1 ? "" : "s"}`;
    el("benchList").innerHTML = rows.map(item => (
      state.mode === "overall" ? renderOverallListItem(item) : state.mode === "models" ? renderModelListItem(item) : renderBenchmarkListItem(item)
    )).join("") || `<div class="empty">No matching ${state.mode === "benchmarks" ? "benchmarks" : "models"}.</div>`;

    el("benchList").querySelectorAll("button[data-key]").forEach(button => {
      button.addEventListener("click", () => {
        state.selected = button.dataset.key;
        updateHash();
        renderList();
      });
    });
    el("benchList").querySelectorAll("button[data-open-model]").forEach(button => {
      button.addEventListener("click", () => switchView("models", button.dataset.openModel));
    });
    renderPage();
  }

  function renderBenchmarkListItem(item) {
    return `
      <button class="bench-button ${item.rank_group_key === state.selected ? "active" : ""}" data-key="${esc(item.rank_group_key)}">
        <span>
          <span class="bench-name">${esc(item.benchmark_name)}</span>
          <span class="bench-meta">
            <span>${esc(humanize(item.domain))}</span>
            <span>${esc(item.model_count)} models</span>
            <span>${esc(item.metric_name)}</span>
          </span>
        </span>
        <span class="bench-score">${esc(item.best_score)}${item.score_unit === "%" ? "%" : ""}</span>
      </button>
    `;
  }

  function renderModelListItem(item) {
    return `
      <button class="bench-button ${item.model_name === state.selected ? "active" : ""}" data-key="${esc(item.model_name)}">
        <span>
          <span class="bench-name">${esc(item.model_name)}</span>
          <span class="bench-meta">
            <span>${esc(item.vendor)}</span>
            <span>${esc(item.benchmark_count)} ${plural(item.benchmark_count, "benchmark")}</span>
            <span>${esc(item.report_count)} ${plural(item.report_count, "report")}</span>
          </span>
        </span>
        <span class="bench-score">${esc(modelDisplayRowCount(item.model_name))} rows</span>
      </button>
    `;
  }

  function renderOverallListItem(item) {
    return `
      <button class="bench-button overall-item" data-open-model="${esc(item.model_name)}">
        <span class="overall-rank">#${esc(item.overall_rank)}</span>
        <span>
          <span class="bench-name">${esc(item.model_name)}</span>
          <span class="bench-meta">
            <span>${esc(item.vendor)}</span>
            <span>${esc(item.benchmark_count)} groups</span>
            <span>${esc(item.domain_count)} domains</span>
            <span>${esc(humanize(item.confidence))} confidence</span>
          </span>
        </span>
        <span class="bench-score">${esc(item.index_score)}</span>
      </button>
    `;
  }

  function renderBadges(target, badges, includeWarning = false) {
    const all = includeWarning ? ["protocol_variant", ...badges] : badges;
    target.innerHTML = all.length
      ? all.map((badge, index) => `<span class="badge ${index === 0 && includeWarning ? "warn" : ""}">${esc(badge)}</span>`).join("")
      : `<span class="badge warn">protocol details sparse</span>`;
  }

  function setStat(id, labelId, value, label) {
    el(id).textContent = value;
    el(labelId).textContent = label;
  }

  function updatePageMetadata(title, description) {
    const url = `https://benchatlas.cn${location.pathname}`;
    document.title = title;
    const values = [
      ['meta[name="description"]', "content", description],
      ['link[rel="canonical"]', "href", url],
      ['meta[property="og:title"]', "content", title],
      ['meta[property="og:description"]', "content", description],
      ['meta[property="og:url"]', "content", url],
      ['meta[name="twitter:title"]', "content", title],
      ['meta[name="twitter:description"]', "content", description]
    ];
    values.forEach(([selector, attribute, value]) => {
      document.querySelector(selector)?.setAttribute(attribute, value);
    });
    const structuredData = el("structuredData");
    if (structuredData) {
      structuredData.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: title,
        description,
        url,
        isPartOf: {
          "@type": "WebSite",
          "@id": "https://benchatlas.cn/#website",
          name: "BenchAtlas",
          url: "https://benchatlas.cn/"
        },
        about: {
          "@type": "Dataset",
          "@id": "https://benchatlas.cn/#dataset",
          name: "BenchAtlas AI Benchmark Dataset"
        }
      });
    }
  }

  function renderPage() {
    if (state.mode === "overall") renderOverallPage();
    else if (state.mode === "models") renderModelPage();
    else renderBenchmarkPage();
  }

  function renderOverallPage() {
    const rows = filteredCatalog();
    const vendorCount = new Set(overallRankings.map(row => row.vendor)).size;
    el("domainLabel").textContent = "Reported Performance Index";
    el("pageTitle").textContent = "Overall Model Ranking";
    updatePageMetadata(
      "Overall AI Model Ranking | BenchAtlas",
      "Compare the coverage-adjusted Reported Performance Index for AI models across eligible benchmark groups and domains."
    );
    setStat("statModels", "statLabelModels", overallRankings.length, "eligible models");
    setStat("statRows", "statLabelRows", overallData.benchmarkGroupCount, "benchmark groups");
    setStat("statVendors", "statLabelVendors", vendorCount, plural(vendorCount, "vendor"));
    setStat("statReports", "statLabelReports", 5, "minimum groups");
    el("metricLabel").textContent = "RPI · 0–100";
    el("rankingTitle").textContent = "Reported Performance Index";
    el("rankingNote").textContent = "A coverage-adjusted comparison of rankings reported across eligible benchmark groups.";
    el("summaryHeading").textContent = "Leaders";
    el("signalsHeading").textContent = "Eligibility";
    el("policyHeading").textContent = "Methodology";
    el("policyText").textContent = "Within each benchmark group, model ranks become 0–100 percentiles. Benchmark scores are averaged within each domain, then domains receive equal weight. Limited coverage is shrunk toward 50. Only groups with at least 3 models from 2 vendors and models covering at least 5 groups across 2 domains qualify. This index reflects published report coverage and may inherit vendor selection bias; it is not an absolute capability score.";
    renderBadges(el("panelBadges"), ["reported index", "domain balanced", "coverage adjusted"], false);
    renderBadges(el("contextBadges"), ["≥5 benchmark groups", "≥2 domains", "≥3 models/group", "≥2 vendors/group"], false);
    renderOverallLeaders(rows);
    renderOverallRanking(rows);
  }

  function renderBenchmarkPage() {
    const page = pages[state.selected];
    if (!page) return;
    const variant = page.benchmark_variant ? ` <span class="variant">${esc(page.benchmark_variant)}</span>` : "";
    el("domainLabel").textContent = humanize(page.domain || "benchmark");
    el("pageTitle").innerHTML = `${esc(page.benchmark_name)}${variant}`;
    updatePageMetadata(
      `${page.benchmark_name}${page.benchmark_variant ? ` (${page.benchmark_variant})` : ""} Results | BenchAtlas`,
      `Compare ${page.benchmark_name} scores reported for ${new Set(page.rows.map(row => row.model_name)).size} AI models, including evaluation protocols and source evidence.`
    );
    const modelCount = new Set(page.rows.map(row => row.model_name)).size;
    const vendorCount = new Set(page.rows.map(row => row.vendor)).size;
    const reportCount = new Set(page.rows.flatMap(row => String(row.source_report_id).split("; "))).size;
    setStat("statModels", "statLabelModels", modelCount, plural(modelCount, "model"));
    setStat("statRows", "statLabelRows", page.result_count, plural(page.result_count, "reported row"));
    setStat("statVendors", "statLabelVendors", vendorCount, plural(vendorCount, "vendor"));
    setStat("statReports", "statLabelReports", reportCount, plural(reportCount, "report"));
    el("metricLabel").textContent = `${page.metric_name} · ${page.score_unit || "score"}`;
    el("rankingTitle").textContent = "Reported Ranking";
    el("rankingNote").textContent = "Protocol variants are shown, not strict normalized leaderboards.";
    el("summaryHeading").textContent = "Best reported";
    el("signalsHeading").textContent = "Protocol signals";
    el("policyHeading").textContent = "Evidence policy";
    el("policyText").textContent = "Scores are kept with their original report, evidence location, and evaluation notes. Rows marked protocol variant may use different harnesses or settings, so treat the ranking as reported results rather than a strictly normalized leaderboard.";
    renderBadges(el("panelBadges"), page.protocol_badges || [], true);
    renderBadges(el("contextBadges"), page.protocol_badges || [], false);
    renderTopModels(page.rows);
    renderBenchmarkRanking(page.rows);
  }

  function renderModelPage() {
    const model = modelByName.get(state.selected);
    const rows = modelRows.get(state.selected) || [];
    if (!model) return;

    const benchmarkCount = new Set(rows.map(row => row.benchmark_key)).size;
    const reports = new Set(rows.flatMap(row => String(row.source_report_id).split("; ")).filter(Boolean));
    const domains = new Map();
    rows.forEach(row => domains.set(row.domain, (domains.get(row.domain) || 0) + 1));
    const badges = Array.from(new Set(rows.flatMap(row => row.protocol_badges || []))).sort();
    const methodCount = rows.filter(row => row.protocol_full).length;

    el("domainLabel").textContent = model.vendor || "Model";
    el("pageTitle").textContent = model.model_name;
    updatePageMetadata(
      `${model.model_name} Benchmark Results | BenchAtlas`,
      `${model.model_name} benchmark results from ${model.vendor}: ${benchmarkCount} benchmark groups with source evidence, protocols, and method notes.`
    );
    setStat("statModels", "statLabelModels", benchmarkCount, plural(benchmarkCount, "benchmark group"));
    setStat("statRows", "statLabelRows", rows.length, plural(rows.length, "reported row"));
    setStat("statVendors", "statLabelVendors", reports.size, plural(reports.size, "report"));
    setStat("statReports", "statLabelReports", domains.size, plural(domains.size, "domain"));
    el("metricLabel").textContent = `${benchmarkCount} ${plural(benchmarkCount, "benchmark")} · ${reports.size} ${plural(reports.size, "report")}`;
    el("rankingTitle").textContent = "Reported benchmark results";
    el("rankingNote").textContent = "Each row keeps its benchmark-specific rank, protocol, and source evidence.";
    el("summaryHeading").textContent = "Top domains";
    el("signalsHeading").textContent = "Source coverage";
    el("policyHeading").textContent = "Interpretation";
    el("policyText").textContent = "Ranks are calculated within each benchmark group. Scores from different benchmarks or metrics are not compared with one another. Multiple rows for the same benchmark are preserved when reports or evaluation settings differ.";
    renderBadges(el("panelBadges"), badges, true);
    renderBadges(el("contextBadges"), [
      `${reports.size} ${plural(reports.size, "report")}`,
      `${methodCount} ${plural(methodCount, "method note")}`
    ], false);
    renderDomainSummary(domains, rows.length);
    renderModelRanking(rows);
  }

  function renderTopModels(rows) {
    const uniqueModels = [];
    const seen = new Set();
    rows.forEach(row => {
      if (!seen.has(row.model_name)) {
        seen.add(row.model_name);
        uniqueModels.push(row);
      }
    });
    el("topModels").innerHTML = uniqueModels.slice(0, 5).map((row, index) => `
      <div class="mini-item">
        <b>#${index + 1}</b>
        <span>${esc(row.model_name)}</span>
        <em>${esc(row.score)}${row.score_unit === "%" ? "%" : " " + esc(row.score_unit)}</em>
      </div>
    `).join("");
  }

  function renderDomainSummary(domains, total) {
    const rows = Array.from(domains.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    el("topModels").innerHTML = rows.map(([domain, count]) => `
      <div class="mini-item">
        <b>${count}</b>
        <span>${esc(humanize(domain))}</span>
        <em>${Math.round((count / Math.max(total, 1)) * 100)}%</em>
      </div>
    `).join("");
  }

  function renderOverallLeaders(rows) {
    el("topModels").innerHTML = rows.slice(0, 5).map(row => `
      <div class="mini-item">
        <b>#${esc(row.overall_rank)}</b>
        <span>${esc(row.model_name)}</span>
        <em>${esc(row.index_score)}</em>
      </div>
    `).join("") || `<div class="empty">No eligible models match these filters.</div>`;
  }

  function renderSourceLinks(sourceUrls) {
    const urls = String(sourceUrls || "").split("; ").filter(Boolean);
    return urls.map((url, index) => (
      `<a href="${esc(url)}" target="_blank" rel="noreferrer">Open source${urls.length > 1 ? ` ${index + 1}` : ""} ↗</a>`
    )).join("");
  }

  function protocolCell(row) {
    return `
      <div class="badges">
        <span class="badge warn">${esc(row.comparability_label)}</span>
        ${(row.protocol_badges || []).map(badge => `<span class="badge">${esc(badge)}</span>`).join("")}
      </div>
      ${row.protocol_short ? `<div class="method-summary"><b>Method notes:</b> ${esc(row.protocol_short)}</div>` : ""}
      ${row.protocol_full ? `
        <details class="method-note">
          <summary>Show full method notes</summary>
          <div>${esc(row.protocol_full)}</div>
        </details>
      ` : ""}
    `;
  }

  function sourceCell(row) {
    return `
      <div class="source">
        ${row.source_url ? `<div class="source-links">${renderSourceLinks(row.source_url)}</div>` : ""}
        <div>${esc(row.evidence_location)}</div>
        <details class="evidence-note">
          <summary>Evidence details</summary>
          <div><b>Report:</b> ${esc(row.source_report_id)}</div>
          ${row.evidence_quote ? `<div><b>Quote:</b> ${esc(row.evidence_quote)}</div>` : ""}
        </details>
      </div>
    `;
  }

  function scoreCell(row) {
    return `${esc(fmt(row.score))}${row.score_unit === "%" ? "%" : row.score_unit ? ` ${esc(row.score_unit)}` : ""}`;
  }

  function renderBenchmarkRanking(rows) {
    if (!rows.length) {
      el("rankingTable").innerHTML = `<div class="empty">No scored rows for this benchmark.</div>`;
      return;
    }
    el("rankingTable").innerHTML = `
      <table>
        <thead><tr><th>Rank</th><th>Model</th><th>Score</th><th>Protocol</th><th>Source evidence</th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td class="rank">#${esc(row.rank)}</td>
              <td>
                <div class="model"><a class="entity-link model-jump" href="${esc(modelPath(row.model_name))}" data-model="${esc(row.model_name)}">${esc(row.model_name)}</a></div>
                <div class="vendor">${esc(row.vendor)}</div>
              </td>
              <td><div class="score">${scoreCell(row)}</div></td>
              <td>${protocolCell(row)}</td>
              <td>${sourceCell(row)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    attachEntityLinks();
  }

  function renderModelRanking(rows) {
    if (!rows.length) {
      el("rankingTable").innerHTML = `<div class="empty">No benchmark rows found for this model.</div>`;
      return;
    }
    el("rankingTable").innerHTML = `
      <table>
        <thead><tr><th>Rank</th><th>Benchmark</th><th>Score</th><th>Protocol</th><th>Source evidence</th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td class="rank">#${esc(row.rank)}</td>
              <td>
                <div class="model"><a class="entity-link benchmark-jump" href="${esc(benchmarkPath(row.benchmark_key))}" data-benchmark="${esc(row.benchmark_key)}">${esc(row.benchmark_name)}</a></div>
                <div class="vendor">${esc(humanize(row.domain))}${row.benchmark_variant ? ` · ${esc(row.benchmark_variant)}` : ""}<br>${esc(row.metric_name)}</div>
              </td>
              <td><div class="score">${scoreCell(row)}</div></td>
              <td>${protocolCell(row)}</td>
              <td>${sourceCell(row)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    attachEntityLinks();
  }

  function renderOverallRanking(rows) {
    if (!rows.length) {
      el("rankingTable").innerHTML = `<div class="empty">No eligible models match these filters.</div>`;
      return;
    }
    el("rankingTable").innerHTML = `
      <table>
        <thead><tr><th>Rank</th><th>Model</th><th>RPI</th><th>Coverage</th><th>Method</th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td class="rank">#${esc(row.overall_rank)}</td>
              <td>
                <div class="model"><a class="entity-link model-jump" href="${esc(modelPath(row.model_name))}" data-model="${esc(row.model_name)}">${esc(row.model_name)}</a></div>
                <div class="vendor">${esc(row.vendor)}</div>
              </td>
              <td>
                <div class="score">${esc(row.index_score)}</div>
                <div class="vendor">Raw domain score ${esc(row.raw_score)}</div>
              </td>
              <td>
                <div class="badges">
                  <span class="badge ${row.confidence === "limited" ? "warn" : ""}">${esc(row.confidence)} confidence</span>
                </div>
                <div class="method-summary">${esc(row.benchmark_count)} benchmark groups · ${esc(row.domain_count)} domains · ${esc(row.report_count)} ${plural(row.report_count, "report")}</div>
              </td>
              <td>
                <div class="method-summary"><b>Coverage adjustment:</b> the domain-balanced score is shrunk toward 50 when fewer benchmark groups are available.</div>
                <a class="entity-link model-jump" href="${esc(modelPath(row.model_name))}" data-model="${esc(row.model_name)}">Open model details</a>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    attachEntityLinks();
  }

  function attachEntityLinks() {
    el("rankingTable").querySelectorAll(".model-jump").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        switchView("models", button.dataset.model);
      });
    });
    el("rankingTable").querySelectorAll(".benchmark-jump").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        switchView("benchmarks", button.dataset.benchmark);
      });
    });
  }

  function init() {
    el("totalCount").textContent = `${data.summary.result_count} rows`;
    el("benchmarkViewTab").addEventListener("click", () => switchView("benchmarks", benchmarkCatalog[0]?.rank_group_key));
    el("modelViewTab").addEventListener("click", () => switchView("models", defaultModel?.model_name));
    el("overallViewTab").addEventListener("click", () => switchView("overall", "overall"));
    el("search").addEventListener("input", event => {
      state.query = event.target.value.toLowerCase().trim();
      renderList();
    });
    el("domainFilter").addEventListener("change", event => {
      state.filter = event.target.value;
      renderList();
    });
    el("sortMode").addEventListener("change", event => {
      state.sort = event.target.value;
      renderList();
    });
    window.addEventListener("hashchange", () => {
      const next = parseHash();
      if (next && (next.mode !== state.mode || next.key !== state.selected)) {
        switchView(next.mode, next.key, false);
      }
    });
    window.addEventListener("popstate", () => {
      const next = parseHash();
      if (next && (next.mode !== state.mode || next.key !== state.selected)) {
        switchView(next.mode, next.key, false);
      }
    });
    configureControls();
    renderList();
    if (location.hash) updateHash();
  }

  init();
})();
