const data = window.BENCHATLAS_DATA;
    const catalog = [...data.benchmark_catalog].sort((a,b)=>b.model_count-a.model_count || b.result_count-a.result_count);
    const pages = data.benchmark_pages;
    const macroRules = [
      {id:'reason',label:'Reasoning & Knowledge',color:'#27548a',center:[280,270],domains:['reasoning','math','general','general_capability']},
      {id:'code',label:'Coding & Software Engineering',color:'#0f766e',center:[900,270],domains:['coding']},
      {id:'agent',label:'Agents & Computer Use',color:'#a96812',center:[1520,270],domains:['agent','computer_use','business_simulation','healthcare_agent']},
      {id:'multi',label:'Multimodal & Perception',color:'#67528d',center:[280,800],domains:['multimodal','vision','video','document']},
      {id:'language',label:'Language & Long Context',color:'#4f7d35',center:[900,800],domains:['language','multilingual','long_context']},
      {id:'expert',label:'Expert & Frontier Domains',color:'#8b4b36',center:[1520,800],domains:['science','health','research','professional','expert_tasks','cybersecurity','security','self_improvement']}
    ];
    const safetyDomains = new Set(['safety','agent_safety','bio_safety','computer_use_safety','cyber_safety','health_safety','safety_bias','safety_health','vision_safety']);
    const isSafety = item => safetyDomains.has(item.domain);
    const getMacro = domain => {
      const direct = macroRules.find(rule=>rule.domains.includes(domain));
      if (direct) return direct;
      if (domain === 'vision_safety') return macroRules.find(rule=>rule.id === 'multi');
      if (domain === 'computer_use_safety' || domain === 'agent_safety') return macroRules.find(rule=>rule.id === 'agent');
      if (['health_safety','safety_health','bio_safety','cyber_safety'].includes(domain)) return macroRules.find(rule=>rule.id === 'expert');
      return macroRules.find(rule=>rule.id === 'reason');
    };
    const hash = value => [...value].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,2166136261);
    const slugify = value => String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'item';
    const featured = catalog.slice(0,42);
    const positions = new Map();
    const state = {scale:.72,x:40,y:18,drag:false,startX:0,startY:0,baseX:0,baseY:0,domain:'all',safetyOnly:false,query:'',selected:null,mode:'map',activeVariants:[],activeItem:null};
    const $ = id => document.getElementById(id);
    const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const formatScore = (score,unit) => score == null || score === '' ? '—' : `${score}${unit==='%'?'%':''}`;
    const displayOverrides = {
      gpqa_diamond_score:'GPQA Diamond · Reported Score',gpqa_diamond_accuracy:'GPQA Diamond · Accuracy',
      mcp_atlas_score:'MCP Atlas · Reported Score',mcp_atlas_public_set_score:'MCP Atlas · Public Set',mcp_atlas_pass_at_1:'MCP Atlas · Pass@1',
      terminal_bench_2_1_score:'Terminal-Bench 2.1 · Reported Score',hmmt_2026_feb_score:'HMMT Feb. 2026',hmmt_feb_2026_score:'HMMT Feb. 2026 · Alternate Report',
      benchcad_score:'BenchCAD · Standard',benchcad_python_tool_score:'BenchCAD · Python Tool',deepswe_score:'DeepSWE · Official Pier',deepswe_v1_1_score:'DeepSWE v1.1'
    };
    const canonicalBase = name => String(name||'').replace(/^GPQA-Diamond$/i,'GPQA Diamond').replace(/^MCP-Atlas$/i,'MCP Atlas').replace(/^Terminal[ -]bench 2\.1$/i,'Terminal-Bench 2.1').replace(/^SWE-bench Verified$/i,'SWE-Bench Verified');
    const displayName = item => {if(displayOverrides[item.rank_group_key])return displayOverrides[item.rank_group_key];const base=canonicalBase(item.benchmark_name);const variant=String(item.benchmark_variant||'').trim();return variant&&!base.toLowerCase().includes(variant.toLowerCase())?`${base} · ${variant}`:base;};
    const numericScore = row => Number.parseFloat(row?.score);
    const groupRowsByModel = rows => {const grouped=new Map();rows.forEach(row=>{const key=String(row.model_name||'Unknown model').trim().toLowerCase();if(!grouped.has(key))grouped.set(key,{model_name:row.model_name,vendor:row.vendor,rows:[]});grouped.get(key).rows.push(row);});return [...grouped.values()].map(group=>{group.rows.sort((a,b)=>(numericScore(b)||-Infinity)-(numericScore(a)||-Infinity));group.best=group.rows[0];group.sources=new Set(group.rows.map(row=>row.source_report_id||row.source_url).filter(Boolean)).size;return group;}).sort((a,b)=>(numericScore(b.best)||-Infinity)-(numericScore(a.best)||-Infinity));};
    const itemSearchText = item => `${displayName(item)} ${item.benchmark_name} ${item.domain} ${item.metric_name} ${(pages[item.rank_group_key]?.rows||[]).flatMap(row=>[row.model_name,row.vendor]).join(' ')}`.toLowerCase();
    const protocolParts = value => {const labels='Reasoning|Dataset|Context|Temperature|Top p|Judge model|Judge|Harness|Runs|Timeout|Tools|Max tokens';const parts=String(value||'').split(/\s*\|\s*/).flatMap(part=>part.split(new RegExp(`;?\\s*(?=(?:${labels}):)`,'i'))).map(part=>part.trim()).filter(Boolean);const unique=[];parts.forEach(part=>{const body=part.replace(/^[^:]{1,26}:\s*/,'');const key=body.toLowerCase().replace(/\s+/g,' ');const existing=unique.findIndex(item=>item.key===key||(key.length>70&&item.key.includes(key))||(item.key.length>70&&key.includes(item.key)));if(existing<0)unique.push({key,text:part});else if(part.length>unique[existing].text.length)unique[existing]={key,text:part};});return unique.map(item=>item.text);};
    const methodLabel = text => {const match=text.match(/^([A-Za-z][A-Za-z /_-]{1,24}):\s*/);return match?match[1].replaceAll('_',' '):'Evaluation setup';};
    const methodHtml = value => {const parts=protocolParts(value);if(!parts.length)return '<p>No benchmark-specific method note was reported.</p>';return parts.map(part=>{const label=methodLabel(part);const body=label==='Evaluation setup'?part:part.replace(/^[^:]{1,26}:\s*/,'');return `<div class="method-block"><b>${esc(label)}</b><p>${esc(body)}</p></div>`;}).join('');};
    const sourceLabel = row => {const url=String(row.source_url||'').split(/;\s*/)[0];try{return new URL(url).hostname.replace(/^www\./,'');}catch{return String(row.source_report_id||'reported source').split(/;\s*/)[0].replaceAll('_',' ');}};

    function positionNodes(){
      const groups = new Map(macroRules.map(r=>[r.id,[]]));
      featured.forEach(item=>groups.get(getMacro(item.domain).id).push(item));
      groups.forEach((items,id)=>{const rule=macroRules.find(r=>r.id===id);const rows=Math.ceil(items.length/3);items.forEach((item,index)=>{const column=index%3;const row=Math.floor(index/3);const jitterX=(hash(item.rank_group_key)%7)-3;const jitterY=(hash(item.benchmark_name)%5)-2;positions.set(item.rank_group_key,{x:rule.center[0]+(column-1)*190+jitterX,y:rule.center[1]+(row-(rows-1)/2)*96+jitterY,macro:rule});});});
    }

    function renderMap(){
      positionNodes();
      $('clusterLabels').innerHTML=macroRules.map(rule=>`<div class="cluster-label" style="left:${rule.center[0]-95}px;top:${rule.center[1]-150}px;color:${rule.color}66">${rule.label}</div>`).join('');
      const macroById=new Map(macroRules.map(rule=>[rule.id,rule]));
      const routePairs=[['reason','code'],['code','agent'],['multi','language'],['language','expert'],['reason','multi'],['code','language'],['agent','expert'],['code','multi'],['agent','language']];
      const globalRoutes=routePairs.map(([fromId,toId],index)=>{const from=macroById.get(fromId),to=macroById.get(toId);const bend=index%2===0?42:-42;const midX=(from.center[0]+to.center[0])/2;const midY=(from.center[1]+to.center[1])/2+bend;return `<path class="global-route" d="M${from.center[0]} ${from.center[1]} Q${midX} ${midY} ${to.center[0]} ${to.center[1]}"/>`;}).join('');
      const contours=macroRules.map(rule=>`<circle class="contour" cx="${rule.center[0]}" cy="${rule.center[1]}" r="190"/><circle class="contour" cx="${rule.center[0]}" cy="${rule.center[1]}" r="125"/><circle class="route-hub" cx="${rule.center[0]}" cy="${rule.center[1]}" r="8" fill="${rule.color}"/>`).join('');
      const domainRoutes=featured.map(item=>{const p=positions.get(item.rank_group_key);return `<path class="connection" data-route-key="${esc(item.rank_group_key)}" style="stroke:${p.macro.color}88" d="M${p.macro.center[0]} ${p.macro.center[1]} Q ${(p.x+p.macro.center[0])/2+22} ${(p.y+p.macro.center[1])/2-18} ${p.x} ${p.y}"/>`}).join('');
      $('mapSvg').innerHTML=globalRoutes+contours+domainRoutes;
      $('nodes').innerHTML=featured.map(item=>{const p=positions.get(item.rank_group_key);const risk=isSafety(item);return `<button class="node ${risk?'risk':''}" data-key="${esc(item.rank_group_key)}" data-domain="${esc(p.macro.id)}" data-risk="${risk}" style="left:${p.x-90}px;top:${p.y-35}px;--node-color:${p.macro.color};transform:scale(${Math.min(1.08,.84+item.model_count/80)})"><span class="coverage">${item.model_count} models</span><b>${esc(displayName(item))}</b><small>${esc(item.domain.replaceAll('_',' '))} · ${esc(item.metric_name)}</small><span class="best">${esc(formatScore(item.best_score,item.score_unit))}</span></button>`}).join('');
      document.querySelectorAll('.node').forEach(node=>node.addEventListener('click',e=>{e.stopPropagation();selectBenchmark(node.dataset.key);}))
      renderMiniMap(); applyTransform();
    }

    function renderMiniMap(){
      $('miniMap').querySelectorAll('span').forEach(n=>n.remove());
      featured.forEach(item=>{const p=positions.get(item.rank_group_key);const dot=document.createElement('span');dot.style.left=`${p.x/1800*150}px`;dot.style.top=`${p.y/1100*94}px`;dot.style.background=p.macro.color;$('miniMap').appendChild(dot);});
    }

    function applyTransform(){
      $('world').style.transform=`translate(${state.x}px,${state.y}px) scale(${state.scale})`;
      const zoomLabel=`${Math.round(state.scale*100)}%`;
      $('resetView').textContent=zoomLabel;
      $('statusZoom').textContent=zoomLabel;
      const vp=$('viewport').getBoundingClientRect();const mini=$('miniViewport');mini.style.left=`${Math.max(0,-state.x/state.scale/1800*150)}px`;mini.style.top=`${Math.max(0,-state.y/state.scale/1100*94)}px`;mini.style.width=`${Math.min(150,vp.width/state.scale/1800*150)}px`;mini.style.height=`${Math.min(94,vp.height/state.scale/1100*94)}px`;
    }

    function fitView(){const vp=$('viewport').getBoundingClientRect();state.scale=Math.min(.86,Math.max(.42,Math.min(vp.width/1800,vp.height/1100)*1.45));state.x=(vp.width-1800*state.scale)/2;state.y=(vp.height-1100*state.scale)/2;applyTransform();}
    function zoom(delta,cx=$('viewport').clientWidth/2,cy=$('viewport').clientHeight/2){const old=state.scale;state.scale=Math.max(.35,Math.min(1.35,state.scale+delta));state.x=cx-(cx-state.x)*(state.scale/old);state.y=cy-(cy-state.y)*(state.scale/old);applyTransform();}
    function centerOn(key){const p=positions.get(key);if(!p)return;const vp=$('viewport').getBoundingClientRect();state.scale=Math.max(state.scale,.76);state.x=vp.width/2-p.x*state.scale;state.y=vp.height/2-p.y*state.scale;applyTransform();}

    function selectBenchmark(key){
      const item=catalog.find(x=>x.rank_group_key===key);const page=pages[key];if(!item||!page)return;state.selected=key;state.activeItem=item;
      document.querySelectorAll('.node').forEach(n=>n.classList.toggle('selected',n.dataset.key===key));
      document.querySelectorAll('.connection').forEach(route=>route.classList.toggle('selected',route.dataset.routeKey===key));
      const groupedRows=groupRowsByModel(page.rows);const macro=getMacro(item.domain);$('inspectorDomain').textContent=`Selected landmark / ${macro.label}`;$('inspectorTitle').textContent=displayName(item);$('inspectorSub').textContent=`${item.domain.replaceAll('_',' ')} · ${item.metric_name} ${item.score_unit||''} · ${page.rows.length} reported rows`;$('modelCount').textContent=groupedRows.length;$('vendorCount').textContent=item.vendor_count;$('reportCount').textContent=item.report_count;$('metricLabel').textContent=`${item.metric_name} · ${item.score_unit}`;
      $('statusDomain').textContent=state.domain==='all'?macro.label:macroRules.find(rule=>rule.id===state.domain)?.label||'All domains';
      $('statusSelection').textContent=displayName(item);
      const groups=groupedRows.slice(0,6);$('ranking').innerHTML=groups.map((group,index)=>`<div class="rank-row ${index===0?'active':''}" data-group="${index}"><span class="num">${String(index+1).padStart(2,'0')}</span><span><b>${esc(group.model_name)}</b><small>${esc(group.vendor)}${group.rows.length>1?` · ${group.rows.length} reported variants`:''}</small></span><span class="score">${esc(formatScore(group.best.score,group.best.score_unit))}</span></div>`).join('')||'<p class="method">No reported rows.</p>';
      const showGroup=index=>{const group=groups[index];if(!group)return;document.querySelectorAll('.rank-row').forEach(row=>row.classList.toggle('active',Number(row.dataset.group)===index));state.activeVariants=group.rows;$('variantPicker').style.display=group.rows.length?'block':'none';$('variantSelect').innerHTML=group.rows.map((row,rowIndex)=>`<option value="${rowIndex}">${esc(formatScore(row.score,row.score_unit))} · ${esc(sourceLabel(row))}${group.rows.length>1?` · variant ${rowIndex+1}`:''}</option>`).join('');$('methodStatus').textContent=group.rows.length>1?`${group.rows.length} reported variants`:'1 reported variant';updateEvidence(group.rows[0],item);};
      showGroup(0);$('inspector').classList.add('open');
      $('benchmarkLink').href=`/benchmarks/${slugify(item.rank_group_key)}/`;
      document.querySelectorAll('.rank-row').forEach((row,index)=>row.addEventListener('click',()=>showGroup(index)));
      showToast(`${displayName(item)} · ${groupedRows.length} unique models`);
    }

    function updateEvidence(row,item){if(!row)return;$('methodNote').innerHTML=methodHtml(row.protocol_full||row.protocol_note);const badgeList=[row.comparability_label,...(isSafety(item)?['safety layer']:[]),...(row.protocol_badges||[])].filter(Boolean);$('badges').innerHTML=[...new Set(badgeList)].map((b,i)=>`<span class="badge ${i===0||b==='safety layer'?'red':''}">${esc(b.replaceAll('_',' '))}</span>`).join('');$('sourceLocation').textContent=row.evidence_location||'source located';$('evidenceQuote').textContent=row.evidence_quote||'No short evidence quote available.';$('sourceLink').href=String(row.source_url||'#').split(/;\s*/)[0];}

    function applyFilters(){const q=state.query.toLowerCase();document.querySelectorAll('.node').forEach(node=>{const item=catalog.find(x=>x.rank_group_key===node.dataset.key);const domainOk=state.domain==='all'||node.dataset.domain===state.domain;const safetyOk=!state.safetyOnly||node.dataset.risk==='true';const queryOk=!q||itemSearchText(item).includes(q);node.classList.toggle('hidden',!domainOk||!safetyOk);node.classList.toggle('dimmed',domainOk&&safetyOk&&!queryOk);});const selectedItem=catalog.find(item=>item.rank_group_key===state.selected);const selectedMacro=selectedItem&&getMacro(selectedItem.domain);const filterMacro=macroRules.find(rule=>rule.id===state.domain);const baseLabel=filterMacro?.label||selectedMacro?.label||'All domains';$('statusDomain').textContent=state.safetyOnly?`${baseLabel} · Safety`:baseLabel;renderRegistry();renderMatrix();}

    function clearFilters(){state.domain='all';state.safetyOnly=false;state.query='';$('domainSelect').value='all';$('safetyToggle').checked=false;$('search').value='';closeSearch();applyFilters();}
    function renderFilters(){$('filters').innerHTML=`<div class="field-control"><label class="toolbar-label" for="domainSelect">Field</label><select id="domainSelect" aria-label="Benchmark field"><option value="all">All benchmark fields</option>${macroRules.map(r=>`<option value="${r.id}">${r.label}</option>`).join('')}</select></div><label class="safety-toggle"><input id="safetyToggle" type="checkbox"><span>Safety layer</span></label><button class="filter-reset" id="clearFilters" aria-label="Reset filters" title="Reset filters">↺</button>`;$('domainSelect').addEventListener('change',event=>{state.domain=event.target.value;applyFilters();});$('safetyToggle').addEventListener('change',event=>{state.safetyOnly=event.target.checked;applyFilters();});$('clearFilters').addEventListener('click',clearFilters);}
    function filteredCatalog(){const q=state.query.toLowerCase();return catalog.filter(item=>(state.domain==='all'||getMacro(item.domain).id===state.domain)&&(!state.safetyOnly||isSafety(item))&&(!q||itemSearchText(item).includes(q)));}
    function protocolChips(item){const badges=String(item.protocol_badges||'').split(';').map(x=>x.trim()).filter(Boolean);if(!badges.length)return'<span class="protocol-more">No protocol tags</span>';return `<div class="protocol-chips">${badges.slice(0,3).map(b=>`<span class="protocol-chip">${esc(b)}</span>`).join('')}${badges.length>3?`<span class="protocol-more">+${badges.length-3}</span>`:''}</div>`;}
    function renderRegistry(){$('registryBody').innerHTML=filteredCatalog().slice(0,100).map(item=>{const macro=getMacro(item.domain);return `<tr data-key="${esc(item.rank_group_key)}"><td><b>${esc(displayName(item))}</b><small>${esc(item.metric_name)} · ${esc(item.score_unit)}${item.benchmark_variant?` · ${esc(item.benchmark_variant)}`:''}</small></td><td>${esc(macro.label)}<small>${esc(item.domain.replaceAll('_',' '))}${isSafety(item)?' · safety':''}</small></td><td>${item.model_count}<small>unique labels</small></td><td>${item.vendor_count}</td><td class="score">${esc(formatScore(item.best_score,item.score_unit))}<small>${esc(item.best_model)}</small></td><td>${protocolChips(item)}</td></tr>`}).join('');document.querySelectorAll('#registryBody tr').forEach(row=>row.addEventListener('click',()=>selectBenchmark(row.dataset.key)));}

    function renderMatrix(){
      const items=filteredCatalog().slice(0,10);const modelCounts=new Map();items.forEach(item=>groupRowsByModel(pages[item.rank_group_key]?.rows||[]).forEach(group=>modelCounts.set(group.model_name,(modelCounts.get(group.model_name)||0)+1)));const models=[...modelCounts].sort((a,b)=>b[1]-a[1]).slice(0,7).map(x=>x[0]);
      $('matrixBasis').textContent=`${items.length} highest-coverage benchmarks · ${models.length} most-covered models · protocols not normalized`;
      $('matrixTable').innerHTML=`<thead><tr><th>Benchmark</th>${models.map(m=>`<th>${esc(m)}</th>`).join('')}</tr></thead><tbody>${items.map(item=>{const groups=groupRowsByModel(pages[item.rank_group_key]?.rows||[]);return `<tr><td><b>${esc(displayName(item))}</b><small>${esc(item.metric_name)} · ${esc(item.score_unit)}</small></td>${models.map(model=>{const index=groups.findIndex(group=>group.model_name===model);if(index<0)return'<td class="cell empty">—</td>';const group=groups[index],r=group.best,cls=index<=1?'top':index<=4?'mid':'low';return `<td class="cell ${cls}" title="Best of ${group.rows.length} reported variant${group.rows.length===1?'':'s'}">${esc(formatScore(r.score,r.score_unit))}${group.rows.length>1?`<span class="variant-mark">${group.rows.length} variants</span>`:''}</td>`}).join('')}</tr>`}).join('')}</tbody>`;
    }

    function closeSearch(){$('searchResults').classList.remove('open');$('search').setAttribute('aria-expanded','false');}
    function renderSearchResults(){const q=state.query.trim().toLowerCase();if(!q){closeSearch();return;}const matches=catalog.filter(item=>itemSearchText(item).includes(q)).slice(0,8);$('searchResults').innerHTML=matches.length?matches.map(item=>{const nameMatch=`${displayName(item)} ${item.benchmark_name}`.toLowerCase().includes(q);return `<button class="search-result" role="option" data-key="${esc(item.rank_group_key)}"><span><b>${esc(displayName(item))}</b><small>${esc(getMacro(item.domain).label)} · ${item.model_count} models</small></span><em>${nameMatch?'benchmark':'model match'}</em></button>`;}).join(''):`<div class="search-empty">No benchmark or model matches “${esc(state.query)}”.</div>`;$('searchResults').classList.add('open');$('search').setAttribute('aria-expanded','true');document.querySelectorAll('.search-result').forEach(button=>button.addEventListener('click',()=>openSearchResult(button.dataset.key)));}
    function openSearchResult(key){const item=catalog.find(entry=>entry.rank_group_key===key);if(!item)return;state.domain='all';state.safetyOnly=false;$('domainSelect').value='all';$('safetyToggle').checked=false;closeSearch();selectBenchmark(key);if(positions.has(key)){state.query='';$('search').value='';applyFilters();switchMode('map');setTimeout(()=>centerOn(key),0);}else{state.query=displayName(item);$('search').value=displayName(item);applyFilters();switchMode('registry');showToast('Opened in Registry · not one of the 42 map landmarks');}}

    function switchMode(mode){state.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.querySelectorAll('.view-panel').forEach(p=>p.classList.remove('active'));$(`${mode}Panel`).classList.add('active');if(mode==='map')setTimeout(fitView,0);}
    function showToast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1600);}

    const vp=$('viewport');vp.addEventListener('pointerdown',e=>{if(e.target.closest('.node'))return;state.drag=true;state.startX=e.clientX;state.startY=e.clientY;state.baseX=state.x;state.baseY=state.y;vp.setPointerCapture(e.pointerId);vp.classList.add('dragging')});vp.addEventListener('pointermove',e=>{if(!state.drag)return;state.x=state.baseX+e.clientX-state.startX;state.y=state.baseY+e.clientY-state.startY;applyTransform()});vp.addEventListener('pointerup',()=>{state.drag=false;vp.classList.remove('dragging')});vp.addEventListener('wheel',e=>{e.preventDefault();const r=vp.getBoundingClientRect();zoom(e.deltaY<0?.08:-.08,e.clientX-r.left,e.clientY-r.top)},{passive:false});
    $('zoomIn').addEventListener('click',()=>zoom(.1));$('zoomOut').addEventListener('click',()=>zoom(-.1));$('resetView').addEventListener('click',fitView);$('closeInspector').addEventListener('click',()=>$('inspector').classList.remove('open'));document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>switchMode(btn.dataset.mode)));$('variantSelect').addEventListener('change',event=>updateEvidence(state.activeVariants[Number(event.target.value)],state.activeItem));$('search').addEventListener('input',e=>{state.query=e.target.value.trim();applyFilters();renderSearchResults();});$('search').addEventListener('keydown',event=>{if(event.key==='Enter'){const first=$('searchResults').querySelector('.search-result');if(first){event.preventDefault();openSearchResult(first.dataset.key);}}if(event.key==='Escape')closeSearch();});document.addEventListener('click',event=>{if(!event.target.closest('.search-wrap'))closeSearch();});document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus();$('search').select();}});window.addEventListener('resize',()=>state.mode==='map'&&fitView());

    const formatCount=value=>Number(value||0).toLocaleString('en-US');
    $('railCount').textContent=`${data.summary.result_count} ROWS · ${data.summary.model_count} MODELS · ${data.summary.benchmark_group_count} BENCHMARKS`;
    $('headerReports').textContent=`${formatCount(data.summary.report_count)} source reports`;
    $('statusResults').textContent=`${formatCount(data.summary.result_count)} results`;
    $('statusModels').textContent=`${formatCount(data.summary.model_count)} models`;
    $('mapCoverage').textContent=`${featured.length} of ${formatCount(data.summary.benchmark_group_count)} landmarks shown`;
    renderFilters();renderMap();renderRegistry();renderMatrix();fitView();selectBenchmark(featured[0].rank_group_key);
    if (window.matchMedia('(max-width:1050px)').matches) $('inspector').classList.remove('open');
    if (window.matchMedia('(max-width:650px)').matches) switchMode('registry');
