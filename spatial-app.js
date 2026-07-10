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
    const state = {scale:.72,x:40,y:18,drag:false,startX:0,startY:0,baseX:0,baseY:0,domain:'all',safetyOnly:false,query:'',selected:null,mode:'map'};
    const $ = id => document.getElementById(id);
    const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const formatScore = (score,unit) => score == null || score === '' ? '—' : `${score}${unit==='%'?'%':''}`;

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
      $('nodes').innerHTML=featured.map(item=>{const p=positions.get(item.rank_group_key);const risk=isSafety(item);return `<button class="node ${risk?'risk':''}" data-key="${esc(item.rank_group_key)}" data-domain="${esc(p.macro.id)}" data-risk="${risk}" style="left:${p.x-86}px;top:${p.y-34}px;--node-color:${p.macro.color};transform:scale(${Math.min(1.08,.84+item.model_count/80)})"><span class="coverage">${item.model_count}M</span><b>${esc(item.benchmark_name)}</b><small>${esc(item.domain.replaceAll('_',' '))} · ${esc(item.metric_name)}</small><span class="best">${esc(formatScore(item.best_score,item.score_unit))}</span></button>`}).join('');
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

    function fitView(){const vp=$('viewport').getBoundingClientRect();state.scale=Math.min(.82,Math.max(.42,Math.min(vp.width/1800,vp.height/1100)*1.34));state.x=(vp.width-1800*state.scale)/2;state.y=(vp.height-1100*state.scale)/2;applyTransform();}
    function zoom(delta,cx=$('viewport').clientWidth/2,cy=$('viewport').clientHeight/2){const old=state.scale;state.scale=Math.max(.35,Math.min(1.35,state.scale+delta));state.x=cx-(cx-state.x)*(state.scale/old);state.y=cy-(cy-state.y)*(state.scale/old);applyTransform();}

    function selectBenchmark(key){
      const item=catalog.find(x=>x.rank_group_key===key);const page=pages[key];if(!item||!page)return;state.selected=key;
      document.querySelectorAll('.node').forEach(n=>n.classList.toggle('selected',n.dataset.key===key));
      document.querySelectorAll('.connection').forEach(route=>route.classList.toggle('selected',route.dataset.routeKey===key));
      const macro=getMacro(item.domain);$('inspectorDomain').textContent=`Selected landmark / ${macro.label}`;$('inspectorTitle').textContent=item.benchmark_name;$('inspectorSub').textContent=`${item.domain.replaceAll('_',' ')} · ${item.metric_name} · ${item.score_unit||'score'} · ${item.comparability}`;$('modelCount').textContent=item.model_count;$('vendorCount').textContent=item.vendor_count;$('reportCount').textContent=item.report_count;$('metricLabel').textContent=`${item.metric_name} · ${item.score_unit}`;
      $('statusDomain').textContent=state.domain==='all'?macro.label:macroRules.find(rule=>rule.id===state.domain)?.label||'All domains';
      $('statusSelection').textContent=item.benchmark_name;
      const rows=page.rows.slice(0,6);$('ranking').innerHTML=rows.map(row=>`<div class="rank-row" data-row="${row.rank}"><span class="num">${String(row.rank).padStart(2,'0')}</span><span><b>${esc(row.model_name)}</b><small>${esc(row.vendor)}</small></span><span class="score">${esc(formatScore(row.score,row.score_unit))}</span></div>`).join('')||'<p class="method">No reported rows.</p>';
      updateEvidence(rows[0],item);$('inspector').classList.add('open');
      $('benchmarkLink').href=`/benchmarks/${slugify(item.rank_group_key)}/`;
      document.querySelectorAll('.rank-row').forEach((row,index)=>row.addEventListener('click',()=>updateEvidence(rows[index],item)));
      showToast(`${item.benchmark_name} · ${item.model_count} models`);
    }

    function updateEvidence(row,item){if(!row)return;$('methodNote').textContent=row.protocol_full||row.protocol_note||'No benchmark-specific method note was reported.';const badgeList=[row.comparability_label,...(isSafety(item)?['safety layer']:[]),...(row.protocol_badges||[])].filter(Boolean);$('badges').innerHTML=badgeList.map((b,i)=>`<span class="badge ${i===0||b==='safety layer'?'red':''}">${esc(b)}</span>`).join('');$('sourceLocation').textContent=row.evidence_location||'source located';$('evidenceQuote').textContent=row.evidence_quote||'No short evidence quote available.';$('sourceLink').href=row.source_url||'#';}

    function applyFilters(){const q=state.query.toLowerCase();document.querySelectorAll('.node').forEach(node=>{const item=catalog.find(x=>x.rank_group_key===node.dataset.key);const domainOk=state.domain==='all'||node.dataset.domain===state.domain;const safetyOk=!state.safetyOnly||node.dataset.risk==='true';const queryOk=!q||`${item.benchmark_name} ${item.domain} ${item.best_model}`.toLowerCase().includes(q);node.classList.toggle('hidden',!domainOk||!safetyOk);node.classList.toggle('dimmed',domainOk&&safetyOk&&!queryOk);});const selectedItem=catalog.find(item=>item.rank_group_key===state.selected);const selectedMacro=selectedItem&&getMacro(selectedItem.domain);const filterMacro=macroRules.find(rule=>rule.id===state.domain);$('statusDomain').textContent=state.safetyOnly?'Safety layer':filterMacro?.label||selectedMacro?.label||'All domains';renderRegistry();renderMatrix();}

    function renderFilters(){$('filters').innerHTML=`<button class="filter active" data-domain="all">All</button>`+macroRules.map(r=>`<button class="filter" data-domain="${r.id}">${r.label}</button>`).join('')+`<button class="filter risk-filter" data-layer="safety">Safety layer</button>`;document.querySelectorAll('[data-domain]').forEach(btn=>btn.addEventListener('click',()=>{state.domain=btn.dataset.domain;document.querySelectorAll('[data-domain]').forEach(b=>b.classList.toggle('active',b===btn));applyFilters();}));document.querySelector('[data-layer="safety"]').addEventListener('click',event=>{state.safetyOnly=!state.safetyOnly;event.currentTarget.classList.toggle('active',state.safetyOnly);applyFilters();});}
    function filteredCatalog(){const q=state.query.toLowerCase();return catalog.filter(item=>(state.domain==='all'||getMacro(item.domain).id===state.domain)&&(!state.safetyOnly||isSafety(item))&&(!q||`${item.benchmark_name} ${item.domain} ${item.best_model}`.toLowerCase().includes(q)));}
    function renderRegistry(){$('registryBody').innerHTML=filteredCatalog().slice(0,100).map(item=>{const macro=getMacro(item.domain);return `<tr data-key="${esc(item.rank_group_key)}"><td><b>${esc(item.benchmark_name)}</b><small>${esc(item.metric_name)} · ${esc(item.score_unit)}</small></td><td>${esc(macro.label)}<small>${esc(item.domain.replaceAll('_',' '))}${isSafety(item)?' · safety':''}</small></td><td>${item.model_count}</td><td>${item.vendor_count}</td><td class="score">${esc(formatScore(item.best_score,item.score_unit))}<small>${esc(item.best_model)}</small></td><td>${esc(item.protocol_badges||'—')}</td></tr>`}).join('');document.querySelectorAll('#registryBody tr').forEach(row=>row.addEventListener('click',()=>selectBenchmark(row.dataset.key)));}

    function renderMatrix(){
      const items=filteredCatalog().slice(0,10);const modelCounts=new Map();items.forEach(item=>(pages[item.rank_group_key]?.rows||[]).forEach(r=>modelCounts.set(r.model_name,(modelCounts.get(r.model_name)||0)+1)));const models=[...modelCounts].sort((a,b)=>b[1]-a[1]).slice(0,7).map(x=>x[0]);
      $('matrixTable').innerHTML=`<thead><tr><th>Benchmark</th>${models.map(m=>`<th>${esc(m)}</th>`).join('')}</tr></thead><tbody>${items.map(item=>{const rows=pages[item.rank_group_key]?.rows||[];return `<tr><td><b>${esc(item.benchmark_name)}</b><small>${esc(item.metric_name)}</small></td>${models.map(model=>{const r=rows.find(x=>x.model_name===model);if(!r)return'<td class="cell empty">—</td>';const cls=r.rank<=2?'top':r.rank<=5?'mid':'low';return `<td class="cell ${cls}">${esc(formatScore(r.score,r.score_unit))}</td>`}).join('')}</tr>`}).join('')}</tbody>`;
    }

    function switchMode(mode){state.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.querySelectorAll('.view-panel').forEach(p=>p.classList.remove('active'));$(`${mode}Panel`).classList.add('active');if(mode==='map')setTimeout(fitView,0);}
    function showToast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1600);}

    const vp=$('viewport');vp.addEventListener('pointerdown',e=>{if(e.target.closest('.node'))return;state.drag=true;state.startX=e.clientX;state.startY=e.clientY;state.baseX=state.x;state.baseY=state.y;vp.setPointerCapture(e.pointerId);vp.classList.add('dragging')});vp.addEventListener('pointermove',e=>{if(!state.drag)return;state.x=state.baseX+e.clientX-state.startX;state.y=state.baseY+e.clientY-state.startY;applyTransform()});vp.addEventListener('pointerup',()=>{state.drag=false;vp.classList.remove('dragging')});vp.addEventListener('wheel',e=>{e.preventDefault();const r=vp.getBoundingClientRect();zoom(e.deltaY<0?.08:-.08,e.clientX-r.left,e.clientY-r.top)},{passive:false});
    $('zoomIn').addEventListener('click',()=>zoom(.1));$('zoomOut').addEventListener('click',()=>zoom(-.1));$('resetView').addEventListener('click',fitView);$('closeInspector').addEventListener('click',()=>$('inspector').classList.remove('open'));document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>switchMode(btn.dataset.mode)));$('search').addEventListener('input',e=>{state.query=e.target.value.trim();applyFilters()});document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus()}});window.addEventListener('resize',()=>state.mode==='map'&&fitView());

    const formatCount=value=>Number(value||0).toLocaleString('en-US');
    $('railCount').textContent=`${data.summary.result_count} ROWS · ${data.summary.model_count} MODELS · ${data.summary.benchmark_group_count} BENCHMARKS`;
    $('headerReports').textContent=`${formatCount(data.summary.report_count)} source reports`;
    $('headerBenchmarks').textContent=formatCount(data.summary.benchmark_group_count);
    $('headerProtocols').textContent=formatCount(data.summary.protocol_count);
    $('statusResults').textContent=`${formatCount(data.summary.result_count)} results`;
    $('statusModels').textContent=`${formatCount(data.summary.model_count)} models`;
    renderFilters();renderMap();renderRegistry();renderMatrix();fitView();selectBenchmark(featured[0].rank_group_key);
    if (window.matchMedia('(max-width:1050px)').matches) $('inspector').classList.remove('open');
