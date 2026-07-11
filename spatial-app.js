const data = window.BENCHATLAS_DATA;
    const catalog = [...data.benchmark_catalog].sort((a,b)=>b.model_count-a.model_count || b.result_count-a.result_count);
    const pageCache = new Map();
    const loadPage = async key => {
      if (pageCache.has(key)) return pageCache.get(key);
      const request = fetch(`/data/benchmarks/${encodeURIComponent(key)}.json?v=lazy-1`)
        .then(response => {
          if (!response.ok) throw new Error(`Benchmark data request failed: ${response.status}`);
          return response.json();
        })
        .catch(error => {
          pageCache.delete(key);
          throw error;
        });
      pageCache.set(key, request);
      return request;
    };
    const macroRules = [
      {id:'reason',label:'Reasoning & Knowledge',color:'#27548a',center:[300,270],domains:['reasoning','math','general','general_capability']},
      {id:'code',label:'Coding & Software Engineering',color:'#0f766e',center:[900,270],domains:['coding']},
      {id:'agent',label:'Agents & Computer Use',color:'#a96812',center:[1520,270],domains:['agent','computer_use','business_simulation','healthcare_agent']},
      {id:'multi',label:'Multimodal & Perception',color:'#67528d',center:[300,800],domains:['multimodal','vision','video','document']},
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
    const subfieldRules = {
      reason:[['Mathematics',/aime|hmmt|imo|math|olympiad/i],['Knowledge',/gpqa|mmlu|supergpqa|knowledge|hle|humanity/i],['General reasoning',/.*/]],
      code:[['Software engineering',/swe|repo|patch|issue|deepswe/i],['Terminal & systems',/terminal|kernel|cuda|cyber|shell/i],['Code generation',/code|program|scicode|artificial analysis/i],['Repository reasoning',/.*/]],
      agent:[['Computer use',/osworld|computer|benchcad|android|browser/i],['Tools & MCP',/tool|mcp|api|function/i],['Web & search',/browse|search|web/i],['Workflows',/.*/]],
      multi:[['Visual reasoning',/mmmu|vision|image|chart|charxiv|visual/i],['Video',/video|tvbench|crossvid/i],['Documents',/document|doc|pdf|dude/i],['Spatial perception',/.*/]],
      language:[['Long context',/long|context|needle|mrcr|graphwalk|memory/i],['Multilingual',/multi|language|mmlu-prox|global/i],['Translation',/wmt|translation|xcomet/i],['Language understanding',/.*/]],
      expert:[['Health & biology',/health|medical|bio|gene|protein|virology/i],['Science & research',/science|research|frontier|chem|physics/i],['Cybersecurity',/cyber|exploit|security|ctf/i],['Professional work',/.*/]]
    };
    const getSubfield = item => {
      const macro=getMacro(item.domain);const text=`${item.benchmark_name} ${item.benchmark_family_id||''} ${item.domain}`;
      const match=(subfieldRules[macro.id]||[]).find(([,pattern])=>pattern.test(text));
      return {id:slugify(match?.[0]||'General'),label:match?.[0]||'General'};
    };
    const hash = value => [...value].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,2166136261);
    const slugify = value => String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'item';
    const selectFieldLandmarks = rule => {const familyCounts=new Map();const selected=[];for(const item of catalog){if(getMacro(item.domain).id!==rule.id)continue;const family=item.benchmark_family_id||item.rank_group_key;const count=familyCounts.get(family)||0;if(count>=2)continue;familyCounts.set(family,count+1);selected.push(item);if(selected.length===7)break;}return selected;};
    const featured = macroRules.flatMap(selectFieldLandmarks);
    const featuredPriority = new Map();
    macroRules.forEach(rule=>featured.filter(item=>getMacro(item.domain).id===rule.id).forEach((item,index)=>featuredPriority.set(item.rank_group_key,index<3?'core':'support')));
    const positions = new Map();
    let relationEdges = [];
    const initialHash = new URLSearchParams(location.hash.replace(/^#/,''));
    const initialMode = ['map','registry','matrix'].includes(initialHash.get('view'))?initialHash.get('view'):'map';
    const state = {scale:.72,x:40,y:18,drag:false,startX:0,startY:0,baseX:0,baseY:0,domain:initialHash.get('domain')||'all',safetyOnly:initialHash.get('safety')==='1',query:'',selected:null,mode:initialMode,activeVariants:[],activeItem:null,matrixModelIds:new Set((initialHash.get('models')||'').split(',').filter(Boolean)),initialProtocol:initialHash.get('protocol')||''};
    const $ = id => document.getElementById(id);
    const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const formatScore = (score,unit) => score == null || score === '' ? '—' : `${score}${unit==='%'?'%':''}`;
    function syncUrl(){const params=new URLSearchParams();if(state.selected)params.set('benchmark',state.selected);const protocol=$('comparisonSelect')?.value;if(state.selected&&protocol)params.set('protocol',protocol);if(state.mode!=='map')params.set('view',state.mode);if(state.domain!=='all')params.set('domain',state.domain);if(state.safetyOnly)params.set('safety','1');if(state.matrixModelIds.size)params.set('models',[...state.matrixModelIds].join(','));const hashValue=params.toString();history.replaceState(null,'',`${location.pathname}${location.search}${hashValue?`#${hashValue}`:''}`);}
    function prepareShareLink(){syncUrl();showToast('Share URL is ready in the address bar');}
    async function applyUrlState(){const params=new URLSearchParams(location.hash.replace(/^#/,''));const requestedMode=params.get('view');state.mode=['map','registry','matrix'].includes(requestedMode)?requestedMode:'map';const requestedDomain=params.get('domain');state.domain=macroRules.some(rule=>rule.id===requestedDomain)?requestedDomain:'all';state.safetyOnly=params.get('safety')==='1';state.matrixModelIds=new Set((params.get('models')||'').split(',').filter(Boolean));if($('domainSelect'))$('domainSelect').value=state.domain;if($('safetyToggle'))$('safetyToggle').checked=state.safetyOnly;const benchmark=params.get('benchmark');const hasBenchmark=catalog.some(item=>item.rank_group_key===benchmark);if(!hasBenchmark)state.selected=null;applyFilters();if(hasBenchmark&&!positions.has(benchmark)&&state.mode==='map')state.mode='registry';switchMode(state.mode);if(hasBenchmark)await selectBenchmark(benchmark,params.get('protocol')||'');else closeInspector(false);}
    const displayOverrides = {
      gpqa_diamond_score:'GPQA Diamond · Reported Score',gpqa_diamond_accuracy:'GPQA Diamond · Accuracy',
      mcp_atlas_score:'MCP Atlas · Reported Score',mcp_atlas_public_set_score:'MCP Atlas · Public Set',mcp_atlas_pass_at_1:'MCP Atlas · Pass@1',
      terminal_bench_2_1_score:'Terminal-Bench 2.1 · Reported Score',hmmt_2026_feb_score:'HMMT Feb. 2026',hmmt_feb_2026_score:'HMMT Feb. 2026 · Alternate Report',
      benchcad_score:'BenchCAD · Standard',benchcad_python_tool_score:'BenchCAD · Python Tool',deepswe_score:'DeepSWE · Official Pier',deepswe_v1_1_score:'DeepSWE v1.1'
    };
    const canonicalBase = name => String(name||'').replace(/^GPQA-Diamond$/i,'GPQA Diamond').replace(/^MCP-Atlas$/i,'MCP Atlas').replace(/^Terminal[ -]bench 2\.1$/i,'Terminal-Bench 2.1').replace(/^SWE-bench Verified$/i,'SWE-Bench Verified');
    const displayName = item => {if(displayOverrides[item.rank_group_key])return displayOverrides[item.rank_group_key];const base=canonicalBase(item.benchmark_name);const variant=String(item.benchmark_variant||'').trim();return variant&&!base.toLowerCase().includes(variant.toLowerCase())?`${base} · ${variant}`:base;};
    const numericScore = row => Number.parseFloat(row?.score);
    const groupRowsByModel = rows => {const grouped=new Map();rows.forEach(row=>{const key=row.model_id||String(row.model_name||'Unknown model').trim().toLowerCase();if(!grouped.has(key))grouped.set(key,{model_id:key,model_name:row.model_name,vendor:row.vendor,rows:[]});grouped.get(key).rows.push(row);});return [...grouped.values()].map(group=>{group.rows.sort((a,b)=>(numericScore(b)||-Infinity)-(numericScore(a)||-Infinity));group.best=group.rows[0];group.sources=new Set(group.rows.map(row=>row.source_report_id||row.source_url).filter(Boolean)).size;return group;}).sort((a,b)=>(numericScore(b.best)||-Infinity)-(numericScore(a.best)||-Infinity));};
    const comparisonGroupsForRows = rows => {const grouped=new Map();rows.forEach(row=>{const id=row.comparability_group_id||`legacy--${row.source_report_id||'unknown'}`;if(!grouped.has(id))grouped.set(id,{id,label:row.comparability_group_label||'Source-scoped reported setup',status:row.comparability_status||'source_scoped',rows:[]});grouped.get(id).rows.push(row);});return [...grouped.values()].map(group=>{group.modelGroups=groupRowsByModel(group.rows);return group;}).sort((a,b)=>(b.status==='strict')-(a.status==='strict')||b.modelGroups.length-a.modelGroups.length||b.rows.length-a.rows.length||a.label.localeCompare(b.label));};
    const largestComparableRows = rows => comparisonGroupsForRows(rows)[0]?.rows||[];
    const itemSearchText = item => `${displayName(item)} ${item.benchmark_name} ${item.domain} ${item.metric_name} ${(item.search_models||[]).join(' ')}`.toLowerCase();
    const protocolParts = value => {const labels='Reasoning|Dataset|Context|Temperature|Top p|Judge model|Judge|Harness|Runs|Timeout|Tools|Max tokens';const parts=String(value||'').split(/\s*\|\s*/).flatMap(part=>part.split(new RegExp(`;?\\s*(?=(?:${labels}):)`,'i'))).map(part=>part.trim()).filter(Boolean);const unique=[];parts.forEach(part=>{const body=part.replace(/^[^:]{1,26}:\s*/,'');const key=body.toLowerCase().replace(/\s+/g,' ');const existing=unique.findIndex(item=>item.key===key||(key.length>70&&item.key.includes(key))||(item.key.length>70&&key.includes(item.key)));if(existing<0)unique.push({key,text:part});else if(part.length>unique[existing].text.length)unique[existing]={key,text:part};});return unique.map(item=>item.text);};
    const methodLabel = text => {const match=text.match(/^([A-Za-z][A-Za-z /_-]{1,24}):\s*/);return match?match[1].replaceAll('_',' '):'Evaluation setup';};
    const methodHtml = value => {const parts=protocolParts(value);if(!parts.length)return '<p>No benchmark-specific method note was reported.</p>';return parts.map(part=>{const label=methodLabel(part);const body=label==='Evaluation setup'?part:part.replace(/^[^:]{1,26}:\s*/,'');return `<div class="method-block"><b>${esc(label)}</b><p>${esc(body)}</p></div>`;}).join('');};
    const methodSectionLabels = {evaluation_setup:'Evaluation setup',reasoning_configuration:'Reasoning configuration',agent_tool_scaffold:'Agent / tool scaffold',dataset_variant:'Dataset variant',runs_aggregation:'Runs and aggregation',source_caveat:'Source caveat'};
    const structuredMethodHtml = row => {const sections=row.method_sections||{};const blocks=Object.entries(methodSectionLabels).flatMap(([key,label])=>{const values=Array.isArray(sections[key])?sections[key].filter(Boolean):[];return values.length?[`<div class="method-block"><b>${esc(label)}</b>${values.map(value=>`<p>${esc(value)}</p>`).join('')}</div>`]:[];});return blocks.join('')||methodHtml(row.protocol_full||row.protocol_note);};
    const sourceLabel = row => {const url=String(row.source_url||'').split(/;\s*/)[0];try{return new URL(url).hostname.replace(/^www\./,'');}catch{return String(row.source_report_id||'reported source').split(/;\s*/)[0].replaceAll('_',' ');}};

    const subgroupSlots = count => ({
      1:[[0,0]],2:[[-160,0],[160,0]],3:[[-195,0],[0,0],[195,0]],
      4:[[-155,-105],[155,-105],[-155,110],[155,110]]
    }[Math.min(4,count)]||[[0,0]]);
    function positionNodes(){
      positions.clear();
      const groups = new Map(macroRules.map(r=>[r.id,[]]));
      featured.forEach(item=>groups.get(getMacro(item.domain).id).push(item));
      groups.forEach((items,id)=>{
        const rule=macroRules.find(r=>r.id===id);const subgroups=new Map();
        items.forEach(item=>{const subfield=getSubfield(item);if(!subgroups.has(subfield.id))subgroups.set(subfield.id,{...subfield,items:[]});subgroups.get(subfield.id).items.push(item);});
        const entries=[...subgroups.values()].slice(0,4);const slots=subgroupSlots(entries.length);
        entries.forEach((group,groupIndex)=>{const [offsetX,offsetY]=slots[groupIndex];const anchor={x:rule.center[0]+offsetX,y:rule.center[1]+offsetY};const spacing=entries.length===4?78:92;
          group.items.forEach((item,index)=>{const jitterX=(hash(item.rank_group_key)%5)-2;const jitterY=(hash(item.benchmark_name)%3)-1;positions.set(item.rank_group_key,{x:anchor.x+jitterX,y:anchor.y+(index-(group.items.length-1)/2)*spacing+jitterY,macro:rule,subfield:group,subfieldAnchor:anchor,layoutSpacing:spacing});});
        });
      });
    }

    const modelOverlap = (a,b) => {const left=new Set(a.search_models||[]),right=new Set(b.search_models||[]);let shared=0;left.forEach(model=>{if(right.has(model))shared+=1;});return {shared,ratio:shared/Math.max(1,Math.min(left.size,right.size))};};
    function buildRelationEdges(){
      const familyEdges=[];const candidates=[];
      for(let i=0;i<featured.length;i+=1)for(let j=i+1;j<featured.length;j+=1){const a=featured[i],b=featured[j];
        if(a.benchmark_family_id&&a.benchmark_family_id===b.benchmark_family_id){familyEdges.push({from:a.rank_group_key,to:b.rank_group_key,type:'family',label:'Same benchmark family'});continue;}
        const overlap=modelOverlap(a,b);if(overlap.shared>=4&&overlap.ratio>=.55)candidates.push({from:a.rank_group_key,to:b.rank_group_key,type:'overlap',label:`${overlap.shared} shared models`,score:overlap.ratio+overlap.shared/100});
      }
      const degree=new Map();const overlapEdges=[];candidates.sort((a,b)=>b.score-a.score).forEach(edge=>{if((degree.get(edge.from)||0)>=1||(degree.get(edge.to)||0)>=1)return;degree.set(edge.from,1);degree.set(edge.to,1);overlapEdges.push(edge);});
      relationEdges=[...familyEdges,...overlapEdges];
    }

    function renderMap(){
      positionNodes();
      buildRelationEdges();
      const subfieldLabels=[];const seenSubfields=new Set();positions.forEach(p=>{const key=`${p.macro.id}:${p.subfield.id}`;if(seenSubfields.has(key))return;seenSubfields.add(key);const labelY=p.subfieldAnchor.y-((p.subfield.items.length-1)/2)*p.layoutSpacing-64;subfieldLabels.push(`<div class="subfield-label" style="left:${p.subfieldAnchor.x-82}px;top:${labelY}px;color:${p.macro.color}">${esc(p.subfield.label)}</div>`);});
      $('clusterLabels').innerHTML=macroRules.map(rule=>`<div class="cluster-label" style="left:${rule.center[0]-220}px;top:${rule.center[1]-218}px;color:${rule.color}">${rule.label}</div>`).join('')+subfieldLabels.join('');
      const macroById=new Map(macroRules.map(rule=>[rule.id,rule]));
      const routePairs=[['reason','code'],['code','agent'],['multi','language'],['language','expert'],['reason','multi'],['code','language'],['agent','expert'],['code','multi'],['agent','language']];
      const globalRoutes=routePairs.map(([fromId,toId],index)=>{const from=macroById.get(fromId),to=macroById.get(toId);const bend=index%2===0?42:-42;const midX=(from.center[0]+to.center[0])/2;const midY=(from.center[1]+to.center[1])/2+bend;return `<path class="global-route" d="M${from.center[0]} ${from.center[1]} Q${midX} ${midY} ${to.center[0]} ${to.center[1]}"/>`;}).join('');
      const contours=macroRules.map(rule=>`<circle class="contour" cx="${rule.center[0]}" cy="${rule.center[1]}" r="190"/><circle class="contour" cx="${rule.center[0]}" cy="${rule.center[1]}" r="125"/><circle class="route-hub" cx="${rule.center[0]}" cy="${rule.center[1]}" r="8" fill="${rule.color}"/>`).join('');
      const subfieldAnchors=new Map();positions.forEach(p=>subfieldAnchors.set(`${p.macro.id}:${p.subfield.id}`,p));
      const macroRoutes=[...subfieldAnchors.values()].map(p=>`<path class="macro-route" style="stroke:${p.macro.color}88" d="M${p.macro.center[0]} ${p.macro.center[1]} Q ${(p.subfieldAnchor.x+p.macro.center[0])/2} ${(p.subfieldAnchor.y+p.macro.center[1])/2-18} ${p.subfieldAnchor.x} ${p.subfieldAnchor.y}"/>`).join('');
      const subfieldRoutes=featured.map(item=>{const p=positions.get(item.rank_group_key);return `<path class="connection subfield-route" data-route-key="${esc(item.rank_group_key)}" style="stroke:${p.macro.color}aa" d="M${p.subfieldAnchor.x} ${p.subfieldAnchor.y} Q ${(p.x+p.subfieldAnchor.x)/2+15} ${(p.y+p.subfieldAnchor.y)/2-10} ${p.x} ${p.y}"/>`}).join('');
      const semanticRoutes=relationEdges.map((edge,index)=>{const from=positions.get(edge.from),to=positions.get(edge.to);const midX=(from.x+to.x)/2,midY=(from.y+to.y)/2+(index%2?18:-18);return `<path class="semantic-edge ${edge.type}" data-from="${esc(edge.from)}" data-to="${esc(edge.to)}" d="M${from.x} ${from.y} Q${midX} ${midY} ${to.x} ${to.y}"/>`;}).join('');
      $('mapSvg').innerHTML=globalRoutes+contours+macroRoutes+subfieldRoutes+semanticRoutes;
      $('nodes').innerHTML=featured.map(item=>{const p=positions.get(item.rank_group_key);const risk=isSafety(item);return `<button class="node ${risk?'risk':''}" data-key="${esc(item.rank_group_key)}" data-domain="${esc(p.macro.id)}" data-risk="${risk}" data-tier="${featuredPriority.get(item.rank_group_key)}" style="left:${p.x-90}px;top:${p.y-35}px;--node-color:${p.macro.color};--node-scale:${Math.min(1.08,.84+item.model_count/80)}"><span class="coverage">${item.model_count} models</span><b>${esc(displayName(item))}</b><small>${esc(p.subfield.label)} · ${esc(item.metric_name)}</small><span class="best">${esc(formatScore(item.best_score,item.score_unit))}</span></button>`}).join('');
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
      const depth=state.scale<.58?'overview':state.scale<.95?'field':'detail';const viewport=$('viewport');viewport.classList.remove('zoom-overview','zoom-field','zoom-detail');viewport.classList.add(`zoom-${depth}`);$('mapDepth').textContent=`${depth} level`;
      $('resetView').textContent=zoomLabel;
      $('statusZoom').textContent=zoomLabel;
      const vp=$('viewport').getBoundingClientRect();const mini=$('miniViewport');mini.style.left=`${Math.max(0,-state.x/state.scale/1800*150)}px`;mini.style.top=`${Math.max(0,-state.y/state.scale/1100*94)}px`;mini.style.width=`${Math.min(150,vp.width/state.scale/1800*150)}px`;mini.style.height=`${Math.min(94,vp.height/state.scale/1100*94)}px`;
    }

    function fitView(){const vp=$('viewport').getBoundingClientRect();state.scale=Math.min(.82,Math.max(.4,Math.min(vp.width/1800,vp.height/1100)*.96));state.x=(vp.width-1800*state.scale)/2;state.y=(vp.height-1100*state.scale)/2;applyTransform();}
    function zoom(delta,cx=$('viewport').clientWidth/2,cy=$('viewport').clientHeight/2){const old=state.scale;state.scale=Math.max(.35,Math.min(1.35,state.scale+delta));state.x=cx-(cx-state.x)*(state.scale/old);state.y=cy-(cy-state.y)*(state.scale/old);applyTransform();}
    function centerOn(key){const p=positions.get(key);if(!p)return;const vp=$('viewport').getBoundingClientRect();state.scale=Math.max(state.scale,.76);state.x=vp.width/2-p.x*state.scale;state.y=vp.height/2-p.y*state.scale;applyTransform();}

    function setInspectorOpen(open){$('app').classList.toggle('inspector-open',open);$('inspector').classList.toggle('open',open);$('inspector').setAttribute('aria-hidden',String(!open));if(state.mode==='map')setTimeout(fitView,0);}
    function closeInspector(updateUrl=true){state.selected=null;state.activeItem=null;state.activeVariants=[];document.querySelectorAll('.node').forEach(node=>node.classList.remove('selected','related','context-muted'));document.querySelectorAll('.connection').forEach(route=>route.classList.remove('selected'));document.querySelectorAll('.semantic-edge').forEach(edge=>edge.classList.remove('selected','muted'));$('statusSelection').textContent='No landmark selected';$('statusDomain').textContent=state.domain==='all'?'All domains':macroRules.find(rule=>rule.id===state.domain)?.label||'All domains';setInspectorOpen(false);if(updateUrl)syncUrl();}

    function highlightRelations(key){
      const related=new Set();relationEdges.forEach(edge=>{if(edge.from===key)related.add(edge.to);if(edge.to===key)related.add(edge.from);});
      document.querySelectorAll('.semantic-edge').forEach(edge=>{const active=edge.dataset.from===key||edge.dataset.to===key;edge.classList.toggle('selected',active);edge.classList.toggle('muted',!active);});
      document.querySelectorAll('.node').forEach(node=>{node.classList.toggle('related',related.has(node.dataset.key));node.classList.toggle('context-muted',node.dataset.key!==key&&!related.has(node.dataset.key));});
      return related;
    }

    async function selectBenchmark(key,preferredProtocolId){
      const item=catalog.find(x=>x.rank_group_key===key);if(!item)return;state.selected=key;state.activeItem=item;
      setInspectorOpen(true);$('inspectorTitle').textContent=displayName(item);$('inspectorSub').textContent='Loading benchmark details…';$('ranking').innerHTML='<p class="method">Loading reported scores…</p>';
      let page;
      try{page=await loadPage(key);}catch(error){if(state.selected!==key)return;$('inspectorSub').textContent='Benchmark details could not be loaded.';$('ranking').innerHTML='<p class="method">Refresh the page to retry this benchmark.</p>';showToast('Could not load benchmark details');return;}if(state.selected!==key)return;
      document.querySelectorAll('.node').forEach(n=>n.classList.toggle('selected',n.dataset.key===key));
      document.querySelectorAll('.connection').forEach(route=>route.classList.toggle('selected',route.dataset.routeKey===key));
      const related=highlightRelations(key);const groupedRows=groupRowsByModel(page.rows);const comparisonGroups=comparisonGroupsForRows(page.rows);const macro=getMacro(item.domain);const subfield=getSubfield(item);
      $('inspectorDomain').textContent=`${macro.label} / ${subfield.label}`;$('inspectorTitle').textContent=displayName(item);$('inspectorSub').textContent=`${item.domain.replaceAll('_',' ')} · ${item.metric_name} ${item.score_unit||''} · ${page.rows.length} reported rows · ${comparisonGroups.length} protocol groups`;$('modelCount').textContent=groupedRows.length;$('vendorCount').textContent=item.vendor_count;$('reportCount').textContent=item.report_count;$('metricLabel').textContent=`${item.metric_name} · ${item.score_unit}`;
      $('relatedLandmarks').innerHTML=[...related].map(relatedKey=>{const relatedItem=catalog.find(entry=>entry.rank_group_key===relatedKey);const edge=relationEdges.find(entry=>(entry.from===key&&entry.to===relatedKey)||(entry.to===key&&entry.from===relatedKey));return `<button data-key="${esc(relatedKey)}"><b>${esc(displayName(relatedItem))}</b><span>${esc(edge.label)}</span></button>`;}).join('')||'<span class="related-empty">No direct map relation in the current landmark set.</span>';
      $('relatedLandmarks').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{selectBenchmark(button.dataset.key);centerOn(button.dataset.key);}));
      $('statusDomain').textContent=state.domain==='all'?macro.label:macroRules.find(rule=>rule.id===state.domain)?.label||'All domains';$('statusSelection').textContent=displayName(item);
      $('comparisonSelect').innerHTML=comparisonGroups.map((group,index)=>`<option value="${esc(group.id)}">${index===0?'Preferred group · ':''}${group.modelGroups.length} model${group.modelGroups.length===1?'':'s'} · ${esc(group.label)}</option>`).join('');
      const renderComparison=(groupId,preferredModelId)=>{
        const comparison=comparisonGroups.find(group=>group.id===groupId)||comparisonGroups[0];if(!comparison){$('ranking').innerHTML='<p class="method">No reported rows.</p>';return;}
        $('comparisonSelect').value=comparison.id;$('comparisonSummary').textContent=`${comparison.modelGroups.length} models · ${comparison.rows.length} reported rows · ${comparison.status==='strict'?'documented shared setup':'source-scoped setup'}`;
        const groups=comparison.modelGroups.slice(0,8);
        $('ranking').innerHTML=groups.map((group,index)=>{const allModelRows=page.rows.filter(row=>(row.model_id||row.model_name)===group.model_id);const setupCount=new Set(allModelRows.map(row=>row.comparability_group_id)).size;return `<div class="rank-row" data-group="${index}"><span class="num">${String(index+1).padStart(2,'0')}</span><span><b>${esc(group.model_name)}</b><small>${esc(group.vendor)}${setupCount>1?` · ${setupCount} reported setups`:group.rows.length>1?` · ${group.rows.length} source rows`:''}</small></span><span class="score">${esc(formatScore(group.best.score,group.best.score_unit))}</span></div>`;}).join('')||'<p class="method">No reported rows.</p>';
        const showGroup=index=>{
          const group=groups[index];if(!group)return;document.querySelectorAll('.rank-row').forEach(row=>row.classList.toggle('active',Number(row.dataset.group)===index));state.activeVariants=group.rows;$('variantPicker').style.display=group.rows.length?'block':'none';$('variantSelect').innerHTML=group.rows.map((row,rowIndex)=>`<option value="${rowIndex}">${esc(formatScore(row.score,row.score_unit))} · ${esc(sourceLabel(row))}${group.rows.length>1?` · source ${rowIndex+1}`:''}</option>`).join('');$('methodStatus').textContent=group.rows.length>1?`${group.rows.length} source rows`:'1 source row';updateEvidence(group.rows[0],item);
          const alternatives=page.rows.filter(row=>(row.model_id||row.model_name)===group.model_id&&row.comparability_group_id!==comparison.id);
          $('relatedReports').innerHTML=alternatives.slice(0,5).map(row=>`<button class="related-report" data-comparison="${esc(row.comparability_group_id)}" data-model="${esc(group.model_id)}"><b>Also reported · ${esc(sourceLabel(row))}</b><span>${esc(formatScore(row.score,row.score_unit))}</span><small>${esc(row.comparability_group_label||'Source-scoped reported setup')}</small></button>`).join('');
          document.querySelectorAll('.related-report').forEach(button=>button.addEventListener('click',()=>renderComparison(button.dataset.comparison,button.dataset.model)));
        };
        const initialIndex=Math.max(0,groups.findIndex(group=>group.model_id===preferredModelId));showGroup(initialIndex);document.querySelectorAll('.rank-row').forEach((row,index)=>row.addEventListener('click',()=>showGroup(index)));
      };
      $('comparisonSelect').onchange=event=>{renderComparison(event.target.value);syncUrl();};renderComparison(comparisonGroups.some(group=>group.id===preferredProtocolId)?preferredProtocolId:comparisonGroups[0]?.id);$('benchmarkLink').href=`/benchmarks/${slugify(item.rank_group_key)}/`;syncUrl();showToast(`${displayName(item)} · ${groupedRows.length} unique models`);
    }

    function updateEvidence(row,item){if(!row)return;$('methodNote').innerHTML=structuredMethodHtml(row);const comparisonBadge=row.comparability_status==='strict'?'shared protocol':'source scoped';const badgeList=[comparisonBadge,...(isSafety(item)?['safety layer']:[]),...(row.protocol_badges||[])].filter(Boolean);$('badges').innerHTML=[...new Set(badgeList)].map((b,i)=>`<span class="badge ${i===0||b==='safety layer'?'red':''}">${esc(b.replaceAll('_',' '))}</span>`).join('');$('sourceSummary').textContent=`Model vendor: ${row.vendor||'unknown'} · reported in: ${sourceLabel(row)} · ${comparisonBadge}`;$('sourceLocation').textContent=row.evidence_location||'source located';$('evidenceQuote').textContent=row.evidence_quote||'No short evidence quote available.';$('sourceLink').href=String(row.source_url||'#').split(/;\s*/)[0];}

    function applyFilters(){const q=state.query.toLowerCase();document.querySelectorAll('.node').forEach(node=>{const item=catalog.find(x=>x.rank_group_key===node.dataset.key);const domainOk=state.domain==='all'||node.dataset.domain===state.domain;const safetyOk=!state.safetyOnly||node.dataset.risk==='true';const queryOk=!q||itemSearchText(item).includes(q);node.classList.toggle('hidden',!domainOk||!safetyOk);node.classList.toggle('dimmed',domainOk&&safetyOk&&!queryOk);});const selectedItem=catalog.find(item=>item.rank_group_key===state.selected);const selectedMacro=selectedItem&&getMacro(selectedItem.domain);const filterMacro=macroRules.find(rule=>rule.id===state.domain);const baseLabel=filterMacro?.label||selectedMacro?.label||'All domains';$('statusDomain').textContent=state.safetyOnly?`${baseLabel} · Safety`:baseLabel;renderRegistry();if(state.mode==='matrix')renderMatrix();}

    function clearFilters(){state.domain='all';state.safetyOnly=false;state.query='';$('domainSelect').value='all';$('safetyToggle').checked=false;$('search').value='';closeSearch();applyFilters();syncUrl();}
    function renderFilters(){$('filters').innerHTML=`<div class="field-control"><label class="toolbar-label" for="domainSelect">Field</label><select id="domainSelect" aria-label="Benchmark field"><option value="all">All benchmark fields</option>${macroRules.map(r=>`<option value="${r.id}">${r.label}</option>`).join('')}</select></div><label class="safety-toggle"><input id="safetyToggle" type="checkbox"><span>Safety layer</span></label><button class="filter-reset" id="clearFilters" aria-label="Reset filters" title="Reset filters">↺</button>`;$('domainSelect').value=macroRules.some(rule=>rule.id===state.domain)?state.domain:'all';state.domain=$('domainSelect').value;$('safetyToggle').checked=state.safetyOnly;$('domainSelect').addEventListener('change',event=>{state.domain=event.target.value;applyFilters();syncUrl();});$('safetyToggle').addEventListener('change',event=>{state.safetyOnly=event.target.checked;applyFilters();syncUrl();});$('clearFilters').addEventListener('click',clearFilters);}
    function filteredCatalog(){const q=state.query.toLowerCase();return catalog.filter(item=>(state.domain==='all'||getMacro(item.domain).id===state.domain)&&(!state.safetyOnly||isSafety(item))&&(!q||itemSearchText(item).includes(q)));}
    function protocolChips(item){const badges=String(item.protocol_badges||'').split(';').map(x=>x.trim()).filter(Boolean);if(!badges.length)return'<span class="protocol-more">No protocol tags</span>';return `<div class="protocol-chips">${badges.slice(0,3).map(b=>`<span class="protocol-chip">${esc(b)}</span>`).join('')}${badges.length>3?`<span class="protocol-more">+${badges.length-3}</span>`:''}</div>`;}
    function renderRegistry(){$('registryBody').innerHTML=filteredCatalog().slice(0,100).map(item=>{const macro=getMacro(item.domain);return `<tr data-key="${esc(item.rank_group_key)}"><td><b>${esc(displayName(item))}</b><small>${esc(item.metric_name)} · ${esc(item.score_unit)}${item.benchmark_variant?` · ${esc(item.benchmark_variant)}`:''}</small></td><td>${esc(macro.label)}<small>${esc(item.domain.replaceAll('_',' '))}${isSafety(item)?' · safety':''}</small></td><td>${item.model_count}<small>unique labels</small></td><td>${item.vendor_count}</td><td class="score">${esc(formatScore(item.best_score,item.score_unit))}<small>${esc(item.best_model)}</small></td><td>${protocolChips(item)}</td></tr>`}).join('');document.querySelectorAll('#registryBody tr').forEach(row=>row.addEventListener('click',()=>selectBenchmark(row.dataset.key)));}

    async function renderMatrix(){
      const items=filteredCatalog().slice(0,10);
      const renderId=(state.matrixRenderId||0)+1;state.matrixRenderId=renderId;
      $('matrixBasis').textContent=`Loading ${items.length} benchmark groups…`;$('matrixTable').innerHTML='<tbody><tr><td>Loading comparable rows…</td></tr></tbody>';
      const loadedPages=await Promise.all(items.map(item=>loadPage(item.rank_group_key).catch(()=>null)));
      if(renderId!==state.matrixRenderId)return;
      const matrixPages=new Map(items.map((item,index)=>[item.rank_group_key,loadedPages[index]]));
      const modelCounts=new Map();
      items.forEach(item=>groupRowsByModel(largestComparableRows(matrixPages.get(item.rank_group_key)?.rows||[])).forEach(group=>{const current=modelCounts.get(group.model_id)||{count:0,name:group.model_name};current.count+=1;modelCounts.set(group.model_id,current);}));
      const availableModels=[...modelCounts.entries()].sort((a,b)=>b[1].count-a[1].count||a[1].name.localeCompare(b[1].name)).map(([id,value])=>({id,name:value.name,count:value.count}));
      const availableIds=new Set(availableModels.map(model=>model.id));for(const id of [...state.matrixModelIds])if(!availableIds.has(id))state.matrixModelIds.delete(id);
      if(!state.matrixModelIds.size)availableModels.slice(0,7).forEach(model=>state.matrixModelIds.add(model.id));
      const models=availableModels.filter(model=>state.matrixModelIds.has(model.id));
      $('matrixBasis').textContent=`${items.length} highest-coverage benchmarks · ${models.length} selected models · preferred documented protocol group`;
      $('matrixModelButton').textContent=`Models (${models.length})`;
      $('matrixModelMenu').innerHTML=`<div class="matrix-menu-head"><span>Select up to 12</span><button type="button" id="matrixTopModels">Reset top 7</button></div>${availableModels.map(model=>`<label class="matrix-model-option"><input type="checkbox" value="${esc(model.id)}" ${state.matrixModelIds.has(model.id)?'checked':''}><span>${esc(model.name)} · ${model.count}/${items.length}</span></label>`).join('')}`;
      $('matrixTable').innerHTML=`<thead><tr><th>Benchmark</th>${models.map(model=>`<th>${esc(model.name)}</th>`).join('')}</tr></thead><tbody>${items.map(item=>{const groups=groupRowsByModel(largestComparableRows(matrixPages.get(item.rank_group_key)?.rows||[]));return `<tr><td><b>${esc(displayName(item))}</b><small>${esc(item.metric_name)} · ${esc(item.score_unit)}</small></td>${models.map(model=>{const index=groups.findIndex(group=>group.model_id===model.id);if(index<0)return'<td class="cell empty">—</td>';const group=groups[index],r=group.best,cls=index<=1?'top':index<=4?'mid':'low';return `<td class="cell ${cls}" title="Selected documented comparison group">${esc(formatScore(r.score,r.score_unit))}</td>`}).join('')}</tr>`}).join('')}</tbody>`;
      $('matrixModelButton').onclick=event=>{event.stopPropagation();const open=$('matrixModelMenu').classList.toggle('open');$('matrixModelButton').setAttribute('aria-expanded',String(open));};
      $('matrixTopModels').onclick=()=>{state.matrixModelIds.clear();availableModels.slice(0,7).forEach(model=>state.matrixModelIds.add(model.id));renderMatrix();syncUrl();$('matrixModelMenu').classList.add('open');};
      $('matrixModelMenu').querySelectorAll('input').forEach(input=>input.addEventListener('change',event=>{if(event.target.checked&&state.matrixModelIds.size>=12){event.target.checked=false;showToast('Matrix supports up to 12 models');return;}if(event.target.checked)state.matrixModelIds.add(event.target.value);else state.matrixModelIds.delete(event.target.value);renderMatrix();syncUrl();$('matrixModelMenu').classList.add('open');}));
    }

    function closeSearch(){$('searchResults').classList.remove('open');$('search').setAttribute('aria-expanded','false');}
    function renderSearchResults(){const q=state.query.trim().toLowerCase();if(!q){closeSearch();return;}const allMatches=catalog.filter(item=>itemSearchText(item).includes(q));const matches=allMatches.slice(0,8);$('searchResults').innerHTML=matches.length?`${matches.map(item=>{const nameMatch=`${displayName(item)} ${item.benchmark_name}`.toLowerCase().includes(q);return `<button class="search-result" role="option" data-key="${esc(item.rank_group_key)}"><span><b>${esc(displayName(item))}</b><small>${esc(getMacro(item.domain).label)} · ${item.model_count} models</small></span><em>${nameMatch?'benchmark':'model match'}</em></button>`;}).join('')}<div class="search-count">${allMatches.length} match${allMatches.length===1?'':'es'}${allMatches.length>8?' · showing first 8':''}</div>`:`<div class="search-empty">No benchmark or model matches “${esc(state.query)}”.</div>`;$('searchResults').classList.add('open');$('search').setAttribute('aria-expanded','true');document.querySelectorAll('.search-result').forEach(button=>button.addEventListener('click',()=>openSearchResult(button.dataset.key)));}
    function openSearchResult(key){const item=catalog.find(entry=>entry.rank_group_key===key);if(!item)return;state.domain='all';state.safetyOnly=false;$('domainSelect').value='all';$('safetyToggle').checked=false;closeSearch();selectBenchmark(key);if(positions.has(key)){state.query='';$('search').value='';applyFilters();switchMode('map');setTimeout(()=>centerOn(key),0);}else{state.query=displayName(item);$('search').value=displayName(item);applyFilters();switchMode('registry');showToast('Opened in Registry · not one of the 42 map landmarks');}}

    function switchMode(mode){state.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.querySelectorAll('.view-panel').forEach(p=>p.classList.remove('active'));$(`${mode}Panel`).classList.add('active');if(mode==='map')setTimeout(fitView,0);if(mode==='matrix')renderMatrix();syncUrl();}
    function showToast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1600);}

    const vp=$('viewport');vp.addEventListener('pointerdown',e=>{if(e.target.closest('.node'))return;state.drag=true;state.startX=e.clientX;state.startY=e.clientY;state.baseX=state.x;state.baseY=state.y;vp.setPointerCapture(e.pointerId);vp.classList.add('dragging')});vp.addEventListener('pointermove',e=>{if(!state.drag)return;state.x=state.baseX+e.clientX-state.startX;state.y=state.baseY+e.clientY-state.startY;applyTransform()});vp.addEventListener('pointerup',()=>{state.drag=false;vp.classList.remove('dragging')});vp.addEventListener('wheel',e=>{e.preventDefault();const r=vp.getBoundingClientRect();zoom(e.deltaY<0?.08:-.08,e.clientX-r.left,e.clientY-r.top)},{passive:false});
    $('zoomIn').addEventListener('click',()=>zoom(.1));$('zoomOut').addEventListener('click',()=>zoom(-.1));$('resetView').addEventListener('click',fitView);$('shareView').addEventListener('click',prepareShareLink);$('closeInspector').addEventListener('click',()=>closeInspector());document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>switchMode(btn.dataset.mode)));$('variantSelect').addEventListener('change',event=>updateEvidence(state.activeVariants[Number(event.target.value)],state.activeItem));$('search').addEventListener('input',e=>{state.query=e.target.value.trim();applyFilters();renderSearchResults();});$('search').addEventListener('keydown',event=>{if(event.key==='Enter'){const first=$('searchResults').querySelector('.search-result');if(first){event.preventDefault();openSearchResult(first.dataset.key);}}if(event.key==='Escape')closeSearch();});document.addEventListener('click',event=>{if(!event.target.closest('.search-wrap'))closeSearch();if(!event.target.closest('.matrix-controls')){$('matrixModelMenu').classList.remove('open');$('matrixModelButton').setAttribute('aria-expanded','false');}});document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus();$('search').select();}});window.addEventListener('resize',()=>state.mode==='map'&&fitView());window.addEventListener('hashchange',applyUrlState);

    const formatCount=value=>Number(value||0).toLocaleString('en-US');
    $('railCount').textContent=`${data.summary.result_count} ROWS · ${data.summary.model_count} MODELS · ${data.summary.benchmark_group_count} BENCHMARKS`;
    $('headerReports').textContent=`${formatCount(data.summary.report_count)} source reports`;
    $('statusResults').textContent=`${formatCount(data.summary.result_count)} results`;
    $('statusModels').textContent=`${formatCount(data.summary.model_count)} models`;
    $('mapCoverage').textContent=`${featured.length} of ${formatCount(data.summary.benchmark_group_count)} landmarks shown`;
    renderFilters();renderMap();renderRegistry();fitView();
    const requestedBenchmark=initialHash.get('benchmark');const initialBenchmark=catalog.some(item=>item.rank_group_key===requestedBenchmark)?requestedBenchmark:null;
    if(initialBenchmark&&!positions.has(initialBenchmark)&&state.mode==='map')state.mode='registry';
    if(window.matchMedia('(max-width:650px)').matches&&!initialHash.has('view'))state.mode='registry';
    switchMode(state.mode);if(initialBenchmark)selectBenchmark(initialBenchmark,state.initialProtocol);else closeInspector(false);
