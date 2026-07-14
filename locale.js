(() => {
  const zh = document.documentElement.lang.toLowerCase().startsWith("zh");
  const t = (english, chinese) => zh ? chinese : english;
  const route = pathname => zh ? `/zh${pathname === "/" ? "/" : pathname}` : pathname;
  const counterpart = pathname => zh ? (pathname.replace(/^\/zh(?=\/|$)/, "") || "/") : `/zh${pathname === "/" ? "/" : pathname}`;
  window.BENCHATLAS_I18N = { zh, t, route, counterpart };

  const set = (selector, text) => { const node = document.querySelector(selector); if (node) node.textContent = text; };
  const attr = (selector, name, value) => { const node = document.querySelector(selector); if (node) node.setAttribute(name, value); };
  document.addEventListener("DOMContentLoaded", () => {
    const resourceNav = document.querySelector(".header-links");
    if (resourceNav && !resourceNav.querySelector("[data-locale-switch]")) {
      const link = document.createElement("a"); link.className = "header-link"; link.dataset.localeSwitch = ""; link.textContent = zh ? "EN" : "中文"; resourceNav.insertBefore(link, resourceNav.lastElementChild);
    }
    const brand = document.querySelector(".brand");
    if (brand && !document.querySelector(".site-header") && !brand.querySelector("[data-locale-switch]")) {
      const link = document.createElement("a"); link.dataset.localeSwitch = ""; link.textContent = zh ? "ENGLISH" : "中文"; link.style.cssText = "display:inline-block;margin-top:8px;color:inherit;font:12px var(--mono);text-decoration:none"; brand.appendChild(link);
    }
    document.querySelectorAll("a[data-locale-switch]").forEach(link => { link.href = `${counterpart(location.pathname)}${location.search}${location.hash}`; });
    if (!zh) return;
    set(".brandline", "空间化 Benchmark 导航"); set(".identity h1", "Benchmark 全景地图");
    set(".site-context small", "有来源证据的 Benchmark 图谱"); set(".site-context b", "模型、评测协议与原始证据");
    set(".site-live b", "数据已上线"); set(".site-metric:nth-child(2) small", "结果"); set(".site-metric:nth-child(3) small", "模型"); set(".site-metric:nth-child(4) small", "Benchmark");
    const detailSummary = window.BENCHATLAS_DATA?.summary;
    if (detailSummary) {
      set("#headerReports", `${Number(detailSummary.report_count || 0).toLocaleString("zh-CN")} 份来源报告`);
      set("#totalCount", `${Number(detailSummary.result_count || 0).toLocaleString("zh-CN")} 条记录`);
      set("#railCount", `${Number(detailSummary.result_count || 0).toLocaleString("zh-CN")} 条记录 · ${Number(detailSummary.model_count || 0).toLocaleString("zh-CN")} 个模型`);
      set("#statusRows", `${Number(detailSummary.result_count || 0).toLocaleString("zh-CN")} 条结果`);
    }
    set('.site-header .header-link[href="/"]', "地图"); set('.site-header .header-link[href="/guide/"]', "使用指南");
    set(".detail-toolbar .toolbar-label", "视图");
    const detailToolbarLinks = document.querySelectorAll(".detail-toolbar .toolbar-link");
    ["地图", "数据目录", "矩阵", "排名", "模型档案"].forEach((text, index) => { if (detailToolbarLinks[index]) detailToolbarLinks[index].textContent = text; });
    set(".toolbar-current", "证据目录 · 结果关联原始来源"); set(".detail-status b", "数据已上线");
    set(".live-state b", "数据已上线"); set(".header-stat:nth-child(1) small", "结果"); set(".header-stat:nth-child(2) small", "模型");
    set(".toolbar > .toolbar-label", "视图"); set('[data-mode="map"]', "地图"); set('[data-mode="registry"]', "数据目录"); set('[data-mode="matrix"]', "矩阵"); set('[data-mode="ranking"]', "排名"); set("#shareView", "分享");
    set(".map-legend b", "地图逻辑");
    const legend = document.querySelectorAll(".map-legend span:not(.legend-center):not(.legend-line):not(.legend-dot)");
    ["越近表示证据越充分", "同一系列", "共享模型", "二级领域方向", "当前选择"].forEach((text, i) => { if (legend[i]) legend[i].textContent = text; });
    const headers = document.querySelectorAll("#registryPanel th");
    ["Benchmark", "领域", "模型", "厂商", "最佳公开分数", "协议标签"].forEach((text, i) => { if (headers[i]) headers[i].textContent = text; });
    set(".matrix-note > span b", "可比矩阵"); set(".ranking-kicker", "公开能力上限"); set(".ranking-hero h2", "基础模型整体排名");
    set(".ranking-hero p", "每个 Benchmark 与共享协议分组采用最佳公开配置；Agent 系统、checkpoint 和 baseline 不参与排名。");
    set(".ranking-summary span:nth-child(1) small", "符合条件的基础模型"); set(".ranking-summary span:nth-child(2) small", "可比分组");
    set(".status-primary b", "数据已上线"); set("#statusDomain", "全部领域"); set("#statusSelection", "尚未选择节点");
    set(".inspector .metrics .metric:nth-child(1) span", "模型"); set(".inspector .metrics .metric:nth-child(2) span", "厂商"); set(".inspector .metrics .metric:nth-child(3) span", "报告");
    set(".inspector .section:nth-of-type(1) h3", "统一报分排名"); set(".rank-note", "每个基础模型显示最佳公开报分；颜色表示不同可比组，只有同色记录可以直接比较。");
    set(".inspector .section:nth-of-type(2) h3", "运行配置说明"); set('label[for="variantSelect"]', "报分来源与协议");
    set(".inspector .section:nth-of-type(3) h3", "原始证据"); set("#sourceLink", "打开原始来源 ↗"); set("#benchmarkLink", "打开完整 Benchmark 页面 →");
    attr("#search", "placeholder", "搜索 Benchmark 或模型"); attr("#search", "aria-label", "搜索 Benchmark 或模型"); attr("#closeInspector", "aria-label", "关闭详情");
    set(".brand h1", "数据目录"); set(".brand .subtitle", "浏览 Benchmark 与模型证据"); set("#modelViewTab", "模型"); set("#overallViewTab", "整体排名");
    set("#rankingTitle", "公开排名"); set("#rankingNote", "页面保留不同协议变体，不将它们强制归一化为同一排行榜。");
    set(".detail-panel .panel-title", "背景信息"); set("#summaryHeading", "最佳公开结果"); set("#signalsHeading", "协议标签"); set("#policyHeading", "证据规则");
    set("#policyText", "每条分数都保留原始报告、证据位置和评测说明。标记为 protocol variant 的记录可能使用不同 harness 或配置，应视为公开报分，而非严格归一化排行榜。");
    set('label[for="domainSelect"]', "领域"); set('label[for="modelSelect"]', "模型"); set(".safety-toggle span", "安全评测");
    const domainAll = document.querySelector('#domainSelect option[value="all"]'); if (domainAll) domainAll.textContent = "全部 Benchmark 领域";
    const modelAll = document.querySelector('#modelSelect option[value=""]'); if (modelAll) modelAll.textContent = "全部模型";
    set("#statLabelModels", "模型"); set("#statLabelRows", "报分记录"); set("#statLabelVendors", "厂商"); set("#statLabelReports", "报告");
    const sortOptions = document.querySelectorAll("#sortMode option"); ["按覆盖排序", "按名称排序", "按报告排序"].forEach((text, i) => { if (sortOptions[i]) sortOptions[i].textContent = text; });
    document.querySelectorAll('a[href^="/"]').forEach(link => {
      if (!link.hasAttribute("data-locale-switch") && !link.getAttribute("href").startsWith("/zh/")) link.href = route(link.getAttribute("href"));
    });
  });
})();
