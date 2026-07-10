(() => {
  const data = window.BENCHATLAS_DATA;
  const benchmarkCatalog = data.benchmark_catalog;
  const modelCatalog = data.model_catalog;
  const pages = data.benchmark_pages;
  const modelByName = new Map(modelCatalog.map(model => [model.model_name, model]));
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
    sort: "coverage"
  };

  function currentCatalog() {
    return state.mode === "models" ? modelCatalog : benchmarkCatalog;
  }

  function itemKey(item) {
    return state.mode === "models" ? item.model_name : item.rank_group_key;
  }

  function updateHash() {
    const prefix = state.mode === "models" ? "model" : "benchmark";
    history.replaceState(null, "", `#${prefix}=${encodeURIComponent(state.selected)}`);
  }

  function configureControls() {
    const isModels = state.mode === "models";
    el("benchmarkViewTab").classList.toggle("active", !isModels);
    el("modelViewTab").classList.toggle("active", isModels);
    el("benchmarkViewTab").setAttribute("aria-selected", String(!isModels));
    el("modelViewTab").setAttribute("aria-selected", String(isModels));

    el("search").placeholder = isModels
      ? "Search model, vendor, domain"
      : "Search benchmark, domain, model";
    el("search").setAttribute("aria-label", isModels ? "Search models" : "Search benchmarks and models");

    if (isModels) {
      const vendors = ["all", ...Array.from(new Set(modelCatalog.map(item => item.vendor))).sort()];
      el("domainFilter").setAttribute("aria-label", "Vendor filter");
      el("domainFilter").innerHTML = vendors.map(vendor => (
        `<option value="${esc(vendor)}">${vendor === "all" ? "All vendors" : esc(vendor)}</option>`
      )).join("");
      el("sortMode").innerHTML = `
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
    state.sort = "coverage";
    el("search").value = "";
    configureControls();

    const catalog = currentCatalog();
    const valid = catalog.some(item => itemKey(item) === key);
    state.selected = valid ? key : itemKey(catalog[0]);
    if (writeHash) updateHash();
    renderList();
  }

  function filteredCatalog() {
    const query = state.query;
    let rows = currentCatalog().filter(item => {
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
        state.mode === "models"
          ? a.model_name.localeCompare(b.model_name)
          : `${a.benchmark_name} ${a.benchmark_variant}`.localeCompare(`${b.benchmark_name} ${b.benchmark_variant}`)
      ));
    } else if (state.sort === "reports") {
      rows.sort((a, b) => Number(b.report_count) - Number(a.report_count) || Number(b.benchmark_count || b.model_count) - Number(a.benchmark_count || a.model_count));
    } else if (state.sort === "results") {
      rows.sort((a, b) => Number(b.result_count) - Number(a.result_count) || Number(b.benchmark_count) - Number(a.benchmark_count));
    } else if (state.mode === "models") {
      rows.sort((a, b) => Number(b.benchmark_count) - Number(a.benchmark_count) || Number(b.result_count) - Number(a.result_count));
    } else {
      rows.sort((a, b) => Number(b.model_count) - Number(a.model_count) || Number(b.report_count) - Number(a.report_count));
    }
    return rows;
  }

  function renderList() {
    const rows = filteredCatalog();
    const previousSelection = state.selected;
    if (!rows.some(item => itemKey(item) === state.selected)) {
      state.selected = rows[0] ? itemKey(rows[0]) : itemKey(currentCatalog()[0]);
    }
    if (state.selected !== previousSelection) updateHash();

    const noun = state.mode === "models" ? "model" : "benchmark group";
    el("resultMeta").textContent = `${rows.length} ${noun}${rows.length === 1 ? "" : "s"}`;
    el("benchList").innerHTML = rows.map(item => (
      state.mode === "models" ? renderModelListItem(item) : renderBenchmarkListItem(item)
    )).join("") || `<div class="empty">No matching ${state.mode === "models" ? "models" : "benchmarks"}.</div>`;

    el("benchList").querySelectorAll("button[data-key]").forEach(button => {
      button.addEventListener("click", () => {
        state.selected = button.dataset.key;
        updateHash();
        renderList();
      });
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
        <span class="bench-score">${esc(item.result_count)} rows</span>
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

  function renderPage() {
    if (state.mode === "models") renderModelPage();
    else renderBenchmarkPage();
  }

  function renderBenchmarkPage() {
    const page = pages[state.selected];
    if (!page) return;
    const variant = page.benchmark_variant ? ` <span class="variant">${esc(page.benchmark_variant)}</span>` : "";
    el("domainLabel").textContent = humanize(page.domain || "benchmark");
    el("pageTitle").innerHTML = `${esc(page.benchmark_name)}${variant}`;
    document.title = `${page.benchmark_name} - BenchAtlas`;
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
    document.title = `${model.model_name} - BenchAtlas`;
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
                <div class="model"><button class="entity-link model-jump" data-model="${esc(row.model_name)}">${esc(row.model_name)}</button></div>
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
                <div class="model"><button class="entity-link benchmark-jump" data-benchmark="${esc(row.benchmark_key)}">${esc(row.benchmark_name)}</button></div>
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

  function attachEntityLinks() {
    el("rankingTable").querySelectorAll(".model-jump").forEach(button => {
      button.addEventListener("click", () => switchView("models", button.dataset.model));
    });
    el("rankingTable").querySelectorAll(".benchmark-jump").forEach(button => {
      button.addEventListener("click", () => switchView("benchmarks", button.dataset.benchmark));
    });
  }

  function init() {
    el("totalCount").textContent = `${data.summary.result_count} rows`;
    el("benchmarkViewTab").addEventListener("click", () => switchView("benchmarks", benchmarkCatalog[0]?.rank_group_key));
    el("modelViewTab").addEventListener("click", () => switchView("models", defaultModel?.model_name));
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
    configureControls();
    renderList();
  }

  init();
})();
