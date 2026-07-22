(() => {
  const data = window.BENCHATLAS_DATA;
  const i18n = window.BENCHATLAS_I18N || {zh:false,t:(english)=>english,label:value=>value,route:path=>path};
  const t = i18n.t;
  const uiLabel = i18n.label || (value => value);
  const localRoute = i18n.route;
  const isScoped = Boolean(data.scope && data.scope !== "full");
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
      if (!isRankingEligible(row)) return;
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

  const overallData = data.overall_data || buildOverallRankings();
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
    return localRoute(`/models/${modelSlugByName.get(modelName) || slugify(modelName)}/`);
  }

  function benchmarkPath(benchmarkKey) {
    return localRoute(`/benchmarks/${benchmarkSlugByKey.get(benchmarkKey) || slugify(benchmarkKey)}/`);
  }

  function isRankingEligible(row) {
    return row.ranking_eligible !== false && !["agent_system", "baseline", "checkpoint"].includes(row.entity_type);
  }

  function comparisonGroups(rows) {
    const groups = new Map();
    rows.forEach(row => {
      const id = row.comparability_group_id || `legacy--${row.source_report_id || "unknown"}`;
      if (!groups.has(id)) groups.set(id, {
        id,
        label: row.comparability_group_label || "Source-scoped reported setup",
        status: row.comparability_status || "source_scoped",
        rows: []
      });
      groups.get(id).rows.push(row);
    });
    return Array.from(groups.values()).map(group => {
      const models = new Set(group.rows.filter(isRankingEligible).map(row => row.base_model_id || row.model_id || row.model_name));
      group.model_count = models.size;
      group.rows.sort((a, b) => Number(a.rank) - Number(b.rank));
      return group;
    }).sort((a, b) => (
      Number(b.status === "strict") - Number(a.status === "strict")
      || b.model_count - a.model_count
      || b.rows.length - a.rows.length
    ));
  }

  function preferredComparisonRows(rows) {
    const group = comparisonGroups(rows)[0];
    if (!group) return [];
    const seen = new Set();
    return group.rows.filter(isRankingEligible).filter(row => {
      const key = row.base_model_id || row.model_id || row.model_name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function rankingComparisonGroups(rows) {
    return comparisonGroups(rows).map(group => {
      const seen = new Set();
      const selectedRows = group.rows.filter(isRankingEligible).filter(row => {
        const key = row.base_model_id || row.model_id || row.model_name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return {
        ...group,
        rows: selectedRows,
        vendor_count: new Set(selectedRows.map(row => row.vendor)).size
      };
    }).filter(group => group.rows.length >= 3 && group.vendor_count >= 2);
  }

  function buildOverallRankings() {
    const observations = new Map();
    const benchmarkFamilies = new Set();
    let validComparisonGroupCount = 0;

    Object.entries(pages).forEach(([benchmarkKey, page]) => {
      if (page.ranking_excluded || page.benchmark_type === "composite_index") return;
      const benchmarkFamilyId = page.benchmark_family_id || benchmarkKey;
      rankingComparisonGroups(page.rows).forEach(group => {
        benchmarkFamilies.add(benchmarkFamilyId);
        validComparisonGroupCount += 1;
        let previousScore = null;
        let competitionRank = 0;
        group.rows.forEach((row, index) => {
          if (previousScore === null || String(row.score) !== previousScore) {
            competitionRank = index + 1;
            previousScore = String(row.score);
          }
          const percentile = 100 * (group.rows.length - competitionRank) / (group.rows.length - 1);
          if (!observations.has(row.model_name)) observations.set(row.model_name, []);
          observations.get(row.model_name).push({
            benchmark_key: benchmarkKey,
            benchmark_family_id: benchmarkFamilyId,
            domain: page.primary_domain || page.domain,
            percentile,
            configuration: row.model_configuration || "Standard",
            source_report_id: row.source_report_id || row.source_url || "unknown"
          });
        });
      });
    });

    const rankings = [];
    observations.forEach((rows, modelName) => {
      const rowsByFamily = new Map();
      rows.forEach(row => {
        if (!rowsByFamily.has(row.benchmark_family_id)) rowsByFamily.set(row.benchmark_family_id, []);
        rowsByFamily.get(row.benchmark_family_id).push(row);
      });
      const familyRows = Array.from(rowsByFamily, ([benchmarkFamilyId, familyObservations]) => ({
        benchmark_family_id: benchmarkFamilyId,
        domain: familyObservations[0].domain,
        percentile: familyObservations.reduce((sum, row) => sum + row.percentile, 0) / familyObservations.length
      }));
      const domainScores = new Map();
      familyRows.forEach(row => {
        if (!domainScores.has(row.domain)) domainScores.set(row.domain, []);
        domainScores.get(row.domain).push(row.percentile);
      });
      if (familyRows.length < 5 || domainScores.size < 2) return;

      const domainMeans = Array.from(domainScores.values()).map(values => (
        values.reduce((sum, value) => sum + value, 0) / values.length
      ));
      const rawScore = domainMeans.reduce((sum, value) => sum + value, 0) / domainMeans.length;
      const coverageWeight = familyRows.length / (familyRows.length + 10);
      const indexScore = 50 + (rawScore - 50) * coverageWeight;
      const model = modelByName.get(modelName);
      const reportCount = new Set(rows.map(row => row.source_report_id).filter(Boolean)).size;
      const configurations = new Set(rows.map(row => row.configuration).filter(Boolean));
      const confidence = familyRows.length >= 25 && domainScores.size >= 5 && reportCount >= 3
        ? "high"
        : familyRows.length >= 10 && domainScores.size >= 3 && reportCount >= 2 ? "medium" : "provisional";

      rankings.push({
        model_name: modelName,
        vendor: model?.vendor || "Unknown",
        index_score: Number(indexScore.toFixed(1)),
        raw_score: Number(rawScore.toFixed(1)),
        benchmark_count: familyRows.length,
        leaderboard_count: rows.length,
        domain_count: domainScores.size,
        report_count: reportCount,
        configuration_count: configurations.size,
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
    return {
      rankings,
      benchmarkGroupCount: benchmarkFamilies.size,
      benchmarkFamilyCount: benchmarkFamilies.size,
      comparisonGroupCount: validComparisonGroupCount
    };
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
      const localizedPath = location.pathname.replace(/^\/zh(?=\/|$)/, "") || "/";
      const path = localizedPath.replace(/\/+$/, "") || "/";
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
    if (!isScoped || modelName === data.scope_key) return (modelRows.get(modelName) || []).length;
    return Number(modelByName.get(modelName)?.result_count || 0);
  }

  function updateHash() {
    if (state.mode === "overall") {
      history.replaceState(null, "", localRoute("/ranking/"));
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
    document.querySelector(".view-switch")?.setAttribute("aria-label", t("Explore by", "浏览维度"));
    el("benchmarkViewTab").textContent = "Benchmark";
    el("modelViewTab").textContent = t("Models", "模型");
    el("overallViewTab").textContent = t("Overall ranking", "整体排名");

    el("search").placeholder = isOverall
      ? t("Search ranked model or vendor", "搜索排名模型或厂商")
      : isModels
      ? t("Search model, vendor, domain", "搜索模型、厂商或领域")
      : t("Search benchmark, domain, model", "搜索 Benchmark、领域或模型");
    el("search").setAttribute("aria-label", isOverall ? t("Search overall ranking", "搜索整体排名") : isModels ? t("Search models", "搜索模型") : t("Search benchmarks and models", "搜索 Benchmark 和模型"));

    if (isModels || isOverall) {
      const vendorSource = isOverall ? overallRankings : modelCatalog;
      const vendors = ["all", ...Array.from(new Set(vendorSource.map(item => item.vendor))).sort()];
      el("domainFilter").setAttribute("aria-label", t("Vendor filter", "厂商筛选"));
      el("domainFilter").innerHTML = vendors.map(vendor => (
        `<option value="${esc(vendor)}">${vendor === "all" ? t("All vendors", "全部厂商") : esc(vendor)}</option>`
      )).join("");
      el("sortMode").innerHTML = isOverall ? `
        <option value="index">${t("Sort by index", "按指数排序")}</option>
        <option value="coverage">${t("Sort by coverage", "按覆盖排序")}</option>
        <option value="name">${t("Sort by name", "按名称排序")}</option>
      ` : `
          <option value="coverage">${t("Sort by coverage", "按覆盖排序")}</option>
          <option value="name">${t("Sort by name", "按名称排序")}</option>
          <option value="results">${t("Sort by results", "按结果数排序")}</option>
          <option value="reports">${t("Sort by reports", "按报告数排序")}</option>
        `;
    } else {
      const domains = ["all", ...Array.from(new Set(benchmarkCatalog.map(item => item.domain))).sort()];
      el("domainFilter").setAttribute("aria-label", t("Domain filter", "领域筛选"));
      el("domainFilter").innerHTML = domains.map(domain => (
        `<option value="${esc(domain)}">${domain === "all" ? t("All domains", "全部领域") : esc(uiLabel(humanize(domain)))}</option>`
      )).join("");
      el("sortMode").innerHTML = `
        <option value="coverage">${t("Sort by coverage", "按覆盖排序")}</option>
        <option value="name">${t("Sort by name", "按名称排序")}</option>
        <option value="reports">${t("Sort by reports", "按报告数排序")}</option>
      `;
    }
    el("domainFilter").value = state.filter;
    el("sortMode").value = state.sort;
    el("sortMode").setAttribute("aria-label", t("Sort mode", "排序方式"));
  }

  function switchView(mode, key, writeHash = true) {
    if (isScoped) {
      if (mode === "overall") location.href = "/ranking/";
      else if (mode === "models") location.href = modelPath(key || defaultModel?.model_name);
      else location.href = benchmarkPath(key || benchmarkCatalog[0]?.rank_group_key);
      return;
    }
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
        ...pageModels,
        ...(item.search_models || [])
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

    const noun = state.mode === "overall" ? t(plural(rows.length, "ranked model"), "个排名模型") : state.mode === "models" ? t(plural(rows.length, "model"), "个模型") : t(plural(rows.length, "benchmark result group"), "个 Benchmark 结果分组");
    el("resultMeta").textContent = `${rows.length} ${noun}`;
    el("benchList").innerHTML = rows.map(item => (
      state.mode === "overall" ? renderOverallListItem(item) : state.mode === "models" ? renderModelListItem(item) : renderBenchmarkListItem(item)
    )).join("") || `<div class="empty">${t(`No matching ${state.mode === "benchmarks" ? "benchmarks" : "models"}.`, state.mode === "benchmarks" ? "没有匹配的 Benchmark。" : "没有匹配的模型。")}</div>`;

    el("benchList").querySelectorAll("button[data-key]").forEach(button => {
      button.addEventListener("click", () => {
        if (isScoped) {
          location.href = state.mode === "models" ? modelPath(button.dataset.key) : benchmarkPath(button.dataset.key);
          return;
        }
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
            <span>${esc(uiLabel(humanize(item.domain)))}</span>
            <span>${esc(item.model_count)} ${t(plural(item.model_count, "model"), "个模型")}</span>
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
            <span>${esc(item.benchmark_count)} ${t(plural(item.benchmark_count, "benchmark result group"), "个 Benchmark 结果分组")}</span>
            <span>${esc(item.report_count)} ${t(plural(item.report_count, "report"), "份报告")}</span>
          </span>
        </span>
        <span class="bench-score">${esc(modelDisplayRowCount(item.model_name))} ${t("rows", "条报分")}</span>
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
            <span>${esc(item.benchmark_count)} ${t("result groups", "个结果分组")}</span>
            <span>${esc(item.domain_count)} ${t("domains", "个领域")}</span>
            <span>${esc(uiLabel(`${item.confidence} confidence`))}</span>
          </span>
        </span>
        <span class="bench-score">${esc(item.index_score)}</span>
      </button>
    `;
  }

  function renderBadges(target, badges, includeWarning = false) {
    const all = includeWarning ? ["protocol aware", ...badges] : badges;
    target.innerHTML = all.length
      ? all.map((badge, index) => `<span class="badge ${index === 0 && includeWarning ? "warn" : ""}">${esc(uiLabel(badge))}</span>`).join("")
      : `<span class="badge warn">${esc(uiLabel("protocol details sparse"))}</span>`;
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
    el("domainLabel").textContent = t("Reported Average Percentile", "公开榜单平均百分位");
    el("pageTitle").textContent = t("Overall Base-Model Ranking", "基础模型整体排名");
    updatePageMetadata(
      t("Overall AI Model Ranking | BenchAtlas", "AI 模型整体排名 | BenchAtlas"),
      t("Compare base models by their average normalized rank across eligible public leaderboards, balanced across capability fields and adjusted for coverage.", "按模型在有效公开榜单中的平均归一化名次比较，并对能力领域和覆盖数量进行校正。")
    );
    setStat("statModels", "statLabelModels", overallRankings.length, t("eligible models", "符合条件的模型"));
    setStat("statRows", "statLabelRows", overallData.benchmarkFamilyCount || overallData.benchmarkGroupCount, t("eligible benchmark families", "有效 Benchmark family"));
    setStat("statVendors", "statLabelVendors", vendorCount, t(plural(vendorCount, "vendor"), "厂商"));
    setStat("statReports", "statLabelReports", overallData.comparisonGroupCount, t("eligible comparison groups", "有效可比组"));
    el("metricLabel").textContent = "RAP · 0–100";
    el("rankingTitle").textContent = t("Reported Average Percentile", "公开榜单平均百分位");
    el("rankingNote").textContent = t("Every eligible leaderboard appearance contributes a normalized rank percentile; repeated appearances within one Benchmark family are averaged.", "每次有效榜单出现都会贡献一个归一化排名百分位；同一 Benchmark family 内的多次出现先取平均。");
    el("summaryHeading").textContent = t("Leaders", "领先模型");
    el("signalsHeading").textContent = t("Eligibility", "纳入规则");
    el("policyHeading").textContent = t("Methodology", "计算方法");
    el("policyText").textContent = t("Every eligible comparison group contributes a 0–100 normalized rank percentile. Multiple appearances within the same Benchmark family are averaged, the seven capability fields are weighted equally, and limited family coverage is shrunk toward 50. Independent report count and field coverage determine confidence. Agent systems, checkpoints, baselines, and composite indexes are excluded.", "每个有效可比组都会贡献一个 0–100 的归一化排名百分位。同一 Benchmark family 的多次出现先取平均，七个能力领域等权，再按 family 覆盖数量向 50 收缩。独立报告数和领域覆盖决定置信度。Agent system、checkpoint、baseline 和综合指数不参与总榜。");
    renderBadges(el("panelBadges"), ["all eligible groups", "family deduplicated", "domain balanced", "coverage adjusted"], false);
    renderBadges(el("contextBadges"), [t("≥5 benchmark families", "≥5 个 Benchmark family"), t("≥2 domains", "≥2 个领域"), t("≥3 models/group", "每组 ≥3 个模型"), t("≥2 vendors/group", "每组 ≥2 个厂商")], false);
    renderOverallLeaders(rows);
    renderOverallRanking(rows);
  }

  function renderBenchmarkPage() {
    const page = pages[state.selected];
    if (!page) return;
    const comparisonGroup = comparisonGroups(page.rows)[0];
    const comparableRows = preferredComparisonRows(page.rows);
    const referenceRows = comparisonGroup ? comparisonGroup.rows.filter(row => !isRankingEligible(row)) : [];
    const variant = page.benchmark_variant ? ` <span class="variant">${esc(page.benchmark_variant)}</span>` : "";
    el("domainLabel").textContent = uiLabel(humanize(page.domain || "benchmark"));
    el("pageTitle").innerHTML = `${esc(page.benchmark_name)}${variant}`;
    updatePageMetadata(
      t(`${page.benchmark_name}${page.benchmark_variant ? ` (${page.benchmark_variant})` : ""} Results | BenchAtlas`, `${page.benchmark_name}${page.benchmark_variant ? ` (${page.benchmark_variant})` : ""} 结果 | BenchAtlas`),
      t(`Compare ${page.benchmark_name} scores reported for ${new Set(page.rows.filter(isRankingEligible).map(row => row.base_model_id || row.model_id || row.model_name)).size} base models, including evaluation configurations, protocols, and source evidence.`, `比较 ${new Set(page.rows.filter(isRankingEligible).map(row => row.base_model_id || row.model_id || row.model_name)).size} 个基础模型在 ${page.benchmark_name} 上的公开分数，并查看评测配置、协议和来源证据。`)
    );
    const modelCount = new Set(page.rows.filter(isRankingEligible).map(row => row.base_model_id || row.model_id || row.model_name)).size;
    const vendorCount = new Set(page.rows.filter(isRankingEligible).map(row => row.vendor)).size;
    const reportCount = new Set(page.rows.flatMap(row => String(row.source_report_id).split("; "))).size;
    setStat("statModels", "statLabelModels", modelCount, t(plural(modelCount, "model"), "模型"));
    setStat("statRows", "statLabelRows", page.result_count, t(plural(page.result_count, "reported row"), "报分记录"));
    setStat("statVendors", "statLabelVendors", vendorCount, t(plural(vendorCount, "vendor"), "厂商"));
    setStat("statReports", "statLabelReports", reportCount, t(plural(reportCount, "report"), "报告"));
    el("metricLabel").textContent = `${page.metric_name} · ${page.score_unit || "score"}`;
    el("rankingTitle").textContent = t("Comparable Ranking", "可比排名");
    el("rankingNote").textContent = comparisonGroup
      ? t(`Showing ${comparisonGroup.model_count} models from the preferred ${comparisonGroup.status === "strict" ? "documented shared-protocol" : "source-scoped"} group: ${comparisonGroup.label}.`, `当前显示首选${comparisonGroup.status === "strict" ? "文档化共享协议" : "来源限定"}分组中的 ${comparisonGroup.model_count} 个模型：${comparisonGroup.label}。`)
      : t("No comparable rows are available.", "暂无可比记录。");
    el("summaryHeading").textContent = t("Best reported", "最佳公开结果");
    el("signalsHeading").textContent = t("Protocol signals", "协议标签");
    el("policyHeading").textContent = t("Evidence policy", "证据规则");
    el("policyText").textContent = t("Only rows sharing the preferred comparability group are ranked together. Other reported protocols remain preserved in the dataset and model pages with source-scoped or shared-protocol labels.", "只有共享首选可比分组的记录才会一起排名。其他协议的公开报分仍保留在数据集和模型页面中，并标记为 source-scoped 或 shared-protocol。");
    renderBadges(el("panelBadges"), [comparisonGroup?.status === "strict" ? "shared protocol" : "source scoped", ...(page.protocol_badges || [])], false);
    renderBadges(el("contextBadges"), page.protocol_badges || [], false);
    renderTopModels(comparableRows);
    renderBenchmarkRanking(comparableRows, referenceRows);
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
      t(`${model.model_name} Benchmark Results | BenchAtlas`, `${model.model_name} Benchmark 结果 | BenchAtlas`),
      t(`${model.model_name} benchmark results from ${model.vendor}: ${benchmarkCount} benchmark result groups with source evidence, protocols, and method notes.`, `${model.vendor} 的 ${model.model_name}：${benchmarkCount} 个 Benchmark 结果分组的公开结果、来源证据、评测协议和运行配置。`)
    );
    setStat("statModels", "statLabelModels", benchmarkCount, t(plural(benchmarkCount, "benchmark result group"), "Benchmark 结果分组"));
    setStat("statRows", "statLabelRows", rows.length, t(plural(rows.length, "reported row"), "报分记录"));
    setStat("statVendors", "statLabelVendors", reports.size, t(plural(reports.size, "report"), "报告"));
    setStat("statReports", "statLabelReports", domains.size, t(plural(domains.size, "domain"), "领域"));
    el("metricLabel").textContent = `${benchmarkCount} ${t(plural(benchmarkCount, "benchmark result group"), "个 Benchmark 结果分组")} · ${reports.size} ${t(plural(reports.size, "report"), "份报告")}`;
    el("rankingTitle").textContent = t("Reported benchmark results", "公开 Benchmark 结果");
    el("rankingNote").textContent = t("Each row keeps its benchmark-specific rank, protocol, and source evidence.", "每条记录保留其 Benchmark 内排名、评测协议和来源证据。");
    el("summaryHeading").textContent = t("Top domains", "主要领域");
    el("signalsHeading").textContent = t("Source coverage", "来源覆盖");
    el("policyHeading").textContent = t("Interpretation", "解读方式");
    el("policyText").textContent = t("Ranks are calculated within comparable setup groups inside each benchmark result group. Scores from different benchmarks, metrics, or evaluation setups are not directly compared.", "排名只在每个 Benchmark 结果分组内部的可比设置组中计算；不同 Benchmark、metric 或评测设置的分数不会直接比较。");
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
        <span>${esc(uiLabel(humanize(domain)))}</span>
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
    `).join("") || `<div class="empty">${t("No eligible models match these filters.", "没有符合当前筛选条件的模型。")}</div>`;
  }

  function sourceReports(row) {
    if (Array.isArray(row.source_reports) && row.source_reports.length) return row.source_reports;
    const ids = String(row.source_report_id || "").split("; ").filter(Boolean);
    const titles = String(row.source_report_title || "").split("; ").filter(Boolean);
    const publishers = String(row.source_publisher || "").split("; ").filter(Boolean);
    const urls = String(row.source_url || "").split("; ").filter(Boolean);
    const count = Math.max(ids.length, titles.length, urls.length, 1);
    return Array.from({ length: count }, (_, index) => ({
      report_id: ids[index] || ids[0] || "",
      report_title: titles[index] || titles[0] || ids[index] || ids[0] || t("Reported source", "报分来源"),
      source_publisher: publishers[index] || publishers[0] || t("Unknown publisher", "发布方未知"),
      source_url: urls[index] || urls[0] || "",
    }));
  }

  function renderSourceLinks(reports) {
    const linked = reports.filter(report => report.source_url);
    return linked.map((report, index) => (
      `<a href="${esc(report.source_url)}" target="_blank" rel="noreferrer">${esc(t("Primary source", "原始来源"))}${linked.length > 1 ? ` ${index + 1}` : ""} ↗</a>`
    )).join("");
  }

  function protocolCell(row) {
    const comparisonLabel = row.comparability_status === "strict" ? "shared protocol" : "source scoped";
    const sectionLabels = {
      evaluation_setup: t("Evaluation setup", "评测设置"),
      reasoning_configuration: t("Reasoning configuration", "推理配置"),
      agent_tool_scaffold: t("Agent / tool scaffold", "Agent 与工具框架"),
      dataset_variant: t("Dataset variant", "数据集变体"),
      runs_aggregation: t("Runs and aggregation", "运行次数与聚合"),
      source_caveat: t("Source caveat", "来源限制"),
    };
    const methodSections = Object.entries(sectionLabels).flatMap(([key, label]) => {
      const values = Array.isArray(row.method_sections?.[key]) ? row.method_sections[key].filter(Boolean) : [];
      return values.length ? [`<section><b>${esc(label)}</b>${values.map(value => `<p>${esc(value)}</p>`).join("")}</section>`] : [];
    }).join("");
    return `
      <div class="badges">
        ${row.model_configuration ? `<span class="badge">${esc(uiLabel(row.model_configuration))}</span>` : ""}
        ${!isRankingEligible(row) ? `<span class="badge warn">${esc(uiLabel(humanize(row.entity_type || "reference")))}</span>` : ""}
        <span class="badge ${row.comparability_status === "strict" ? "" : "warn"}">${esc(uiLabel(comparisonLabel))}</span>
        ${(row.protocol_badges || []).map(badge => `<span class="badge">${esc(uiLabel(badge))}</span>`).join("")}
      </div>
      ${!methodSections && row.protocol_short ? `<div class="method-summary"><b>${t("Method notes", "运行配置说明")}:</b> ${esc(row.protocol_short)}</div>` : ""}
      ${methodSections || row.protocol_full ? `
        <details class="method-note">
          <summary>${t("Show structured method notes", "展开结构化运行配置")}</summary>
          <div>${methodSections || esc(row.protocol_full)}</div>
        </details>
      ` : ""}
    `;
  }

  function sourceCell(row) {
    const reports = sourceReports(row);
    const reportTitles = [...new Set(reports.map(report => report.report_title).filter(Boolean))];
    const publishers = [...new Set(reports.map(report => report.source_publisher).filter(Boolean))];
    const comparisonLabel = row.comparability_status === "strict"
      ? t("shared comparison setup", "共享可比配置")
      : t("source-scoped setup", "来源限定配置");
    return `
      <div class="source">
        <div><b>${esc(t("Model vendor", "模型厂商"))}:</b> ${esc(row.vendor)}</div>
        <div><b>${esc(t("Score reported in", "报分报告"))}:</b> ${esc(reportTitles.join("; "))}</div>
        <div><b>${esc(t("Source publisher", "报告发布方"))}:</b> ${esc(publishers.join("; "))}</div>
        <div><b>${esc(t("Comparison status", "可比状态"))}:</b> ${esc(comparisonLabel)}</div>
        ${row.reported_model_name && row.reported_model_name !== row.model_name ? `<div><b>${esc(t("Reported entity", "报告中的实体"))}:</b> ${esc(row.reported_model_name)}</div>` : ""}
        ${reports.some(report => report.source_url) ? `<div class="source-links">${renderSourceLinks(reports)}</div>` : ""}
        <div>${esc(row.evidence_location)}</div>
        <details class="evidence-note">
          <summary>${esc(t("Evidence details", "证据详情"))}</summary>
          <div><b>${esc(t("Report ID", "报告 ID"))}:</b> ${esc(row.source_report_id)}</div>
          ${row.evidence_quote ? `<div><b>${esc(t("Quote", "摘录"))}:</b> ${esc(row.evidence_quote)}</div>` : ""}
        </details>
      </div>
    `;
  }

  function scoreCell(row) {
    return `${esc(fmt(row.score))}${row.score_unit === "%" ? "%" : row.score_unit ? ` ${esc(row.score_unit)}` : ""}`;
  }

  function renderBenchmarkRanking(rows, referenceRows = []) {
    if (!rows.length && !referenceRows.length) {
      el("rankingTable").innerHTML = `<div class="empty">${t("No scored rows for this benchmark.", "该 Benchmark 暂无可用报分。")}</div>`;
      return;
    }
    let previousScore = null;
    let comparableRank = 0;
    const rankedRows = rows.map((row, index) => {
      if (previousScore === null || String(row.score) !== previousScore) {
        comparableRank = index + 1;
        previousScore = String(row.score);
      }
      return { ...row, comparable_rank: comparableRank };
    });
    el("rankingTable").innerHTML = `
      <table>
        <thead><tr><th>${t("Rank","排名")}</th><th>${t("Model","模型")}</th><th>${t("Score","分数")}</th><th>${t("Protocol","协议")}</th><th>${t("Source evidence","来源证据")}</th></tr></thead>
        <tbody>
          ${rankedRows.map(row => `
            <tr>
              <td class="rank">#${esc(row.comparable_rank)}</td>
              <td>
                <div class="model"><a class="entity-link model-jump" href="${esc(modelPath(row.model_name))}" data-model="${esc(row.model_name)}">${esc(row.model_name)}</a></div>
                <div class="vendor">${esc(row.vendor)} · ${esc(uiLabel(row.model_configuration || t("Standard configuration", "标准配置")))}</div>
              </td>
              <td><div class="score">${scoreCell(row)}</div></td>
              <td>${protocolCell(row)}</td>
              <td>${sourceCell(row)}</td>
            </tr>
          `).join("")}
          ${referenceRows.map(row => `
            <tr class="reference-row">
              <td class="rank">REF</td>
              <td>
                <div class="model">${esc(row.reported_model_name || row.model_name)}</div>
                <div class="vendor">${esc(row.vendor)} · ${esc(humanize(row.entity_type || "reference"))}</div>
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
      el("rankingTable").innerHTML = `<div class="empty">${t("No benchmark rows found for this model.", "该模型暂无 Benchmark 记录。")}</div>`;
      return;
    }
    el("rankingTable").innerHTML = `
      <table>
        <thead><tr><th>${t("Rank","排名")}</th><th>Benchmark</th><th>${t("Score","分数")}</th><th>${t("Protocol","协议")}</th><th>${t("Source evidence","来源证据")}</th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td class="rank">#${esc(row.rank)}</td>
              <td>
                <div class="model"><a class="entity-link benchmark-jump" href="${esc(benchmarkPath(row.benchmark_key))}" data-benchmark="${esc(row.benchmark_key)}">${esc(row.benchmark_name)}</a></div>
                <div class="vendor">${esc(uiLabel(humanize(row.domain)))}${row.benchmark_variant ? ` · ${esc(row.benchmark_variant)}` : ""}<br>${esc(row.metric_name)} · ${esc(uiLabel(row.model_configuration || t("Standard configuration", "标准配置")))}</div>
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
      el("rankingTable").innerHTML = `<div class="empty">${t("No eligible models match these filters.", "没有符合当前筛选条件的模型。")}</div>`;
      return;
    }
    el("rankingTable").innerHTML = `
      <table>
        <thead><tr><th>${t("Rank","排名")}</th><th>${t("Base model","基础模型")}</th><th>${t("RAP score","平均排名分")}</th><th>${t("Coverage","覆盖")}</th><th>${t("Method","方法")}</th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td class="rank">#${esc(row.overall_rank)}</td>
              <td>
                <div class="model"><a class="entity-link model-jump" href="${esc(modelPath(row.model_name))}" data-model="${esc(row.model_name)}">${esc(row.model_name)}</a></div>
                <div class="vendor">${esc(row.vendor)}${row.configuration_count ? ` · ${esc(row.configuration_count)} ${t("public configurations","个公开配置")}` : ""}</div>
              </td>
              <td>
                <div class="score">${esc(row.index_score)}</div>
                <div class="vendor">${t("Raw domain score","领域原始分")} ${esc(row.raw_score)}</div>
              </td>
              <td>
                <div class="badges">
                  <span class="badge ${row.confidence === "provisional" ? "warn" : ""}">${esc(uiLabel(`${row.confidence} confidence`))}</span>
                </div>
                <div class="method-summary">${esc(row.benchmark_count)} ${t("Benchmark families", "个 Benchmark family")} · ${esc(row.leaderboard_count || row.benchmark_count)} ${t("leaderboard appearances", "次榜单出现")} · ${esc(row.domain_count)} ${t("domains","个领域")} · ${esc(row.report_count)} ${t(plural(row.report_count, "report"),"份报告")}</div>
              </td>
              <td>
                <div class="method-summary"><b>${t("Coverage adjustment:","覆盖校正：")}</b> ${t("the domain-balanced score is shrunk toward 50 when fewer Benchmark families are available.","当可用 Benchmark family 较少时，领域平衡分会向 50 收缩。")}</div>
                <a class="entity-link model-jump" href="${esc(modelPath(row.model_name))}" data-model="${esc(row.model_name)}">${t("Open model details","打开模型详情")}</a>
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
    el("totalCount").textContent = `${data.summary.reported_result_count || data.summary.result_count} ${t("rows", "条报分")}`;
    if (el("headerResults")) el("headerResults").textContent = fmt(data.summary.reported_result_count || data.summary.result_count);
    if (el("headerModels")) el("headerModels").textContent = fmt(data.summary.model_count);
    if (el("headerBenchmarks")) el("headerBenchmarks").textContent = fmt(data.summary.benchmark_family_count);
    if (el("headerResultsLabel")) el("headerResultsLabel").textContent = t("Reported results", "公开报分");
    if (el("headerModelsLabel")) el("headerModelsLabel").textContent = t("Base models", "基础模型");
    if (el("headerBenchmarksLabel")) el("headerBenchmarksLabel").textContent = t("Benchmark families", "Benchmark family");
    if (el("headerReports")) el("headerReports").textContent = `${fmt(data.summary.report_count)} ${t(plural(data.summary.report_count, "source report"), "份来源报告")}`;
    if (el("railCount")) el("railCount").textContent = `${fmt(data.summary.reported_result_count || data.summary.result_count)} ${t("results", "条报分")} · ${fmt(data.summary.benchmark_result_group_count || data.summary.benchmark_group_count)} ${t("groups", "个结果分组")}`;
    if (el("statusRows")) el("statusRows").textContent = `${fmt(data.summary.reported_result_count || data.summary.result_count)} ${t("results", "条报分")}`;
    if (el("statusEntity")) el("statusEntity").textContent = el("pageTitle")?.textContent || t("Evidence profile", "证据档案");
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
