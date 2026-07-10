const data = window.BENCHATLAS_DATA;
    const catalog = [...data.benchmark_catalog].sort((a,b)=>b.model_count-a.model_count || b.result_count-a.result_count);
    const pages = data.benchmark_pages;
    const macroRules = [
      {id:'code',label:'Code & Agents',color:'#0f766e',center:[290,280],domains:['coding','agent','computer_use','business_simulation','healthcare_agent']},
      {id:'reason',label:'Reasoning & Knowledge',color:'#27548a',center:[820,230],domains:['reasoning','math','general','general_capability','self_improvement']},
      {id:'multi',label:'Vision & Multimodal',color:'#a96812',center:[1350,275],domains:['multimodal','vision','video','document']},
      {id:'science',label:'Science & Expert',color:'#67528d',center:[390,770],domains:['science','health','research','professional','expert_tasks']},
      {id:'safety',label:'Safety & Security',color:'#b42318',center:[950,760],domains:['safety','security','cybersecurity','agent_safety','bio_safety','computer_use_safety','cyber_safety','health_safety','safety_bias','safety_health','vision_safety']},
      {id:'language',label:'Language & Context',color:'#4f7d35',center:[1450,760],domains:['language','multilingual','long_context']}
    ];
    const getMacro = domain => macroRules.find(rule=>rule.domains.includes(domain)) || macroRules[1];
    const hash = value => [...value].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,2166136261);
    const slugify = value => String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'item';
    const featured = catalog.slice(0,42);
    const positions = new Map();
    const state = {scale:.72,x:40,y:18,drag:false,startX:0,startY:0,baseX:0,baseY:0,domain:'all',query:'',selected:null,mode:'map'};
    const $ = id => document.getElementById(id);
    const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const formatScore = (score,unit) => score == null || score === '' ? '—' : `${score}${unit==='%'?'%':''}`;

    function positionNodes(){
      const groups = new Map(macroRules.map(r=>[r.id,[]]));
      featured.forEach(item=>groups.get(getMacro(item.domain).id).push(item));
      groups.forEach((items,id)=>{const rule=macroRules.find(r=>r.id===id);items.forEach((item,index)=>{const angle=(Math.PI*2*index/Math.max(items.length,1))+(hash(item.rank_group_key)%100)/180;const ring=85+Math.floor(index/6)*92+(hash(item.benchmark_name)%34);positions.set(item.rank_group_key,{x:rule.center[0]+Math.cos(angle)*ring,y:rule.center[1]+Math.sin(angle)*ring,macro:rule});});});
    }

    function renderMap(){
      positionNodes();
      $('clusterLabels').innerHTML=macroRules.map(rule=>`<div class="cluster-label" style="left:${rule.center[0]-95}px;top:${rule.center[1]-150}px;color:${rule.color}66">${rule.label}</div>`).join('');
      $('mapSvg').innerHTML=macroRules.map(rule=>`<circle class="contour" cx="${rule.center[0]}" cy="${rule.center[1]}" r="185"/><circle class="contour" cx="${rule.center[0]}" cy="${rule.center[1]}" r="125"/>`).join('') + featured.map(item=>{const p=positions.get(item.rank_group_key);return `<path class="connection" d="M${p.macro.center[0]} ${p.macro.center[1]} Q ${(p.x+p.macro.center[0])/2+25} ${(p.y+p.macro.center[1])/2-20} ${p.x} ${p.y}"/>`}).join('');
      $('nodes').innerHTML=featured.map(item=>{const p=positions.get(item.rank_group_key);return `<button class="node" data-key="${esc(item.rank_group_key)}" data-domain="${esc(p.macro.id)}" style="left:${p.x-86}px;top:${p.y-34}px;--node-color:${p.macro.color};transform:scale(${Math.min(1.08,.84+item.model_count/80)})"><span class="coverage">${item.model_count}M</span><b>${esc(item.benchmark_name)}</b><small>${esc(item.domain.replaceAll('_',' '))} · ${esc(item.metric_name)}</small><span class="best">${esc(formatScore(item.best_score,item.score_unit))}</span></button>`}).join('');
      document.querySelectorAll('.node').forEach(node=>node.addEventListener('click',e=>{e.stopPropagation();selectBenchmark(node.dataset.key);}))
      renderMiniMap(); applyTransform();
    }

    function renderMiniMap(){
      $('miniMap').querySelectorAll('span').forEach(n=>n.remove());
      featured.forEach(item=>{const p=positions.get(item.rank_group_key);const dot=document.createElement('span');dot.style.left=`${p.x/1800*150}px`;dot.style.top=`${p.y/1100*94}px`;dot.style.background=p.macro.color;$('miniMap').appendChild(dot);});
    }

    function applyTransform(){
      $('world').style.transform=`translate(${state.x}px,${state.y}px) scale(${state.scale})`;
      $('resetView').textContent=`${Math.round(state.scale*100)}%`;
      const vp=$('viewport').getBoundingClientRect();const mini=$('miniViewport');mini.style.left=`${Math.max(0,-state.x/state.scale/1800*150)}px`;mini.style.top=`${Math.max(0,-state.y/state.scale/1100*94)}px`;mini.style.width=`${Math.min(150,vp.width/state.scale/1800*150)}px`;mini.style.height=`${Math.min(94,vp.height/state.scale/1100*94)}px`;
    }

    function fitView(){const vp=$('viewport').getBoundingClientRect();state.scale=Math.min(.82,Math.max(.42,Math.min(vp.width/1800,vp.height/1100)*1.34));state.x=(vp.width-1800*state.scale)/2;state.y=(vp.height-1100*state.scale)/2;applyTransform();}
    function zoom(delta,cx=$('viewport').clientWidth/2,cy=$('viewport').clientHeight/2){const old=state.scale;state.scale=Math.max(.35,Math.min(1.35,state.scale+delta));state.x=cx-(cx-state.x)*(state.scale/old);state.y=cy-(cy-state.y)*(state.scale/old);applyTransform();}

    function selectBenchmark(key){
      const item=catalog.find(x=>x.rank_group_key===key);const page=pages[key];if(!item||!page)return;state.selected=key;
      document.querySelectorAll('.node').forEach(n=>n.classList.toggle('selected',n.dataset.key===key));
      $('inspectorDomain').textContent=`Selected landmark / ${item.domain.replaceAll('_',' ')}`;$('inspectorTitle').textContent=item.benchmark_name;$('inspectorSub').textContent=`${item.metric_name} · ${item.score_unit||'score'} · ${item.comparability}`;$('modelCount').textContent=item.model_count;$('vendorCount').textContent=item.vendor_count;$('reportCount').textContent=item.report_count;$('metricLabel').textContent=`${item.metric_name} · ${item.score_unit}`;
      const rows=page.rows.slice(0,6);$('ranking').innerHTML=rows.map(row=>`<div class="rank-row" data-row="${row.rank}"><span class="num">${String(row.rank).padStart(2,'0')}</span><span><b>${esc(row.model_name)}</b><small>${esc(row.vendor)}</small></span><span class="score">${esc(formatScore(row.score,row.score_unit))}</span></div>`).join('')||'<p class="method">No reported rows.</p>';
      updateEvidence(rows[0]);$('inspector').classList.add('open');
      $('benchmarkLink').href=`/benchmarks/${slugify(item.rank_group_key)}/`;
      document.querySelectorAll('.rank-row').forEach((row,index)=>row.addEventListener('click',()=>updateEvidence(rows[index])));
      showToast(`${item.benchmark_name} · ${item.model_count} models`);
    }

    function updateEvidence(row){if(!row)return;$('methodNote').textContent=row.protocol_full||row.protocol_note||'No benchmark-specific method note was reported.';const badgeList=[row.comparability_label,...(row.protocol_badges||[])].filter(Boolean);$('badges').innerHTML=badgeList.map((b,i)=>`<span class="badge ${i===0?'red':''}">${esc(b)}</span>`).join('');$('sourceLocation').textContent=row.evidence_location||'source located';$('evidenceQuote').textContent=row.evidence_quote||'No short evidence quote available.';$('sourceLink').href=row.source_url||'#';}

    function applyFilters(){const q=state.query.toLowerCase();document.querySelectorAll('.node').forEach(node=>{const item=catalog.find(x=>x.rank_group_key===node.dataset.key);const domainOk=state.domain==='all'||node.dataset.domain===state.domain;const queryOk=!q||`${item.benchmark_name} ${item.domain} ${item.best_model}`.toLowerCase().includes(q);node.classList.toggle('hidden',!domainOk);node.classList.toggle('dimmed',domainOk&&!queryOk);});renderRegistry();renderMatrix();}

    function renderFilters(){$('filters').innerHTML=`<button class="filter active" data-domain="all">All</button>`+macroRules.map(r=>`<button class="filter" data-domain="${r.id}">${r.label}</button>`).join('');document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{state.domain=btn.dataset.domain;document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b===btn));applyFilters();}));}
    function filteredCatalog(){const q=state.query.toLowerCase();return catalog.filter(item=>(state.domain==='all'||getMacro(item.domain).id===state.domain)&&(!q||`${item.benchmark_name} ${item.domain} ${item.best_model}`.toLowerCase().includes(q)));}
    function renderRegistry(){$('registryBody').innerHTML=filteredCatalog().slice(0,100).map(item=>`<tr data-key="${esc(item.rank_group_key)}"><td><b>${esc(item.benchmark_name)}</b><small>${esc(item.metric_name)} · ${esc(item.score_unit)}</small></td><td>${esc(item.domain.replaceAll('_',' '))}</td><td>${item.model_count}</td><td>${item.vendor_count}</td><td class="score">${esc(formatScore(item.best_score,item.score_unit))}<small>${esc(item.best_model)}</small></td><td>${esc(item.protocol_badges||'—')}</td></tr>`).join('');document.querySelectorAll('#registryBody tr').forEach(row=>row.addEventListener('click',()=>selectBenchmark(row.dataset.key)));}

    function renderMatrix(){
      const items=filteredCatalog().slice(0,10);const modelCounts=new Map();items.forEach(item=>(pages[item.rank_group_key]?.rows||[]).forEach(r=>modelCounts.set(r.model_name,(modelCounts.get(r.model_name)||0)+1)));const models=[...modelCounts].sort((a,b)=>b[1]-a[1]).slice(0,7).map(x=>x[0]);
      $('matrixTable').innerHTML=`<thead><tr><th>Benchmark</th>${models.map(m=>`<th>${esc(m)}</th>`).join('')}</tr></thead><tbody>${items.map(item=>{const rows=pages[item.rank_group_key]?.rows||[];return `<tr><td><b>${esc(item.benchmark_name)}</b><small>${esc(item.metric_name)}</small></td>${models.map(model=>{const r=rows.find(x=>x.model_name===model);if(!r)return'<td class="cell empty">—</td>';const cls=r.rank<=2?'top':r.rank<=5?'mid':'low';return `<td class="cell ${cls}">${esc(formatScore(r.score,r.score_unit))}</td>`}).join('')}</tr>`}).join('')}</tbody>`;
    }

    function switchMode(mode){state.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.querySelectorAll('.view-panel').forEach(p=>p.classList.remove('active'));$(`${mode}Panel`).classList.add('active');if(mode==='map')setTimeout(fitView,0);}
    function showToast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1600);}

    const vp=$('viewport');vp.addEventListener('pointerdown',e=>{if(e.target.closest('.node'))return;state.drag=true;state.startX=e.clientX;state.startY=e.clientY;state.baseX=state.x;state.baseY=state.y;vp.setPointerCapture(e.pointerId);vp.classList.add('dragging')});vp.addEventListener('pointermove',e=>{if(!state.drag)return;state.x=state.baseX+e.clientX-state.startX;state.y=state.baseY+e.clientY-state.startY;applyTransform()});vp.addEventListener('pointerup',()=>{state.drag=false;vp.classList.remove('dragging')});vp.addEventListener('wheel',e=>{e.preventDefault();const r=vp.getBoundingClientRect();zoom(e.deltaY<0?.08:-.08,e.clientX-r.left,e.clientY-r.top)},{passive:false});
    $('zoomIn').addEventListener('click',()=>zoom(.1));$('zoomOut').addEventListener('click',()=>zoom(-.1));$('resetView').addEventListener('click',fitView);$('closeInspector').addEventListener('click',()=>$('inspector').classList.remove('open'));document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>switchMode(btn.dataset.mode)));$('search').addEventListener('input',e=>{state.query=e.target.value.trim();applyFilters()});document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus()}});window.addEventListener('resize',()=>state.mode==='map'&&fitView());

    $('railCount').textContent=`${data.summary.rows} ROWS · ${data.summary.models} MODELS · ${data.summary.benchmarks} BENCHMARKS`;
    renderFilters();renderMap();renderRegistry();renderMatrix();fitView();selectBenchmark(featured[0].rank_group_key);
    if (window.matchMedia('(max-width:1050px)').matches) $('inspector').classList.remove('open');
