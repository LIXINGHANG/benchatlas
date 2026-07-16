(() => {
  const data = window.BENCHATLAS_DATA;
  if (!data?.taxonomy || !data?.benchmark_catalog?.length) {
    document.body.innerHTML = '<main style="padding:40px;font-family:monospace">Taxonomy data is unavailable.</main>';
    return;
  }

  const taxonomy = data.taxonomy;
  const catalog = data.benchmark_catalog;
  const domains = taxonomy.primary_domains;
  const domainById = new Map(domains.map(domain => [domain.id, domain]));
  const safetyTaxonomy = taxonomy.safety_alignment || {view_id:'safety_alignment',label_zh:'安全与对齐',categories:[]};
  const safetyViewId = safetyTaxonomy.view_id || 'safety_alignment';
  const safetyCategories = safetyTaxonomy.categories || [];
  const safetyCategoryById = new Map(safetyCategories.map(category => [category.id, category]));
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const hash = value => [...value].reduce((result, char) => (result * 31 + char.charCodeAt(0)) >>> 0, 2166136261).toString(16);
  const stablePick = values => [...new Set(values.filter(Boolean))].sort((a,b) => values.filter(value => value === b).length - values.filter(value => value === a).length || a.length - b.length || a.localeCompare(b))[0] || '';
  const colorByDomain = {reason:'#28568c',code:'#087f78',agent:'#ae6a13',multi:'#69518e',language:'#4e7d37',expert:'#914d38',safety_alignment:safetyTaxonomy.color||'#b42318'};
  const catalogFingerprint = hash(catalog.map(item => item.rank_group_key).sort().join('|'));
  const storageKey = `benchatlas-taxonomy-review-v${taxonomy.schema_version}-${catalogFingerprint}`;
  const sourceLabels = {'benchmark_override':'人工覆盖','source_domain+keyword':'来源 + 关键词','source_domain+default':'来源 + 默认','fallback':'Fallback'};
  const statusLabels = {todo:'待审核',approved:'已确认',needs_review:'需讨论'};

  const familyMap = new Map();
  for (const item of catalog) {
    const name = item.benchmark_name;
    if (!familyMap.has(name)) familyMap.set(name, []);
    familyMap.get(name).push(item);
  }
  const benchmarks = [...familyMap].map(([name, items]) => {
    const primaryDomain = stablePick(items.map(item => item.primary_domain));
    const subfield = stablePick(items.map(item => item.subfield));
    return {
      name,
      items: items.sort((a,b) => a.rank_group_key.localeCompare(b.rank_group_key)),
      original: {
        primary_domain:primaryDomain,
        subfield,
        evaluation_purpose:stablePick(items.map(item => item.evaluation_purpose)) || (items.some(item => item.is_safety) ? 'safety_alignment' : 'capability'),
        safety_category:stablePick(items.map(item => item.safety_category))
      },
      taxonomySource: stablePick(items.map(item => item.taxonomy_source)),
      confidence: Math.min(...items.map(item => Number(item.taxonomy_confidence) || 0)),
      reason: stablePick(items.map(item => item.taxonomy_reason)),
      sourceDomain: stablePick(items.map(item => item.domain)),
      modelCount: Math.max(...items.map(item => item.model_count || 0)),
      reportCount: Math.max(...items.map(item => item.report_count || 0)),
      searchText: items.map(item => `${item.benchmark_name} ${item.benchmark_variant} ${item.metric_name} ${item.rank_group_key}`).join(' ').toLowerCase()
    };
  }).sort((a,b) => a.name.localeCompare(b.name));
  const benchmarkByName = new Map(benchmarks.map(item => [item.name, item]));

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); }
    catch { return {}; }
  })();
  const state = {
    activeDomain: domains[0].id,
    selectedName: '',
    assignments: saved.assignments || {},
    reviews: saved.reviews || {},
    query: '',
    statusFilter: 'all',
    sourceFilter: 'all',
    draggedName: '',
    history: []
  };

  function classification(benchmark) {
    return {...benchmark.original,...(state.assignments[benchmark.name] || {})};
  }

  function isChanged(benchmark) {
    const current = classification(benchmark);
    return current.primary_domain !== benchmark.original.primary_domain || current.subfield !== benchmark.original.subfield || current.evaluation_purpose !== benchmark.original.evaluation_purpose || current.safety_category !== benchmark.original.safety_category;
  }

  function isCapabilityChanged(benchmark) {
    const current = classification(benchmark);
    return current.primary_domain !== benchmark.original.primary_domain || current.subfield !== benchmark.original.subfield;
  }

  function isSafetyChanged(benchmark) {
    const current = classification(benchmark);
    return current.evaluation_purpose !== benchmark.original.evaluation_purpose || current.safety_category !== benchmark.original.safety_category;
  }

  function isSafetyBenchmark(benchmark) {
    return classification(benchmark).evaluation_purpose === 'safety_alignment';
  }

  function reviewFor(name) {
    return state.reviews[name] || {status:'todo', note:''};
  }

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify({assignments:state.assignments,reviews:state.reviews,updated_at:new Date().toISOString()}));
  }

  function snapshot() {
    state.history.push(JSON.stringify({assignments:state.assignments,reviews:state.reviews}));
    if (state.history.length > 40) state.history.shift();
  }

  function restoreSnapshot(raw) {
    const parsed = JSON.parse(raw);
    state.assignments = parsed.assignments || {};
    state.reviews = parsed.reviews || {};
    persist();
    renderAll();
  }

  function defaultSubfield(domainId) {
    return domainById.get(domainId)?.default_subfield || domainById.get(domainId)?.subfields?.[0]?.id || '';
  }

  function validClassification(primaryDomain, subfield) {
    return domainById.get(primaryDomain)?.subfields.some(item => item.id === subfield);
  }

  function storeClassification(benchmark, next) {
    const normalized = {...classification(benchmark),...next};
    if (normalized.evaluation_purpose !== 'safety_alignment') normalized.safety_category = '';
    const unchanged = Object.keys(benchmark.original).every(key => normalized[key] === benchmark.original[key]);
    if (unchanged) delete state.assignments[benchmark.name];
    else state.assignments[benchmark.name] = normalized;
  }

  function moveBenchmark(name, primaryDomain, subfield) {
    const benchmark = benchmarkByName.get(name);
    if (!benchmark || !validClassification(primaryDomain, subfield)) return;
    const current = classification(benchmark);
    if (current.primary_domain === primaryDomain && current.subfield === subfield) return;
    snapshot();
    storeClassification(benchmark,{primary_domain:primaryDomain, subfield});
    state.selectedName = name;
    state.activeDomain = primaryDomain;
    persist();
    renderAll();
    showToast(`${name} → ${subfieldLabel(primaryDomain, subfield)}`);
  }

  function setSafetyClassification(name, evaluationPurpose, safetyCategory = '') {
    const benchmark = benchmarkByName.get(name);
    if (!benchmark || !['capability','safety_alignment'].includes(evaluationPurpose)) return;
    if (evaluationPurpose === 'safety_alignment' && !safetyCategoryById.has(safetyCategory)) return;
    snapshot();
    storeClassification(benchmark,{evaluation_purpose:evaluationPurpose,safety_category:evaluationPurpose === 'safety_alignment' ? safetyCategory : ''});
    state.selectedName = name;
    if (evaluationPurpose === 'safety_alignment') state.activeDomain = safetyViewId;
    persist();
    renderAll();
    showToast(evaluationPurpose === 'safety_alignment' ? `${name} → ${safetyCategoryById.get(safetyCategory)?.label_zh}` : `${name} → 能力评测`);
  }

  function setReview(name, status, note = reviewFor(name).note || '') {
    if (!benchmarkByName.has(name) || !statusLabels[status]) return;
    snapshot();
    if (status === 'todo' && !note) delete state.reviews[name];
    else state.reviews[name] = {status,note};
    persist();
    renderAll();
  }

  function subfieldLabel(domainId, subfieldId) {
    return domainById.get(domainId)?.subfields.find(item => item.id === subfieldId)?.label_zh || subfieldId;
  }

  function filtered(benchmark) {
    const review = reviewFor(benchmark.name);
    const changed = isChanged(benchmark);
    if (state.query && !benchmark.searchText.includes(state.query)) return false;
    if (state.sourceFilter !== 'all' && benchmark.taxonomySource !== state.sourceFilter) return false;
    if (state.statusFilter === 'changed' && !changed) return false;
    if (!['all','changed'].includes(state.statusFilter) && review.status !== state.statusFilter) return false;
    return true;
  }

  function renderSummary() {
    const reviewed = benchmarks.filter(item => reviewFor(item.name).status !== 'todo').length;
    $('benchmarkCount').textContent = benchmarks.length;
    $('groupCount').textContent = catalog.length;
    $('reviewedCount').textContent = reviewed;
    $('progressBar').style.width = `${reviewed / benchmarks.length * 100}%`;
    $('undo').disabled = state.history.length === 0;
  }

  function renderDomains() {
    const capabilityDomains = domains.map(domain => {
      const domainBenchmarks = benchmarks.filter(item => classification(item).primary_domain === domain.id);
      const subfields = domain.subfields.map(subfield => {
        const count = domainBenchmarks.filter(item => classification(item).subfield === subfield.id).length;
        return `<button class="subfield-link" data-domain="${domain.id}" data-subfield="${subfield.id}"><span>${esc(subfield.label_zh)}</span><span>${count}</span></button>`;
      }).join('');
      return `<section class="domain ${state.activeDomain===domain.id?'active':''}" data-drop-domain="${domain.id}" style="--domain-color:${colorByDomain[domain.id]}"><button class="domain-head" data-domain="${domain.id}"><i></i><b>${esc(domain.label_zh)}</b><em>${domainBenchmarks.length}</em></button><div class="subfields">${subfields}</div></section>`;
    }).join('');
    const safetyBenchmarks = benchmarks.filter(isSafetyBenchmark);
    const safetyLinks = safetyCategories.map(category => `<button class="subfield-link" data-domain="${safetyViewId}" data-subfield="${category.id}"><span>${esc(category.label_zh)}</span><span>${safetyBenchmarks.filter(item => classification(item).safety_category === category.id).length}</span></button>`).join('');
    $('domainList').innerHTML = `${capabilityDomains}<div class="cross-domain-label">跨领域视图</div><section class="domain cross-domain ${state.activeDomain===safetyViewId?'active':''}" data-drop-safety="${safetyTaxonomy.default_category}" style="--domain-color:${colorByDomain[safetyViewId]}"><button class="domain-head" data-domain="${safetyViewId}"><i></i><b>${esc(safetyTaxonomy.label_zh)}</b><em>${safetyBenchmarks.length}</em></button><div class="subfields">${safetyLinks}</div></section>`;
    document.querySelectorAll('.domain-head').forEach(button => button.addEventListener('click', () => {state.activeDomain=button.dataset.domain;renderAll();}));
    document.querySelectorAll('.subfield-link').forEach(button => button.addEventListener('click', () => {
      state.activeDomain = button.dataset.domain;
      renderAll();
      document.querySelector(`[data-column="${button.dataset.subfield}"]`)?.scrollIntoView({behavior:'smooth',inline:'center'});
    }));
    bindDropTargets(document.querySelectorAll('[data-drop-domain]'), element => ({primary_domain:element.dataset.dropDomain,subfield:defaultSubfield(element.dataset.dropDomain)}));
    bindSafetyDropTargets(document.querySelectorAll('[data-drop-safety]'), element => element.dataset.dropSafety);
  }

  function cardHtml(benchmark) {
    const review = reviewFor(benchmark.name);
    const changed = isChanged(benchmark);
    const className = changed ? 'changed' : review.status === 'approved' ? 'approved' : review.status === 'needs_review' ? 'needs-review' : '';
    const current = classification(benchmark);
    const cardDomain = state.activeDomain===safetyViewId ? safetyViewId : current.primary_domain;
    return `<article class="card ${className} ${state.selectedName===benchmark.name?'selected':''}" draggable="true" data-name="${esc(benchmark.name)}" style="--domain-color:${colorByDomain[cardDomain]}"><h3>${esc(benchmark.name)}</h3><div class="card-meta"><span>${benchmark.items.length} group${benchmark.items.length===1?'':'s'}</span><span>${benchmark.modelCount} models</span><strong>${Math.round(benchmark.confidence*100)}%</strong><span>${esc(sourceLabels[benchmark.taxonomySource]||benchmark.taxonomySource)}</span>${isSafetyBenchmark(benchmark)?`<span>${esc(safetyCategoryById.get(current.safety_category)?.label_zh||'安全与对齐')}</span>`:''}</div></article>`;
  }

  function renderBoard() {
    if (state.activeDomain === safetyViewId) {
      $('boardTitle').textContent = safetyTaxonomy.label_zh;
      const safetyBenchmarks = benchmarks.filter(isSafetyBenchmark);
      const visibleTotal = safetyBenchmarks.filter(filtered).length;
      $('boardMeta').textContent = `${visibleTotal} / ${safetyBenchmarks.length} BENCHMARKS · 跨能力领域 · ${safetyCategories.length} SAFETY CATEGORIES`;
      $('board').innerHTML = safetyCategories.map(category => {
        const items = safetyBenchmarks.filter(item => classification(item).safety_category === category.id && filtered(item));
        return `<section class="column safety-column" data-drop-safety="${category.id}" data-column="${category.id}"><header class="column-head"><b>${esc(category.label_zh)}</b><span>${items.length}</span></header><div class="cards">${items.length?items.map(cardHtml).join(''):'<div class="empty">暂无匹配项</div>'}</div></section>`;
      }).join('');
      bindCards();
      bindSafetyDropTargets(document.querySelectorAll('[data-drop-safety]'), element => element.dataset.dropSafety);
      return;
    }
    const domain = domainById.get(state.activeDomain);
    $('boardTitle').textContent = domain.label_zh;
    const domainTotal = benchmarks.filter(item => classification(item).primary_domain === domain.id).length;
    const visibleTotal = benchmarks.filter(item => classification(item).primary_domain === domain.id && filtered(item)).length;
    $('boardMeta').textContent = `${visibleTotal} / ${domainTotal} BENCHMARKS · ${domain.subfields.length} SUBFIELDS`;
    $('board').innerHTML = domain.subfields.map(subfield => {
      const items = benchmarks.filter(item => {
        const current = classification(item);
        return current.primary_domain === domain.id && current.subfield === subfield.id && filtered(item);
      });
      return `<section class="column" data-drop-domain="${domain.id}" data-drop-subfield="${subfield.id}" data-column="${subfield.id}"><header class="column-head"><b>${esc(subfield.label_zh)}</b><span>${items.length}</span></header><div class="cards">${items.length?items.map(cardHtml).join(''):'<div class="empty">暂无匹配项</div>'}</div></section>`;
    }).join('');
    bindCards();
    bindDropTargets(document.querySelectorAll('[data-drop-subfield]'), element => ({primary_domain:element.dataset.dropDomain,subfield:element.dataset.dropSubfield}));
  }

  function bindCards() {
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => {state.selectedName=card.dataset.name;renderBoard();renderInspector();});
      card.addEventListener('dragstart', event => {state.draggedName=card.dataset.name;card.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',card.dataset.name);});
      card.addEventListener('dragend', () => {state.draggedName='';card.classList.remove('dragging');document.querySelectorAll('.drop-target').forEach(item=>item.classList.remove('drop-target'));});
    });
  }

  function bindDropTargets(elements, targetFor) {
    elements.forEach(element => {
      element.addEventListener('dragover', event => {event.preventDefault();element.classList.add('drop-target');event.dataTransfer.dropEffect='move';});
      element.addEventListener('dragleave', event => {if(!element.contains(event.relatedTarget))element.classList.remove('drop-target');});
      element.addEventListener('drop', event => {event.preventDefault();element.classList.remove('drop-target');const name=event.dataTransfer.getData('text/plain')||state.draggedName;const target=targetFor(element);moveBenchmark(name,target.primary_domain,target.subfield);});
    });
  }

  function bindSafetyDropTargets(elements, categoryFor) {
    elements.forEach(element => {
      element.addEventListener('dragover', event => {event.preventDefault();element.classList.add('drop-target');event.dataTransfer.dropEffect='move';});
      element.addEventListener('dragleave', event => {if(!element.contains(event.relatedTarget))element.classList.remove('drop-target');});
      element.addEventListener('drop', event => {event.preventDefault();element.classList.remove('drop-target');const name=event.dataTransfer.getData('text/plain')||state.draggedName;setSafetyClassification(name,'safety_alignment',categoryFor(element));});
    });
  }

  function renderInspector() {
    const benchmark = benchmarkByName.get(state.selectedName);
    if (!benchmark) {
      $('inspector').innerHTML = '<div class="inspector-empty">选择一个 Benchmark 查看分类依据<br>也可以直接拖动卡片调整分组</div>';
      return;
    }
    const current = classification(benchmark);
    const currentDomain = domainById.get(current.primary_domain);
    const review = reviewFor(benchmark.name);
    const domainOptions = domains.map(domain => `<option value="${domain.id}" ${domain.id===current.primary_domain?'selected':''}>${esc(domain.label_zh)}</option>`).join('');
    const subfieldOptions = currentDomain.subfields.map(subfield => `<option value="${subfield.id}" ${subfield.id===current.subfield?'selected':''}>${esc(subfield.label_zh)}</option>`).join('');
    const safetyCategoryOptions = safetyCategories.map(category => `<option value="${category.id}" ${category.id===current.safety_category?'selected':''}>${esc(category.label_zh)}</option>`).join('');
    const variants = benchmark.items.map(item => `<div class="variant"><b>${esc(item.metric_name)}${item.benchmark_variant?` · ${esc(item.benchmark_variant)}`:''}</b><code title="${esc(item.rank_group_key)}">${esc(item.rank_group_key)}</code></div>`).join('');
    $('inspector').innerHTML = `<article><p class="eyebrow">${esc(sourceLabels[benchmark.taxonomySource]||benchmark.taxonomySource)} · confidence ${Math.round(benchmark.confidence*100)}%</p><h2>${esc(benchmark.name)}</h2><p class="variant-count">${benchmark.items.length} rank groups · ${benchmark.modelCount} models · ${benchmark.reportCount} reports${isSafetyBenchmark(benchmark)?' · SAFETY & ALIGNMENT':''}</p><div class="original"><div><span>原能力领域</span><b>${esc(domainById.get(benchmark.original.primary_domain)?.label_zh)} / ${esc(subfieldLabel(benchmark.original.primary_domain,benchmark.original.subfield))}</b></div><div><span>原评测目的</span><b>${benchmark.original.evaluation_purpose==='safety_alignment'?esc(safetyCategoryById.get(benchmark.original.safety_category)?.label_zh||'安全与对齐'):'能力评测'}</b></div></div><div class="field"><label for="inspectorDomain">能力领域</label><select id="inspectorDomain">${domainOptions}</select></div><div class="field"><label for="inspectorSubfield">二级领域</label><select id="inspectorSubfield">${subfieldOptions}</select></div><button class="apply" id="applyClassification">应用能力分类</button><div class="field purpose-field"><label for="inspectorPurpose">评测目的（与能力领域并行）</label><select id="inspectorPurpose"><option value="capability" ${current.evaluation_purpose==='capability'?'selected':''}>能力评测</option><option value="safety_alignment" ${current.evaluation_purpose==='safety_alignment'?'selected':''}>安全与对齐</option></select></div><div class="field" id="safetyCategoryField" ${current.evaluation_purpose==='safety_alignment'?'':'hidden'}><label for="inspectorSafetyCategory">安全与对齐子类</label><select id="inspectorSafetyCategory">${safetyCategoryOptions}</select></div><button class="apply safety-apply" id="applySafetyClassification">应用评测目的</button><div class="field"><label>审核状态</label><div class="review-buttons">${Object.entries(statusLabels).map(([status,label])=>`<button data-status="${status}" class="${review.status===status?'active':''}">${label}</button>`).join('')}</div></div><div class="field"><label for="reviewNote">审核备注</label><textarea id="reviewNote" placeholder="分类依据、需要复核的问题或修改理由">${esc(review.note||'')}</textarea></div>${benchmark.reason?`<div class="field"><label>现有分类理由</label><div>${esc(benchmark.reason)}</div></div>`:''}<div class="variant-list"><h3>关联分组</h3>${variants}</div></article>`;
    $('inspectorDomain').addEventListener('change', event => {
      const domain = domainById.get(event.target.value);
      $('inspectorSubfield').innerHTML = domain.subfields.map(subfield => `<option value="${subfield.id}">${esc(subfield.label_zh)}</option>`).join('');
      $('inspectorSubfield').value = domain.default_subfield;
    });
    $('applyClassification').addEventListener('click', () => moveBenchmark(benchmark.name,$('inspectorDomain').value,$('inspectorSubfield').value));
    $('inspectorPurpose').addEventListener('change', event => {$('safetyCategoryField').hidden=event.target.value!=='safety_alignment';});
    $('applySafetyClassification').addEventListener('click', () => setSafetyClassification(benchmark.name,$('inspectorPurpose').value,$('inspectorSafetyCategory').value||safetyTaxonomy.default_category));
    document.querySelectorAll('.review-buttons button').forEach(button => button.addEventListener('click', () => setReview(benchmark.name,button.dataset.status,$('reviewNote').value.trim())));
    $('reviewNote').addEventListener('change', event => {
      const currentReview = reviewFor(benchmark.name);
      snapshot();
      if (currentReview.status === 'todo' && !event.target.value.trim()) delete state.reviews[benchmark.name];
      else state.reviews[benchmark.name] = {status:currentReview.status,note:event.target.value.trim()};
      persist();renderSummary();
    });
  }

  function renderAll() {
    renderSummary();
    renderDomains();
    renderBoard();
    renderInspector();
  }

  function buildPatch() {
    const changed = benchmarks.filter(isChanged);
    const reviewed = benchmarks.filter(item => reviewFor(item.name).status !== 'todo' || reviewFor(item.name).note);
    const benchmarkOverrides = {};
    for (const benchmark of changed) {
      const current = classification(benchmark);
      const existing = taxonomy.benchmark_overrides?.[benchmark.name] || {};
      const override = {
        ...existing,
        confidence: 1,
        reason: reviewFor(benchmark.name).note || 'Manual taxonomy review'
      };
      if (isCapabilityChanged(benchmark)) {
        const domain = domainById.get(current.primary_domain);
        override.source_domain = domain.source_domains[0];
        override.subfield = current.subfield;
        override.reason = reviewFor(benchmark.name).note || `Manual capability review: ${benchmark.original.primary_domain}/${benchmark.original.subfield} -> ${current.primary_domain}/${current.subfield}`;
      }
      if (isSafetyChanged(benchmark)) {
        override.evaluation_purpose = current.evaluation_purpose;
        if (current.evaluation_purpose === 'safety_alignment') override.safety_category = current.safety_category;
        else delete override.safety_category;
        if (!reviewFor(benchmark.name).note) {
          override.reason = `Manual purpose review: ${benchmark.original.evaluation_purpose}${benchmark.original.safety_category?`/${benchmark.original.safety_category}`:''} -> ${current.evaluation_purpose}${current.safety_category?`/${current.safety_category}`:''}`;
        }
      }
      benchmarkOverrides[benchmark.name] = override;
    }
    const records = [...new Set([...changed,...reviewed])].map(benchmark => ({
      benchmark_name: benchmark.name,
      rank_group_keys: benchmark.items.map(item => item.rank_group_key),
      original: benchmark.original,
      current: classification(benchmark),
      changed: isChanged(benchmark),
      status: reviewFor(benchmark.name).status,
      note: reviewFor(benchmark.name).note || ''
    }));
    return {
      patch_schema_version: 1,
      taxonomy_schema_version: taxonomy.schema_version,
      catalog_fingerprint: catalogFingerprint,
      generated_at: new Date().toISOString(),
      summary: {benchmark_names:benchmarks.length,rank_groups:catalog.length,reviewed:reviewed.length,changed:changed.length},
      benchmark_overrides: benchmarkOverrides,
      review_records: records
    };
  }

  function exportPatch(event) {
    const patch = buildPatch();
    const json = JSON.stringify(patch,null,2)+'\n';
    event.currentTarget.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    event.currentTarget.download = `taxonomy_review_patch_${new Date().toISOString().slice(0,10)}.json`;
    showToast(`已导出 ${patch.summary.changed} 项分类调整，${patch.summary.reviewed} 项审核记录`);
  }

  function importPatch(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const patch = JSON.parse(reader.result);
        if (patch.patch_schema_version !== 1) throw new Error('不支持的 patch 版本');
        if (patch.taxonomy_schema_version !== taxonomy.schema_version) throw new Error('taxonomy 版本不一致');
        snapshot();
        for (const record of patch.review_records || []) {
          const benchmark = benchmarkByName.get(record.benchmark_name);
          if (!benchmark) continue;
          const purposeValid = ['capability','safety_alignment'].includes(record.current?.evaluation_purpose);
          const categoryValid = record.current?.evaluation_purpose !== 'safety_alignment' || safetyCategoryById.has(record.current?.safety_category);
          if (record.changed && validClassification(record.current?.primary_domain,record.current?.subfield) && purposeValid && categoryValid) state.assignments[benchmark.name] = record.current;
          if (statusLabels[record.status] && (record.status !== 'todo' || record.note)) state.reviews[benchmark.name] = {status:record.status,note:record.note||''};
        }
        persist();renderAll();showToast(`已导入 ${patch.review_records?.length||0} 条审核记录`);
      } catch (error) { showToast(`导入失败：${error.message}`); }
    };
    reader.readAsText(file);
  }

  let toastTimer;
  function showToast(message) {
    $('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2400);
  }

  $('search').addEventListener('input', event => {state.query=event.target.value.trim().toLowerCase();renderBoard();});
  $('statusFilter').addEventListener('change', event => {state.statusFilter=event.target.value;renderBoard();});
  $('sourceFilter').addEventListener('change', event => {state.sourceFilter=event.target.value;renderBoard();});
  $('undo').addEventListener('click', () => {const previous=state.history.pop();if(previous)restoreSnapshot(previous);});
  $('reset').addEventListener('click', () => {if(!confirm('清除当前浏览器中的全部 Taxonomy 审核记录和调整？'))return;snapshot();state.assignments={};state.reviews={};persist();renderAll();showToast('已恢复权威 taxonomy 分类');});
  $('exportButton').addEventListener('click', exportPatch);
  $('importButton').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', event => {if(event.target.files?.[0])importPatch(event.target.files[0]);event.target.value='';});

  window.BENCHATLAS_TAXONOMY_REVIEW = {getPatch:buildPatch, storageKey};
  renderAll();
})();
