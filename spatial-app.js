    const data = window.BENCHATLAS_DATA;
    const i18n = window.BENCHATLAS_I18N || {zh:false,t:(english)=>english,route:path=>path};
    const t = i18n.t;
    const localRoute = i18n.route;
    const catalog = [...data.benchmark_catalog].sort((a,b)=>b.model_count-a.model_count || b.result_count-a.result_count);
    const modelCatalog = data.model_catalog || [];
    const modelById = new Map(modelCatalog.map(model=>[model.model_id,model]));
    const pageCache = new Map();
    const loadPage = async key => {
      if (pageCache.has(key)) return pageCache.get(key);
      const request = fetch(`/data/benchmarks/${encodeURIComponent(key)}.json?v=entities-1`)
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
    const macroVisuals = {
      reason:{color:'#27548a',center:[230,270]},code:{color:'#0f766e',center:[675,270]},agent:{color:'#a96812',center:[1125,270]},safety:{color:'#b42318',center:[1570,270]},
      multi:{color:'#67528d',center:[380,800]},language:{color:'#4f7d35',center:[900,800]},expert:{color:'#8b4b36',center:[1420,800]}
    };
    const legacyPrimaryDomains = [
      {id:'reason',label_en:'Reasoning & Knowledge',label_zh:'推理与知识'},
      {id:'code',label_en:'Coding & Software Engineering',label_zh:'编程与软件工程'},
      {id:'agent',label_en:'Agents & Computer Use',label_zh:'智能体与计算机使用'},
      {id:'multi',label_en:'Multimodal & Perception',label_zh:'多模态与感知'},
      {id:'language',label_en:'Language & Long Context',label_zh:'语言与长上下文'},
      {id:'expert',label_en:'Expert & Frontier Domains',label_zh:'专家与前沿领域'},
      {id:'safety',label_en:'Safety & Alignment',label_zh:'安全与对齐'}
    ];
    const taxonomyPrimaryDomains = data.taxonomy?.primary_domains?.length ? data.taxonomy.primary_domains : legacyPrimaryDomains;
    const macroRules = taxonomyPrimaryDomains.map(rule=>({
      id:rule.id,label:t(rule.label_en,rule.label_zh),...(macroVisuals[rule.id]||{color:'#52606d',center:[900,540]})
    }));
    const domainViewRules=[...macroRules];
    const legacyDomainGroups = {
      reason:new Set(['reasoning','math','general','general_capability','safety','safety_bias']),
      code:new Set(['coding']),
      agent:new Set(['agent','computer_use','business_simulation','healthcare_agent','computer_use_safety','agent_safety']),
      multi:new Set(['multimodal','multimodal_agent','vision','video','document','vision_safety']),
      language:new Set(['language','multilingual','long_context']),
      expert:new Set(['science','health','research','professional','expert_tasks','cybersecurity','security','self_improvement']),
      safety:new Set(['safety','safety_bias','computer_use_safety','agent_safety','vision_safety','health_safety','safety_health','bio_safety','cyber_safety'])
    };
    const legacyPrimaryDomain = item => Object.entries(legacyDomainGroups).find(([,domains])=>domains.has(item?.domain))?.[0]||'reason';
    const getMacro = item => macroRules.find(rule=>rule.id===(item?.primary_domain||legacyPrimaryDomain(item)))||macroRules.find(rule=>rule.id==='reason')||macroRules[0];
    const legacySafetyDomains = new Set(['safety','safety_bias','computer_use_safety','agent_safety','vision_safety','health_safety','safety_health','bio_safety','cyber_safety']);
    const isSafety = item => item?.evaluation_purpose==='safety_alignment'||(typeof item?.is_safety==='boolean' ? item.is_safety : legacySafetyDomains.has(item?.domain));
    const getSubfield = item => ({
      id:item.subfield||'general',label:t(item.subfield_label_en||'General',item.subfield_label_zh||'通用')
    });
    const matchesDomainView=(item,viewId)=>viewId==='all'||getMacro(item).id===viewId;
    const getViewSubfield=item=>getSubfield(item);
    const hash = value => [...value].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,2166136261);
    const slugify = value => String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'item';
    const mapFamilyKey = item => item.map_family_id||(/^HealthBench(?:\s|$)/i.test(item.benchmark_name||'')?'healthbench':item.benchmark_family_id)||item.rank_group_key;
    const preferredMapRepresentative = item => typeof item?.map_representative==='boolean' ? item.map_representative : /^HealthBench$/i.test(item?.benchmark_name||'');
    const mapTierLimits={field:7,detail:9,deep:10};
    const selectDomainFamilies = rule => {const families=new Map();for(const item of catalog){if(!matchesDomainView(item,rule.id))continue;const family=mapFamilyKey(item);const current=families.get(family);if(!current||preferredMapRepresentative(item)&&!preferredMapRepresentative(current))families.set(family,item);}return [...families.values()];};
    const selectFieldLandmarks = rule => selectDomainFamilies(rule).slice(0,mapTierLimits.deep);
    const globalFeatured = macroRules.flatMap(selectFieldLandmarks);
    const globalFeaturedByFamily = new Map(globalFeatured.map(item=>[mapFamilyKey(item),item]));
    let featured=[...globalFeatured];
    let featuredByFamily=new Map(globalFeaturedByFamily);
    let featuredPriority=new Map();
    let featuredLod=new Map();
    const mapRepresentativeFor = item => item?(featuredByFamily.get(mapFamilyKey(item))||globalFeaturedByFamily.get(mapFamilyKey(item))||null):null;
    const zoomBreakpoints={field:.9,detail:1.08,deep:1.24};
    const lodMinScale={field:zoomBreakpoints.field,detail:zoomBreakpoints.detail,deep:zoomBreakpoints.deep};
    const itemMinScale=item=>state?.domain!=='all'?.35:featuredPriority.get(item.rank_group_key)==='core'?.35:lodMinScale[featuredLod.get(item.rank_group_key)]||.58;
    const positions = new Map();
    let relationEdges = [];
    const initialHash = new URLSearchParams(location.hash.replace(/^#/,''));
    const initialMode = ['map','registry','matrix','ranking'].includes(initialHash.get('view'))?initialHash.get('view'):'map';
    const state = {scale:.72,x:40,y:18,drag:false,startX:0,startY:0,baseX:0,baseY:0,domain:initialHash.get('safety')==='1'?'safety':initialHash.get('domain')||'all',modelId:modelById.has(initialHash.get('model'))?initialHash.get('model'):'',query:'',selected:null,mode:initialMode,activeVariants:[],activeProtocol:'',activeItem:null,matrixModelIds:new Set((initialHash.get('models')||'').split(',').filter(Boolean)),initialProtocol:initialHash.get('protocol')||''};
    function configureMapItems(){const rule=domainViewRules.find(entry=>entry.id===state.domain);featured=rule?selectDomainFamilies(rule):[...globalFeatured];featuredByFamily=new Map(featured.map(item=>[mapFamilyKey(item),item]));featuredPriority=new Map();featuredLod=new Map();if(rule){const scores=new Map(featured.map(item=>[item.rank_group_key,landmarkCoreScore(item,featured)]));[...featured].sort((a,b)=>scores.get(b.rank_group_key)-scores.get(a.rank_group_key)).forEach((item,index)=>{featuredPriority.set(item.rank_group_key,index<6?'core':'support');featuredLod.set(item.rank_group_key,index<8?'field':index<24?'detail':'deep');});}else macroRules.forEach(entry=>featured.filter(item=>getMacro(item).id===entry.id).forEach((item,index)=>{featuredPriority.set(item.rank_group_key,index<3?'core':'support');featuredLod.set(item.rank_group_key,index<mapTierLimits.field?'field':index<mapTierLimits.detail?'detail':'deep');}));}
    const $ = id => document.getElementById(id);
    const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const formatScore = (score,unit) => score == null || score === '' ? '—' : `${score}${unit==='%'?'%':''}`;
    function syncUrl(){const params=new URLSearchParams();if(state.selected)params.set('benchmark',state.selected);if(state.selected&&state.activeProtocol)params.set('protocol',state.activeProtocol);if(state.mode!=='map')params.set('view',state.mode);if(state.domain!=='all')params.set('domain',state.domain);if(state.modelId)params.set('model',state.modelId);if(state.matrixModelIds.size)params.set('models',[...state.matrixModelIds].join(','));const hashValue=params.toString();history.replaceState(null,'',`${location.pathname}${location.search}${hashValue?`#${hashValue}`:''}`);}
    function prepareShareLink(){syncUrl();showToast(t('Share URL is ready in the address bar','当前页面链接已准备好，可从地址栏复制'));}
    async function applyUrlState(){const params=new URLSearchParams(location.hash.replace(/^#/,''));const requestedMode=params.get('view');state.mode=['map','registry','matrix','ranking'].includes(requestedMode)?requestedMode:'map';const previousDomain=state.domain;const requestedDomain=params.get('safety')==='1'?'safety':params.get('domain');state.domain=domainViewRules.some(rule=>rule.id===requestedDomain)?requestedDomain:'all';state.modelId=modelById.has(params.get('model'))?params.get('model'):'';state.matrixModelIds=new Set((params.get('models')||'').split(',').filter(Boolean));if($('domainSelect'))$('domainSelect').value=state.domain;if($('modelSelect'))$('modelSelect').value=state.modelId;if(previousDomain!==state.domain){renderMap();fitView();}const benchmark=params.get('benchmark');const benchmarkItem=catalog.find(item=>item.rank_group_key===benchmark);const hasBenchmark=Boolean(benchmarkItem);if(!hasBenchmark)state.selected=null;applyFilters();switchMode(state.mode);if(hasBenchmark&&state.mode!=='ranking')await selectBenchmark(benchmark,params.get('protocol')||benchmarkItem.model_scores?.[state.modelId]?.g||'',state.modelId);else if(!hasBenchmark)closeInspector(false);}
    const displayOverrides = {
      gpqa_diamond_score:'GPQA Diamond · Reported Score',gpqa_diamond_accuracy:'GPQA Diamond · Accuracy',
      mcp_atlas_score:'MCP Atlas · Reported Score',mcp_atlas_public_set_score:'MCP Atlas · Public Set',mcp_atlas_pass_at_1:'MCP Atlas · Pass@1',
      terminal_bench_2_1_score:'Terminal-Bench 2.1 · Reported Score',hmmt_2026_feb_score:'HMMT Feb. 2026',hmmt_feb_2026_score:'HMMT Feb. 2026 · Alternate Report',
      benchcad_score:'BenchCAD · Standard',benchcad_python_tool_score:'BenchCAD · Python Tool',deepswe_score:'DeepSWE · Official Pier',deepswe_v1_1_score:'DeepSWE v1.1'
    };
    const canonicalBase = name => String(name||'').replace(/^GPQA-Diamond$/i,'GPQA Diamond').replace(/^MCP-Atlas$/i,'MCP Atlas').replace(/^Terminal[ -]bench 2\.1$/i,'Terminal-Bench 2.1').replace(/^SWE-bench Verified$/i,'SWE-Bench Verified');
    const mapDisplayName = item => canonicalBase(item.benchmark_name);
    const displayName = item => {if(displayOverrides[item.rank_group_key])return displayOverrides[item.rank_group_key];const base=canonicalBase(item.benchmark_name);const variant=String(item.benchmark_variant||'').trim();return variant&&!base.toLowerCase().includes(variant.toLowerCase())?`${base} · ${variant}`:base;};
    const numericScore = row => Number.parseFloat(row?.score);
    const normalizedPublisher=value=>{const text=String(value||'').toLowerCase();if(text.includes('anthropic'))return'anthropic';if(text.includes('openai'))return'openai';if(text.includes('google')||text.includes('deepmind')||text.includes('gemini'))return'googledeepmind';if(text.includes('qwen'))return'qwen';if(text.includes('deepseek'))return'deepseek';if(text.includes('bytedance')||text.includes('bytedns')||text.includes('seed'))return'bytedanceseed';if(text.includes('moonshot')||text.includes('kimi'))return'moonshotkimi';if(text.includes('z.ai')||text.includes('zai')||text.includes('glm'))return'zai';if(text.includes('x.ai')||text.includes('xai')||text.includes('grok'))return'xai';return text.replace(/[^a-z0-9]/g,'');};
    const isFirstPartyRow=row=>normalizedPublisher(row.vendor)===normalizedPublisher(`${row.source_url||''} ${row.source_report_id||''}`);
    const isRankingEligible=row=>row.ranking_eligible!==false&&!['agent_system','baseline','checkpoint'].includes(row.entity_type);
    const groupRowsByModel = rows => {const grouped=new Map();rows.forEach(row=>{const eligible=isRankingEligible(row);const key=eligible?(row.base_model_id||row.model_id):(row.reported_model_id||row.model_id||String(row.model_name||'Reference entity').trim().toLowerCase());const name=eligible?(row.base_model_name||row.model_name):(row.reported_model_name||row.model_name);if(!grouped.has(key))grouped.set(key,{model_id:key,model_name:name,vendor:row.vendor,ranking_eligible:eligible,entity_type:row.entity_type||'model',rows:[]});grouped.get(key).rows.push(row);});return [...grouped.values()].map(group=>{group.rows.sort((a,b)=>Number(a.rank||Infinity)-Number(b.rank||Infinity)||Number(isFirstPartyRow(b))-Number(isFirstPartyRow(a))||String(a.source_report_id||a.source_url||'').localeCompare(String(b.source_report_id||b.source_url||'')));group.best=group.rows[0];group.sources=new Set(group.rows.map(row=>row.source_report_id||row.source_url).filter(Boolean)).size;return group;}).sort((a,b)=>Number(b.ranking_eligible)-Number(a.ranking_eligible)||Number(a.best.rank||Infinity)-Number(b.best.rank||Infinity));};
    const comparisonGroupsForRows = rows => {const grouped=new Map();rows.forEach(row=>{const id=row.comparability_group_id||`legacy--${row.source_report_id||'unknown'}`;if(!grouped.has(id))grouped.set(id,{id,label:row.comparability_group_label||'Source-scoped reported setup',status:row.comparability_status||'source_scoped',rows:[]});grouped.get(id).rows.push(row);});return [...grouped.values()].map(group=>{group.modelGroups=groupRowsByModel(group.rows);return group;}).sort((a,b)=>(b.status==='strict')-(a.status==='strict')||b.modelGroups.length-a.modelGroups.length||b.rows.length-a.rows.length||a.label.localeCompare(b.label));};
    const protocolColors=['#0f766e','#b45309','#6d4aa2','#27548a','#a64032','#4f7a36','#8a5a44','#52606d'];
    const protocolCode=index=>`${t('Comparison Group','可比组')} ${String.fromCharCode(65+index)}`;
    const largestComparableRows = rows => comparisonGroupsForRows(rows)[0]?.rows||[];
    const itemSearchText = item => `${displayName(item)} ${item.benchmark_name} ${item.domain} ${item.metric_name} ${(item.search_models||[]).join(' ')}`.toLowerCase();
    const selectedModel = () => modelById.get(state.modelId);
    const modelScore = item => state.modelId ? item.model_scores?.[state.modelId] : null;
    const protocolParts = value => {const labels='Reasoning|Dataset|Context|Temperature|Top p|Judge model|Judge|Harness|Runs|Timeout|Tools|Max tokens';const parts=String(value||'').split(/\s*\|\s*/).flatMap(part=>part.split(new RegExp(`;?\\s*(?=(?:${labels}):)`,'i'))).map(part=>part.trim()).filter(Boolean);const unique=[];parts.forEach(part=>{const body=part.replace(/^[^:]{1,26}:\s*/,'');const key=body.toLowerCase().replace(/\s+/g,' ');const existing=unique.findIndex(item=>item.key===key||(key.length>70&&item.key.includes(key))||(item.key.length>70&&key.includes(item.key)));if(existing<0)unique.push({key,text:part});else if(part.length>unique[existing].text.length)unique[existing]={key,text:part};});return unique.map(item=>item.text);};
    const methodLabel = text => {const match=text.match(/^([A-Za-z][A-Za-z /_-]{1,24}):\s*/);return match?match[1].replaceAll('_',' '):'Evaluation setup';};
    const methodHtml = value => {const parts=protocolParts(value);if(!parts.length)return `<p>${t('No benchmark-specific method note was reported.','报告中未提供该 Benchmark 的专门运行配置说明。')}</p>`;return parts.map(part=>{const label=methodLabel(part);const body=label==='Evaluation setup'?part:part.replace(/^[^:]{1,26}:\s*/,'');return `<div class="method-block"><b>${esc(label)}</b><p>${esc(body)}</p></div>`;}).join('');};
    const methodSectionLabels = {evaluation_setup:t('Evaluation setup','评测设置'),reasoning_configuration:t('Reasoning configuration','推理配置'),agent_tool_scaffold:t('Agent / tool scaffold','Agent 与工具框架'),dataset_variant:t('Dataset variant','数据集变体'),runs_aggregation:t('Runs and aggregation','运行次数与聚合'),source_caveat:t('Source caveat','来源限制')};
    const structuredMethodHtml = row => {const sections=row.method_sections||{};const blocks=Object.entries(methodSectionLabels).flatMap(([key,label])=>{const values=Array.isArray(sections[key])?sections[key].filter(Boolean):[];return values.length?[`<div class="method-block"><b>${esc(label)}</b>${values.map(value=>`<p>${esc(value)}</p>`).join('')}</div>`]:[];});return blocks.join('')||methodHtml(row.protocol_full||row.protocol_note);};
    const sourceLabel = row => {const url=String(row.source_url||'').split(/;\s*/)[0];try{return new URL(url).hostname.replace(/^www\./,'');}catch{return String(row.source_report_id||'reported source').split(/;\s*/)[0].replaceAll('_',' ');}};

    const protocolBadgeCount=item=>String(item.protocol_badges||'').split(';').map(value=>value.trim()).filter(Boolean).length;
    const normalizedSignal=(value,max)=>Math.log1p(Number(value)||0)/Math.max(1,Math.log1p(Number(max)||1));
    const landmarkCoreScore=(item,fieldItems)=>{
      const maxModels=Math.max(...fieldItems.map(entry=>entry.model_count||0),1);
      const maxReports=Math.max(...fieldItems.map(entry=>entry.report_count||0),1);
      const coverage=normalizedSignal(item.model_count,maxModels);
      const evidence=normalizedSignal(item.report_count,maxReports);
      const methodology=Math.min(1,protocolBadgeCount(item)/6);
      return .6*coverage+.25*evidence+.15*methodology;
    };
    const nodeFootprint=item=>{const expanded=featuredLod.get(item.rank_group_key)!=='field';return {width:expanded?116:202,height:expanded?64:Math.min(154,104+Math.max(0,Math.ceil(mapDisplayName(item).length/18)-2)*14)};};
    const overlaps=(candidate,placed)=>placed.some(entry=>Math.abs(candidate.x-entry.x)<(candidate.width+entry.width)/2&&Math.abs(candidate.y-entry.y)<(candidate.height+entry.height)/2);
    function positionGlobalNodes(){
      positions.clear();
      const groups = new Map(macroRules.map(r=>[r.id,[]]));
      featured.forEach(item=>groups.get(getMacro(item).id).push(item));
      const globalPlaced=[];
      const fieldGroups=new Map();
      groups.forEach((items,id)=>{const subgroups=new Map();items.forEach(item=>{const subfield=getSubfield(item);if(!subgroups.has(subfield.id))subgroups.set(subfield.id,{...subfield,items:[]});subgroups.get(subfield.id).items.push(item);});fieldGroups.set(id,{items,entries:[...subgroups.values()]});});
      ['field','detail','deep'].forEach(lod=>groups.forEach((items,id)=>{
        const rule=macroRules.find(r=>r.id===id);const entries=fieldGroups.get(id).entries;
        entries.forEach((group,groupIndex)=>{const baseAngle=-Math.PI/2+groupIndex*(Math.PI*2/entries.length);const anchor={x:rule.center[0]+Math.cos(baseAngle)*64,y:rule.center[1]+Math.sin(baseAngle)*64};const rawLabel={x:rule.center[0]+Math.cos(baseAngle)*252,y:rule.center[1]+Math.sin(baseAngle)*252};const labelAnchor={x:Math.max(92,Math.min(1708,rawLabel.x)),y:Math.max(24,Math.min(1070,rawLabel.y))};const tierItems=group.items.filter(item=>featuredLod.get(item.rank_group_key)===lod).sort((a,b)=>landmarkCoreScore(b,items)-landmarkCoreScore(a,items));
          tierItems.forEach((item,index)=>{const coreScore=landmarkCoreScore(item,items);const footprint=nodeFootprint(item);const semanticRadius=224-coreScore*116;const groupOffset=(index-(tierItems.length-1)/2)*.2;const attempts=[0,.14,-.14,.28,-.28,.42,-.42,.56,-.56,.7,-.7,.86,-.86,1.02,-1.02];let candidate;
            for(const radiusOffset of [0,28,56,84,112,140,180,220]){for(const angleOffset of attempts){const angle=baseAngle+groupOffset+angleOffset;const radius=Math.min(370,semanticRadius+radiusOffset);const x=Math.max(96,Math.min(1704,rule.center[0]+Math.cos(angle)*radius));const y=Math.max(72,Math.min(1028,rule.center[1]+Math.sin(angle)*radius));const next={x,y,...footprint};if(!overlaps(next,globalPlaced)){candidate=next;break;}}if(candidate)break;}
            if(!candidate){for(let scan=0;scan<48;scan+=1){const angle=baseAngle+scan*Math.PI/24;for(const radius of [150,190,230,270,310,350,390]){const next={x:Math.max(96,Math.min(1704,rule.center[0]+Math.cos(angle)*radius)),y:Math.max(72,Math.min(1028,rule.center[1]+Math.sin(angle)*radius)),...footprint};if(!overlaps(next,globalPlaced)){candidate=next;break;}}if(candidate)break;}}
            if(!candidate){outer:for(let y=72;y<=1028;y+=footprint.height+10){for(let x=96;x<=1704;x+=footprint.width+10){const next={x,y,...footprint};if(!overlaps(next,globalPlaced)){candidate=next;break outer;}}}}
            if(!candidate){const fallbackAngle=baseAngle+(index+1)*.17*(index%2?1:-1);const fallbackRadius=300+(index%3)*34;candidate={x:Math.max(96,Math.min(1704,rule.center[0]+Math.cos(fallbackAngle)*fallbackRadius)),y:Math.max(72,Math.min(1028,rule.center[1]+Math.sin(fallbackAngle)*fallbackRadius)),...footprint};}
            globalPlaced.push(candidate);positions.set(item.rank_group_key,{x:candidate.x,y:candidate.y,macro:rule,subfield:group,subfieldAnchor:anchor,subfieldLabelAnchor:labelAnchor,coreScore});});
        });
      }));
    }

    function positionFocusedNodes(){
      positions.clear();
      const rule=domainViewRules.find(entry=>entry.id===state.domain);if(!rule)return;
      const center=[900,550];const focusMacro={...rule,center};const groups=new Map();
      featured.forEach(item=>{const subfield=getViewSubfield(item,state.domain);if(!groups.has(subfield.id))groups.set(subfield.id,{...subfield,items:[]});groups.get(subfield.id).items.push(item);});
      const entries=[...groups.values()];const placed=[];
      entries.forEach((group,groupIndex)=>{
        const baseAngle=-Math.PI/2+groupIndex*(Math.PI*2/entries.length);const sectorWidth=Math.min(1.22,Math.PI*1.55/entries.length);const anchor={x:center[0]+Math.cos(baseAngle)*108,y:center[1]+Math.sin(baseAngle)*108};const labelAnchor={x:center[0]+Math.cos(baseAngle)*475,y:center[1]+Math.sin(baseAngle)*475};
        group.items.sort((a,b)=>landmarkCoreScore(b,featured)-landmarkCoreScore(a,featured)).forEach((item,index)=>{
          const coreScore=landmarkCoreScore(item,featured);const footprint={width:158,height:80};const rankRatio=group.items.length>1?index/(group.items.length-1):0;const semanticRadius=132+(1-coreScore)*290+rankRatio*58;const spread=(index%2?1:-1)*Math.ceil(index/2)*Math.min(.18,sectorWidth/Math.max(2,group.items.length/2));let candidate;
          for(const radiusOffset of [0,28,56,84,112,-24]){for(const angleOffset of [0,.08,-.08,.16,-.16,.24,-.24]){const angle=baseAngle+spread+angleOffset;const radius=Math.max(120,Math.min(490,semanticRadius+radiusOffset));const next={x:Math.max(100,Math.min(1700,center[0]+Math.cos(angle)*radius)),y:Math.max(76,Math.min(1024,center[1]+Math.sin(angle)*radius)),...footprint};if(!overlaps(next,placed)){candidate=next;break;}}if(candidate)break;}
          if(!candidate){for(let ring=150;ring<=510&&!candidate;ring+=34){for(let step=0;step<32;step+=1){const angle=baseAngle-sectorWidth/2+sectorWidth*(step/31);const next={x:Math.max(100,Math.min(1700,center[0]+Math.cos(angle)*ring)),y:Math.max(76,Math.min(1024,center[1]+Math.sin(angle)*ring)),...footprint};if(!overlaps(next,placed)){candidate=next;break;}}}}
          if(!candidate){const fallbackAngle=baseAngle+spread;candidate={x:center[0]+Math.cos(fallbackAngle)*Math.min(500,semanticRadius),y:center[1]+Math.sin(fallbackAngle)*Math.min(500,semanticRadius),...footprint};}placed.push(candidate);positions.set(item.rank_group_key,{x:candidate.x,y:candidate.y,macro:focusMacro,subfield:group,subfieldAnchor:anchor,subfieldLabelAnchor:labelAnchor,coreScore});
        });
      });
      const layout=[...positions.values()];
      for(let iteration=0;iteration<180;iteration+=1){let moved=false;for(let i=0;i<layout.length;i+=1)for(let j=i+1;j<layout.length;j+=1){const a=layout[i],b=layout[j],dx=b.x-a.x,dy=b.y-a.y;const overlapX=164-Math.abs(dx),overlapY=86-Math.abs(dy);if(overlapX<=0||overlapY<=0)continue;moved=true;const signX=dx===0?(i%2?1:-1):Math.sign(dx),signY=dy===0?(j%2?1:-1):Math.sign(dy);const weightA=Math.max(.12,1-a.coreScore),weightB=Math.max(.12,1-b.coreScore),total=weightA+weightB;if(overlapX/164<overlapY/86){const push=overlapX+3;a.x-=signX*push*(weightA/total);b.x+=signX*push*(weightB/total);}else{const push=overlapY+3;a.y-=signY*push*(weightA/total);b.y+=signY*push*(weightB/total);}a.x=Math.max(92,Math.min(1708,a.x));b.x=Math.max(92,Math.min(1708,b.x));a.y=Math.max(68,Math.min(1032,a.y));b.y=Math.max(68,Math.min(1032,b.y));}if(!moved)break;}
    }

    function positionNodes(){state.domain==='all'?positionGlobalNodes():positionFocusedNodes();}

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

    const edgeMinScale=edge=>Math.max(itemMinScale(featured.find(item=>item.rank_group_key===edge.from)),itemMinScale(featured.find(item=>item.rank_group_key===edge.to)));

    function renderMap(){
      configureMapItems();
      positionNodes();
      buildRelationEdges();
      const focusRule=domainViewRules.find(rule=>rule.id===state.domain);const focused=Boolean(focusRule);
      $('viewport').classList.toggle('domain-focus',focused);$('viewport').classList.remove('hub-engaged');$('focusBack').hidden=!focused;
      const subfieldLabels=[];const seenSubfields=new Set();positions.forEach(p=>{const key=`${p.macro.id}:${p.subfield.id}`;if(seenSubfields.has(key))return;seenSubfields.add(key);subfieldLabels.push(`<div class="subfield-label" style="left:${p.subfieldLabelAnchor.x-82}px;top:${p.subfieldLabelAnchor.y-8}px;color:${p.macro.color}">${esc(p.subfield.label)}</div>`);});
      $('clusterLabels').innerHTML=(focused?`<div class="cluster-label focused-title" style="left:676px;top:34px;color:${focusRule.color}">${esc(focusRule.label)}</div><button class="focus-hub-control" id="focusHub" style="left:900px;top:550px;--hub-color:${focusRule.color}" aria-label="${esc(t('Reveal more benchmarks','展开更多 Benchmark'))}" title="${esc(t('Click to reveal more benchmarks','点击展开更多 Benchmark'))}"></button>`:macroRules.map((rule,index)=>`<button class="cluster-label" data-focus-domain="${rule.id}" style="left:${rule.center[0]-220}px;top:${rule.center[1]-218}px;color:${rule.color}" title="${esc(t('Open complete field map','打开完整领域地图'))}">${esc(rule.label)}</button><button class="domain-hub-control" data-focus-domain="${rule.id}" style="left:${rule.center[0]}px;top:${rule.center[1]}px;--hub-color:${rule.color};--hub-delay:${index*.42}s" aria-label="${esc(t(`Open ${rule.label} map`,`打开${rule.label}地图`))}" title="${esc(t('Click to open the complete field map','点击打开该领域完整地图'))}"></button>`).join(''))+subfieldLabels.join('');
      const macroById=new Map(macroRules.map(rule=>[rule.id,rule]));
      const routePairs=[['reason','code'],['code','agent'],['agent','safety'],['multi','language'],['language','expert'],['reason','multi'],['code','language'],['agent','expert'],['safety','expert']];
      const globalRoutes=focused?'':routePairs.map(([fromId,toId],index)=>{const from=macroById.get(fromId),to=macroById.get(toId);const bend=index%2===0?42:-42;const midX=(from.center[0]+to.center[0])/2;const midY=(from.center[1]+to.center[1])/2+bend;return `<path class="global-route" d="M${from.center[0]} ${from.center[1]} Q${midX} ${midY} ${to.center[0]} ${to.center[1]}"/>`;}).join('');
      const contours=focused?`<circle class="contour focus-ring" cx="900" cy="550" r="150"/><circle class="contour focus-ring" cx="900" cy="550" r="300"/><circle class="contour focus-ring" cx="900" cy="550" r="450"/><circle class="route-hub" cx="900" cy="550" r="10" fill="${focusRule.color}"/>`:macroRules.map(rule=>`<circle class="contour" cx="${rule.center[0]}" cy="${rule.center[1]}" r="190"/><circle class="contour" cx="${rule.center[0]}" cy="${rule.center[1]}" r="125"/><circle class="route-hub" cx="${rule.center[0]}" cy="${rule.center[1]}" r="8" fill="${rule.color}"/>`).join('');
      const subfieldAnchors=new Map();positions.forEach(p=>subfieldAnchors.set(`${p.macro.id}:${p.subfield.id}`,p));
      const macroRoutes=[...subfieldAnchors.values()].map(p=>`<path class="macro-route" style="stroke:${p.macro.color}88" d="M${p.macro.center[0]} ${p.macro.center[1]} Q ${(p.subfieldAnchor.x+p.macro.center[0])/2} ${(p.subfieldAnchor.y+p.macro.center[1])/2-18} ${p.subfieldAnchor.x} ${p.subfieldAnchor.y}"/>`).join('');
      const subfieldRoutes=featured.map(item=>{const p=positions.get(item.rank_group_key);return `<path class="connection subfield-route" data-route-key="${esc(item.rank_group_key)}" data-min-scale="${itemMinScale(item)}" style="stroke:${p.macro.color}aa" d="M${p.subfieldAnchor.x} ${p.subfieldAnchor.y} Q ${(p.x+p.subfieldAnchor.x)/2+15} ${(p.y+p.subfieldAnchor.y)/2-10} ${p.x} ${p.y}"/>`}).join('');
      const semanticRoutes=relationEdges.map((edge,index)=>{const from=positions.get(edge.from),to=positions.get(edge.to);const midX=(from.x+to.x)/2,midY=(from.y+to.y)/2+(index%2?18:-18);return `<path class="semantic-edge ${edge.type}" data-min-scale="${edgeMinScale(edge)}" data-from="${esc(edge.from)}" data-to="${esc(edge.to)}" d="M${from.x} ${from.y} Q${midX} ${midY} ${to.x} ${to.y}"/>`;}).join('');
      $('mapSvg').innerHTML=globalRoutes+contours+macroRoutes+subfieldRoutes+semanticRoutes;
      $('nodes').innerHTML=featured.map(item=>{const p=positions.get(item.rank_group_key);const risk=isSafety(item);const lod=featuredLod.get(item.rank_group_key);const nodeScale=focused?1:lod==='field'?Math.min(1.08,.84+item.model_count/80):Math.min(.9,.72+item.model_count/100);return `<button class="node ${risk?'risk':''} ${lod!=='field'?'expanded-landmark':''} ${focused?'focus-node':''}" data-key="${esc(item.rank_group_key)}" data-domain="${esc(p.macro.id)}" data-risk="${risk}" data-tier="${featuredPriority.get(item.rank_group_key)}" data-lod="${lod}" data-min-scale="${itemMinScale(item)}" title="Landmark score ${Math.round(p.coreScore*100)} · closer to center means broader model coverage and stronger source evidence" style="left:${p.x}px;top:${p.y}px;--node-color:${p.macro.color};--node-scale:${nodeScale}"><span class="coverage">${item.model_count} ${t('models','模型')}</span><b>${esc(mapDisplayName(item))}</b><small>${esc(p.subfield.label)} · core ${Math.round(p.coreScore*100)}</small><span class="best">${esc(formatScore(item.best_score,item.score_unit))}</span></button>`}).join('');
      document.querySelectorAll('.node').forEach(node=>node.addEventListener('click',e=>{e.stopPropagation();const item=catalog.find(entry=>entry.rank_group_key===node.dataset.key);const score=modelScore(item);selectBenchmark(node.dataset.key,score?.g||'',state.modelId);}))
      document.querySelectorAll('[data-focus-domain]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();enterDomainFocus(button.dataset.focusDomain);}));
      $('focusHub')?.addEventListener('click',event=>{event.stopPropagation();drillIntoDomain();});
      renderMiniMap(); applyTransform();
    }

    function renderMiniMap(){
      $('miniMap').querySelectorAll('span').forEach(n=>n.remove());
      featured.forEach(item=>{const p=positions.get(item.rank_group_key);const dot=document.createElement('span');dot.dataset.minScale=String(itemMinScale(item));dot.style.left=`${p.x/1800*150}px`;dot.style.top=`${p.y/1100*94}px`;dot.style.background=p.macro.color;$('miniMap').appendChild(dot);});
    }

    function updateSemanticZoom(){
      document.querySelectorAll('[data-min-scale]').forEach(element=>element.classList.toggle('lod-hidden',state.scale+0.001<Number(element.dataset.minScale||0)));
      const visibleNodes=[...document.querySelectorAll('.node:not(.lod-hidden):not(.hidden)')];
      const focusRule=domainViewRules.find(rule=>rule.id===state.domain);$('mapCoverage').textContent=focusRule?`${visibleNodes.length} / ${featured.length} ${t('benchmark families in this field','个该领域 Benchmark 家族')}`:`${visibleNodes.length} / ${formatCount(data.summary.benchmark_group_count)} ${t('benchmarks shown','个 Benchmark 已显示')}`;
      const perField=state.scale<zoomBreakpoints.field?3:state.scale<zoomBreakpoints.detail?mapTierLimits.field:state.scale<zoomBreakpoints.deep?mapTierLimits.detail:mapTierLimits.deep;
      $('mapScopeLabel').textContent=focusRule?t('All families · center to frontier','全部家族 · 从核心到前沿'):t(`Top ${perField} per field`,`每个领域前 ${perField} 个`);
    }

    function applyTransform(){
      $('world').style.transform=`translate(${state.x}px,${state.y}px) scale(${state.scale})`;
      const zoomLabel=`${Math.round(state.scale*100)}%`;
      const depth=state.scale<zoomBreakpoints.field?'overview':state.scale<zoomBreakpoints.detail?'field':state.scale<zoomBreakpoints.deep?'detail':'deep';const viewport=$('viewport');viewport.classList.remove('zoom-overview','zoom-field','zoom-detail','zoom-deep');viewport.classList.add(`zoom-${depth}`);$('mapDepth').textContent=t(`${depth} level`,depth==='overview'?'概览层':depth==='field'?'领域层':depth==='detail'?'详情层':'深度层');
      updateSemanticZoom();
      $('resetView').textContent=zoomLabel;
      $('statusZoom').textContent=zoomLabel;
      const vp=$('viewport').getBoundingClientRect();const mini=$('miniViewport');mini.style.left=`${Math.max(0,-state.x/state.scale/1800*150)}px`;mini.style.top=`${Math.max(0,-state.y/state.scale/1100*94)}px`;mini.style.width=`${Math.min(150,vp.width/state.scale/1800*150)}px`;mini.style.height=`${Math.min(94,vp.height/state.scale/1100*94)}px`;
    }

    function fitView(){const vp=$('viewport').getBoundingClientRect();if(state.domain!=='all'&&positions.size){const points=[...positions.values()];const minX=Math.min(...points.map(p=>p.x))-190,maxX=Math.max(...points.map(p=>p.x))+190,minY=Math.min(...points.map(p=>p.y))-125,maxY=Math.max(...points.map(p=>p.y))+125;state.scale=Math.min(1.05,Math.max(.5,Math.min(vp.width/(maxX-minX),vp.height/(maxY-minY))*.9));state.x=(vp.width-(minX+maxX)*state.scale)/2;state.y=(vp.height-(minY+maxY)*state.scale)/2;}else{state.scale=Math.min(.82,Math.max(.4,Math.min(vp.width/1800,vp.height/1100)*.96));state.x=(vp.width-1800*state.scale)/2;state.y=(vp.height-1100*state.scale)/2;}applyTransform();}
    function zoom(delta,cx=$('viewport').clientWidth/2,cy=$('viewport').clientHeight/2){$('viewport').classList.add('hub-engaged');const old=state.scale;state.scale=Math.max(.35,Math.min(1.35,state.scale+delta));state.x=cx-(cx-state.x)*(state.scale/old);state.y=cy-(cy-state.y)*(state.scale/old);applyTransform();}
    function drillIntoDomain(){if(state.domain==='all')return;const viewport=$('viewport'),rect=viewport.getBoundingClientRect();viewport.classList.add('hub-engaged');state.scale=state.scale<.95?1:Math.min(1.25,state.scale+.16);state.x=rect.width/2-900*state.scale;state.y=rect.height/2-550*state.scale;applyTransform();showToast(t('More benchmarks revealed','已展开更多 Benchmark'));}
    function centerOn(key){const p=positions.get(key);if(!p)return;const item=featured.find(entry=>entry.rank_group_key===key);const vp=$('viewport').getBoundingClientRect();state.scale=Math.max(state.scale,item?itemMinScale(item)+.02:.76);state.x=vp.width/2-p.x*state.scale;state.y=vp.height/2-p.y*state.scale;applyTransform();}

    const defaultInspectorWidth=370;
    function inspectorWidthBounds(){return {min:320,max:Math.max(320,Math.min(window.innerWidth*.65,window.innerWidth-68-620))};}
    function setInspectorWidth(width,persist=false){const bounds=inspectorWidthBounds();const next=Math.round(Math.max(bounds.min,Math.min(bounds.max,Number(width)||defaultInspectorWidth)));$('app').style.setProperty('--inspector-width',`${next}px`);$('inspectorResizer').setAttribute('aria-valuenow',String(next));$('inspectorResizer').setAttribute('aria-valuemax',String(Math.round(bounds.max)));if(persist){try{localStorage.setItem('benchatlas-inspector-width',String(next));}catch{}}return next;}
    function restoreInspectorWidth(){let saved=defaultInspectorWidth;try{saved=Number(localStorage.getItem('benchatlas-inspector-width'))||defaultInspectorWidth;}catch{}setInspectorWidth(saved);}
    function setInspectorOpen(open){$('app').classList.toggle('inspector-open',open);$('inspector').classList.toggle('open',open);$('inspector').setAttribute('aria-hidden',String(!open));if(state.mode==='map')setTimeout(fitView,0);}
    function closeInspector(updateUrl=true){state.selected=null;state.activeItem=null;state.activeVariants=[];document.querySelectorAll('.node').forEach(node=>node.classList.remove('selected','related','context-muted'));document.querySelectorAll('.connection').forEach(route=>route.classList.remove('selected'));document.querySelectorAll('.semantic-edge').forEach(edge=>edge.classList.remove('selected','muted'));const model=selectedModel();$('statusSelection').textContent=model?`${catalog.filter(item=>item.model_scores?.[model.model_id]).length} reported benchmarks`:'No landmark selected';$('statusDomain').textContent=model?`${model.model_name} coverage`:state.domain==='all'?'All domains':domainViewRules.find(rule=>rule.id===state.domain)?.label||'All domains';setInspectorOpen(false);if(updateUrl)syncUrl();}

    function highlightRelations(key){
      const related=new Set();relationEdges.forEach(edge=>{if(edge.from===key)related.add(edge.to);if(edge.to===key)related.add(edge.from);});
      document.querySelectorAll('.semantic-edge').forEach(edge=>{const active=edge.dataset.from===key||edge.dataset.to===key;edge.classList.toggle('selected',active);edge.classList.toggle('muted',!active);});
      document.querySelectorAll('.node').forEach(node=>{node.classList.toggle('related',related.has(node.dataset.key));node.classList.toggle('context-muted',node.dataset.key!==key&&!related.has(node.dataset.key));});
      return related;
    }

    async function selectBenchmark(key,preferredProtocolId,preferredModelId){
      const item=catalog.find(x=>x.rank_group_key===key);if(!item)return;const mapItem=mapRepresentativeFor(item);const mapKey=mapItem?.rank_group_key||key;state.selected=key;state.activeItem=item;
      setInspectorOpen(true);$('inspectorTitle').textContent=displayName(item);$('inspectorSub').textContent=t('Loading benchmark details…','正在加载 Benchmark 详情…');$('ranking').innerHTML=`<p class="method">${t('Loading reported scores…','正在加载报分…')}</p>`;
      let page;
      try{page=await loadPage(key);}catch(error){if(state.selected!==key)return;$('inspectorSub').textContent='Benchmark details could not be loaded.';$('ranking').innerHTML='<p class="method">Refresh the page to retry this benchmark.</p>';showToast('Could not load benchmark details');return;}if(state.selected!==key)return;
      document.querySelectorAll('.node').forEach(n=>n.classList.toggle('selected',n.dataset.key===mapKey));
      document.querySelectorAll('.connection').forEach(route=>route.classList.toggle('selected',route.dataset.routeKey===mapKey));
      const related=highlightRelations(mapKey);const groupedRows=groupRowsByModel(page.rows);const comparisonGroups=comparisonGroupsForRows(page.rows);const macro=getMacro(item);const activeView=macro;const subfield=getViewSubfield(item);
      $('inspectorDomain').textContent=`${activeView.label} / ${subfield.label}`;$('inspectorTitle').textContent=displayName(item);$('inspectorSub').textContent=`${item.domain.replaceAll('_',' ')} · ${item.metric_name} ${item.score_unit||''} · ${page.rows.length} ${t('reported rows','条报分')} · ${comparisonGroups.length} ${t('comparison groups','个可比组')}`;$('modelCount').textContent=groupedRows.length;$('vendorCount').textContent=item.vendor_count;$('reportCount').textContent=item.report_count;$('metricLabel').textContent=`${item.metric_name} · ${item.score_unit}`;
      const familyItems=catalog.filter(entry=>mapFamilyKey(entry)===mapFamilyKey(item)&&entry.rank_group_key!==key);
      const familyKeys=new Set(familyItems.map(entry=>entry.rank_group_key));
      const familyButtons=familyItems.map(entry=>`<button data-key="${esc(entry.rank_group_key)}"><b>${esc(displayName(entry))}</b><span>${t('Benchmark family variant','同一 Benchmark 家族变体')}</span></button>`);
      const relationButtons=[...related].filter(relatedKey=>!familyKeys.has(relatedKey)).map(relatedKey=>{const relatedItem=catalog.find(entry=>entry.rank_group_key===relatedKey);const edge=relationEdges.find(entry=>(entry.from===mapKey&&entry.to===relatedKey)||(entry.to===mapKey&&entry.from===relatedKey));return `<button data-key="${esc(relatedKey)}"><b>${esc(displayName(relatedItem))}</b><span>${esc(edge.label)}</span></button>`;});
      $('relatedLandmarks').innerHTML=[...familyButtons,...relationButtons].join('')||`<span class="related-empty">${t('No direct map relation in the current landmark set.','当前地图节点中没有直接关联。')}</span>`;
      $('relatedLandmarks').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{const target=catalog.find(entry=>entry.rank_group_key===button.dataset.key);selectBenchmark(button.dataset.key);const representative=mapRepresentativeFor(target);if(representative)centerOn(representative.rank_group_key);}));
      $('statusDomain').textContent=state.domain==='all'?macro.label:domainViewRules.find(rule=>rule.id===state.domain)?.label||'All domains';$('statusSelection').textContent=displayName(item);
      const protocolMeta=new Map(comparisonGroups.map((group,index)=>[group.id,{index,color:protocolColors[index%protocolColors.length],code:protocolCode(index),group}]));
      $('protocolLegend').innerHTML=comparisonGroups.map((group,index)=>{const meta=protocolMeta.get(group.id);const source=sourceLabel(group.rows[0]);const detail=String(group.label||'').startsWith('Source-reported setup')?`${source} · ${t('reported setup','报告内配置')}`:`${group.label} · ${source}`;return `<div class="protocol-legend-item"><span class="protocol-swatch" style="--protocol-color:${meta.color}"></span><span><b>${esc(meta.code)}</b><small>${group.modelGroups.length} ${t('models','模型')} · ${esc(detail)}</small></span></div>`;}).join('');
      const groups=groupRowsByModel(page.rows);
      $('ranking').innerHTML=groups.map((group,index)=>{const bestMeta=protocolMeta.get(group.best.comparability_group_id)||{color:protocolColors[0],code:t('Unclassified','未分类')};const setupCount=new Set(group.rows.map(row=>row.comparability_group_id)).size;const configuration=group.best.model_configuration||'';const descriptor=group.ranking_eligible?(configuration?`${t('Best config','最佳配置')}: ${configuration}`:t('Standard configuration','标准配置')):`${String(group.entity_type||'reference').replaceAll('_',' ')} · ${t('reference only','仅作参考')}`;return `<div class="rank-row unified" data-group="${index}" style="--protocol-color:${bestMeta.color}"><span class="num">${group.ranking_eligible?String(index+1).padStart(2,'0'):'REF'}</span><span><b>${esc(group.model_name)}</b><small>${esc(group.vendor)} · ${esc(descriptor)}</small><span class="rank-protocol"><i style="--protocol-color:${bestMeta.color}"></i>${esc(bestMeta.code)}${setupCount>1?` · +${setupCount-1} ${t('other setup','其他配置')}`:''}</span></span><span class="score">${esc(formatScore(group.best.score,group.best.score_unit))}</span></div>`;}).join('')||`<p class="method">${t('No reported rows.','没有报分记录。')}</p>`;
      const showGroup=(index,requestedProtocol='')=>{
        const group=groups[index];if(!group)return;document.querySelectorAll('.rank-row').forEach(row=>row.classList.toggle('active',Number(row.dataset.group)===index));state.activeVariants=group.rows;const requestedIndex=Math.max(0,group.rows.findIndex(row=>row.comparability_group_id===requestedProtocol));$('variantPicker').style.display=group.rows.length?'block':'none';$('variantSelect').innerHTML=group.rows.map((row,rowIndex)=>{const configuration=row.model_configuration||t('Standard','标准配置');const meta=protocolMeta.get(row.comparability_group_id);return `<option value="${rowIndex}">${meta?`${esc(meta.code)} · `:''}${esc(formatScore(row.score,row.score_unit))} · ${esc(configuration)} · ${esc(sourceLabel(row))}${isFirstPartyRow(row)?t(' · official model vendor',' · 模型厂商官方来源'):''}</option>`;}).join('');$('variantSelect').value=String(requestedIndex);$('methodStatus').textContent=group.rows.length>1?`${group.rows.length} ${t('configuration/source rows','条配置或来源记录')}`:t('1 source row','1 条来源记录');state.activeProtocol=group.rows[requestedIndex]?.comparability_group_id||'';updateEvidence(group.rows[requestedIndex]||group.rows[0],item);$('relatedReports').innerHTML='';syncUrl();
      };
      const focusedModelId=preferredModelId||state.modelId;let initialIndex=focusedModelId?groups.findIndex(group=>group.model_id===focusedModelId):-1;if(initialIndex<0&&preferredProtocolId)initialIndex=groups.findIndex(group=>group.rows.some(row=>row.comparability_group_id===preferredProtocolId));showGroup(Math.max(0,initialIndex),preferredProtocolId);document.querySelectorAll('.rank-row').forEach((row,index)=>row.addEventListener('click',()=>showGroup(index)));
      $('benchmarkLink').href=localRoute(`/benchmarks/${slugify(item.rank_group_key)}/`);syncUrl();showToast(`${displayName(item)} · ${groupedRows.length} ${t('unique models','个模型')}`);
    }

    function updateEvidence(row,item){if(!row)return;$('methodNote').innerHTML=structuredMethodHtml(row);const comparisonBadge=row.comparability_status==='strict'?t('shared protocol','共享协议'):t('source scoped','来源限定');const entityBadge=String(row.entity_type||'model').replaceAll('_',' ');const badgeList=[comparisonBadge,entityBadge,...(isSafety(item)?[t('safety layer','安全评测')]:[]),...(row.protocol_badges||[])].filter(Boolean);$('badges').innerHTML=[...new Set(badgeList)].map((b,i)=>`<span class="badge ${i===0||b==='safety layer'||b==='安全评测'?'red':''}">${esc(b.replaceAll('_',' '))}</span>`).join('');const configuration=row.model_configuration?` · ${t('configuration','配置')}: ${row.model_configuration}`:'';$('sourceSummary').textContent=`${row.ranking_eligible===false?t('Reference entity','参考实体'):t('Base model','基础模型')}: ${row.base_model_name||row.model_name||t('unknown','未知')}${configuration} · ${t('reported in','报分来源')}: ${sourceLabel(row)} · ${comparisonBadge}`;$('sourceLocation').textContent=row.evidence_location||t('source located','已定位来源');$('evidenceQuote').textContent=row.evidence_quote||t('No short evidence quote available.','暂无简短证据摘录。');$('sourceLink').href=String(row.source_url||'#').split(/;\s*/)[0];}

    function updateMapModelMode(){const model=selectedModel();let featuredCoverage=0;document.querySelectorAll('.node').forEach(node=>{const item=catalog.find(entry=>entry.rank_group_key===node.dataset.key);const score=modelScore(item);const covered=!model||Boolean(score);if(model&&score)featuredCoverage+=1;node.classList.toggle('model-muted',!covered);node.classList.toggle('model-covered',Boolean(model&&score));node.querySelector('.best').textContent=model?(score?formatScore(score.s,score.u):'—'):formatScore(item.best_score,item.score_unit);node.querySelector('.coverage').textContent=model?(score?t('model score','模型分数'):t('not reported','未报分')):`${item.model_count} ${t('models','模型')}`;});const catalogCoverage=model?catalog.filter(item=>item.model_scores?.[model.model_id]).length:catalog.length;const domainCoverage=model?new Set(catalog.filter(item=>item.model_scores?.[model.model_id]).map(item=>getMacro(item).id)).size:macroRules.length;const focusRule=domainViewRules.find(rule=>rule.id===state.domain);$('viewport').classList.toggle('model-mode',Boolean(model));$('mapCoverage').textContent=model?`${featuredCoverage} / ${featured.length} ${t('map benchmarks','个地图 Benchmark')} · ${model.model_name}`:focusRule?`${featured.length} ${t('benchmark families in this field','个该领域 Benchmark 家族')}`:`${featured.length} / ${formatCount(data.summary.benchmark_group_count)} ${t('landmarks shown','个 Benchmark 已显示')}`;$('mapScopeLabel').textContent=model?`${catalogCoverage} ${t('catalog benchmarks','个目录 Benchmark')} · ${domainCoverage} ${t('fields','个领域')}`:focusRule?t('All families · center to frontier','全部家族 · 从核心到前沿'):t('Top 7 per field','每个领域前 7 个');$('registryScoreHeader').textContent=model?model.model_name:t('Best reported','最佳公开分数');}
    function applyFilters(){const q=state.query.toLowerCase();document.querySelectorAll('.node').forEach(node=>{const item=catalog.find(x=>x.rank_group_key===node.dataset.key);const domainOk=matchesDomainView(item,state.domain);const queryOk=!q||itemSearchText(item).includes(q);node.classList.toggle('hidden',!domainOk);node.classList.toggle('dimmed',domainOk&&!queryOk);});updateMapModelMode();const model=selectedModel();const selectedItem=catalog.find(item=>item.rank_group_key===state.selected);const selectedMacro=selectedItem&&getMacro(selectedItem);const filterRule=domainViewRules.find(rule=>rule.id===state.domain);const baseLabel=model?`${model.model_name} ${t('coverage','覆盖')}`:filterRule?.label||selectedMacro?.label||t('All domains','全部领域');$('statusDomain').textContent=baseLabel;if(model&&!state.selected)$('statusSelection').textContent=`${catalog.filter(item=>item.model_scores?.[model.model_id]).length} ${t('reported benchmarks','个已报分 Benchmark')}`;updateSemanticZoom();renderRegistry();if(state.mode==='matrix')renderMatrix();}

    function enterDomainFocus(domain,updateUrl=true){state.domain=domainViewRules.some(rule=>rule.id===domain)?domain:'all';if($('domainSelect'))$('domainSelect').value=state.domain;renderMap();applyFilters();fitView();if(updateUrl)syncUrl();const rule=domainViewRules.find(entry=>entry.id===state.domain);if(rule)showToast(`${rule.label} · ${featured.length} ${t('benchmark families','个 Benchmark 家族')}`);}
    function clearFilters(){state.modelId='';state.query='';$('modelSelect').value='';$('search').value='';closeSearch();enterDomainFocus('all',false);syncUrl();}
    function renderFilters(){const models=[...modelCatalog].sort((a,b)=>a.vendor.localeCompare(b.vendor)||a.model_name.localeCompare(b.model_name));$('filters').innerHTML=`<div class="field-control"><label class="toolbar-label" for="domainSelect">View</label><select id="domainSelect" aria-label="Benchmark capability field"><option value="all">All benchmark fields</option><optgroup label="Capability fields">${macroRules.map(r=>`<option value="${r.id}">${r.label}</option>`).join('')}</optgroup></select></div><div class="field-control model-control"><label class="toolbar-label" for="modelSelect">Model</label><select id="modelSelect" aria-label="Filter by model"><option value="">All models</option>${models.map(model=>`<option value="${esc(model.model_id)}">${esc(model.vendor)} · ${esc(model.model_name)}</option>`).join('')}</select></div><button class="filter-reset" id="clearFilters" aria-label="Reset filters" title="Reset filters">↺</button>`;$('domainSelect').value=domainViewRules.some(rule=>rule.id===state.domain)?state.domain:'all';state.domain=$('domainSelect').value;$('modelSelect').value=modelById.has(state.modelId)?state.modelId:'';state.modelId=$('modelSelect').value;$('domainSelect').addEventListener('change',event=>enterDomainFocus(event.target.value));$('modelSelect').addEventListener('change',event=>{state.modelId=event.target.value;const active=catalog.find(item=>item.rank_group_key===state.selected);const score=active&&modelScore(active);applyFilters();if(active&&score)selectBenchmark(active.rank_group_key,score.g,state.modelId);else if(active)closeInspector(false);syncUrl();if(state.modelId){const model=selectedModel();showToast(`${model.model_name} · ${catalog.filter(item=>item.model_scores?.[model.model_id]).length} reported benchmarks`);}});$('clearFilters').addEventListener('click',clearFilters);}
    function filteredCatalog(){const q=state.query.toLowerCase();return catalog.filter(item=>matchesDomainView(item,state.domain)&&(!state.modelId||Boolean(item.model_scores?.[state.modelId]))&&(!q||itemSearchText(item).includes(q)));}
    function protocolChips(item){const badges=String(item.protocol_badges||'').split(';').map(x=>x.trim()).filter(Boolean);if(!badges.length)return'<span class="protocol-more">No protocol tags</span>';return `<div class="protocol-chips">${badges.slice(0,3).map(b=>`<span class="protocol-chip">${esc(b)}</span>`).join('')}${badges.length>3?`<span class="protocol-more">+${badges.length-3}</span>`:''}</div>`;}
    function renderRegistry(){$('registryBody').innerHTML=filteredCatalog().slice(0,100).map(item=>{const macro=getMacro(item);const activeView=macro;const subfield=getViewSubfield(item);const score=modelScore(item);const model=selectedModel();const config=score?.n&&score.n!=='Standard'?` · ${score.n}`:'';return `<tr data-key="${esc(item.rank_group_key)}"><td><b>${esc(displayName(item))}</b><small>${esc(item.metric_name)} · ${esc(item.score_unit)}${item.benchmark_variant?` · ${esc(item.benchmark_variant)}`:''}</small></td><td>${esc(activeView.label)}<small>${esc(subfield.label)}</small></td><td>${item.model_count}<small>base models</small></td><td>${item.vendor_count}</td><td class="score">${esc(score?formatScore(score.s,score.u):formatScore(item.best_score,item.score_unit))}<small>${esc(model?.model_name||item.best_model)}${esc(config)}</small></td><td>${protocolChips(item)}</td></tr>`}).join('');document.querySelectorAll('#registryBody tr').forEach(row=>row.addEventListener('click',()=>{const item=catalog.find(entry=>entry.rank_group_key===row.dataset.key);const score=modelScore(item);selectBenchmark(row.dataset.key,score?.g||'',state.modelId);}));}

    let rankingPromise;
    function loadRankingData(){
      if(window.BENCHATLAS_DATA?.overall_data)return Promise.resolve(window.BENCHATLAS_DATA.overall_data);
      if(rankingPromise)return rankingPromise;
      rankingPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/data/pages/ranking.bundle.js?v=capability-ceiling-2';script.onload=()=>window.BENCHATLAS_DATA?.overall_data?resolve(window.BENCHATLAS_DATA.overall_data):reject(new Error('Ranking data missing'));script.onerror=()=>reject(new Error('Ranking data request failed'));document.head.appendChild(script);});
      return rankingPromise;
    }
    async function renderOverallRanking(){
      $('overallRankingBody').className='ranking-loading';$('overallRankingBody').textContent=t('Loading overall ranking…','正在加载整体排名…');
      try{const overall=await loadRankingData();const rankings=overall.rankings||[];$('rankingModelCount').textContent=rankings.length;$('rankingGroupCount').textContent=overall.benchmarkGroupCount||'—';
        $('overallRankingBody').className='';$('overallRankingBody').innerHTML=`<table class="overall-ranking"><thead><tr><th>${t('Rank','排名')}</th><th>${t('Base model','基础模型')}</th><th>${t('RPI ceiling','RPI 上限')}</th><th>${t('Coverage','覆盖')}</th><th>${t('Confidence','置信度')}</th></tr></thead><tbody>${rankings.map(row=>{const model=modelCatalog.find(item=>item.model_id===row.model_id);const path=model?localRoute(`/models/${encodeURIComponent(model.model_id)}/`):'#';const width=Math.max(0,Math.min(100,Number(row.index_score)||0));return `<tr data-path="${esc(path)}"><td class="overall-rank">${String(row.overall_rank).padStart(2,'0')}</td><td class="model-cell"><b>${esc(row.model_name)}</b><small>${esc(row.vendor)} · ${row.configuration_count||1} ${t('reported configurations','个公开配置')}</small></td><td class="rpi-cell"><div class="rpi-value"><span>${esc(row.index_score)}</span><small>RPI</small></div><div class="rpi-bar"><i style="width:${width}%"></i></div></td><td class="coverage-cell">${row.benchmark_count} Benchmarks<small>${row.domain_count} ${t('reported domains','个报分领域')} · raw ${row.raw_score}</small></td><td class="confidence-cell"><span class="confidence-pill">${esc(row.confidence)}</span><small>${row.report_count} ${t('source reports','份来源报告')}</small></td></tr>`;}).join('')}</tbody></table>`;
        $('overallRankingBody').querySelectorAll('tr[data-path]').forEach(row=>row.addEventListener('click',()=>{if(row.dataset.path!=='#')location.href=row.dataset.path;}));
      }catch(error){$('overallRankingBody').className='ranking-loading';$('overallRankingBody').textContent=t('Overall ranking could not be loaded. Refresh to retry.','整体排名加载失败，请刷新重试。');rankingPromise=null;}
    }

    async function renderMatrix(){
      const items=filteredCatalog().slice(0,10);
      const renderId=(state.matrixRenderId||0)+1;state.matrixRenderId=renderId;
      $('matrixBasis').textContent=t(`Loading ${items.length} benchmark groups…`,`正在加载 ${items.length} 个 Benchmark 分组…`);$('matrixTable').innerHTML=`<tbody><tr><td>${t('Loading comparable rows…','正在加载可比记录…')}</td></tr></tbody>`;
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
      $('matrixModelButton').textContent=`${t('Models','模型')} (${models.length})`;
      $('matrixModelMenu').innerHTML=`<div class="matrix-menu-head"><span>${t('Select up to 12','最多选择 12 个')}</span><button type="button" id="matrixTopModels">${t('Reset top 7','重置为前 7 个')}</button></div>${availableModels.map(model=>`<label class="matrix-model-option"><input type="checkbox" value="${esc(model.id)}" ${state.matrixModelIds.has(model.id)?'checked':''}><span>${esc(model.name)} · ${model.count}/${items.length}</span></label>`).join('')}`;
      $('matrixTable').innerHTML=`<thead><tr><th>Benchmark</th>${models.map(model=>`<th>${esc(model.name)}</th>`).join('')}</tr></thead><tbody>${items.map(item=>{const groups=groupRowsByModel(largestComparableRows(matrixPages.get(item.rank_group_key)?.rows||[]));return `<tr><td><b>${esc(displayName(item))}</b><small>${esc(item.metric_name)} · ${esc(item.score_unit)}</small></td>${models.map(model=>{const index=groups.findIndex(group=>group.model_id===model.id);if(index<0)return'<td class="cell empty">—</td>';const group=groups[index],r=group.best,cls=index<=1?'top':index<=4?'mid':'low';return `<td class="cell ${cls}" title="${t('Selected documented comparison group','已选择的文档化可比分组')}">${esc(formatScore(r.score,r.score_unit))}</td>`}).join('')}</tr>`}).join('')}</tbody>`;
      $('matrixModelButton').onclick=event=>{event.stopPropagation();const open=$('matrixModelMenu').classList.toggle('open');$('matrixModelButton').setAttribute('aria-expanded',String(open));};
      $('matrixTopModels').onclick=()=>{state.matrixModelIds.clear();availableModels.slice(0,7).forEach(model=>state.matrixModelIds.add(model.id));renderMatrix();syncUrl();$('matrixModelMenu').classList.add('open');};
      $('matrixModelMenu').querySelectorAll('input').forEach(input=>input.addEventListener('change',event=>{if(event.target.checked&&state.matrixModelIds.size>=12){event.target.checked=false;showToast('Matrix supports up to 12 models');return;}if(event.target.checked)state.matrixModelIds.add(event.target.value);else state.matrixModelIds.delete(event.target.value);renderMatrix();syncUrl();$('matrixModelMenu').classList.add('open');}));
    }

    function closeSearch(){$('searchResults').classList.remove('open');$('search').setAttribute('aria-expanded','false');}
    function renderSearchResults(){const q=state.query.trim().toLowerCase();if(!q){closeSearch();return;}const allMatches=catalog.filter(item=>itemSearchText(item).includes(q));const matches=allMatches.slice(0,8);$('searchResults').innerHTML=matches.length?`${matches.map(item=>{const nameMatch=`${displayName(item)} ${item.benchmark_name}`.toLowerCase().includes(q);return `<button class="search-result" role="option" data-key="${esc(item.rank_group_key)}"><span><b>${esc(displayName(item))}</b><small>${esc(getMacro(item).label)} · ${item.model_count} ${t('models','模型')}</small></span><em>${nameMatch?'benchmark':t('model match','匹配模型')}</em></button>`;}).join('')}<div class="search-count">${allMatches.length} ${t('matches','个匹配')}${allMatches.length>8?t(' · showing first 8',' · 显示前 8 个'):''}</div>`:`<div class="search-empty">${t('No benchmark or model matches','没有匹配的 Benchmark 或模型')} “${esc(state.query)}”。</div>`;$('searchResults').classList.add('open');$('search').setAttribute('aria-expanded','true');document.querySelectorAll('.search-result').forEach(button=>button.addEventListener('click',()=>openSearchResult(button.dataset.key)));}
    function openSearchResult(key){const item=catalog.find(entry=>entry.rank_group_key===key);if(!item)return;state.query='';$('search').value='';closeSearch();enterDomainFocus(getMacro(item).id,false);const representative=mapRepresentativeFor(item);switchMode('map');selectBenchmark(key);setTimeout(()=>centerOn((representative||item).rank_group_key),0);syncUrl();}

    function switchMode(mode){state.mode=mode;if(mode==='ranking')closeInspector(false);document.querySelector('.toolbar').classList.toggle('ranking-mode',mode==='ranking');$('mapNav').classList.toggle('active',mode!=='ranking');$('rankNav').classList.toggle('active',mode==='ranking');document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.querySelectorAll('.view-panel').forEach(p=>p.classList.remove('active'));$(`${mode}Panel`).classList.add('active');if(mode==='map')setTimeout(fitView,0);if(mode==='matrix')renderMatrix();if(mode==='ranking'){renderOverallRanking();$('statusDomain').textContent=t('Reported Performance Index','公开表现指数');$('statusSelection').textContent=t('Overall model ranking','模型整体排名');}else if(!state.selected){const model=selectedModel();$('statusDomain').textContent=model?`${model.model_name} ${t('coverage','覆盖')}`:state.domain==='all'?t('All domains','全部领域'):domainViewRules.find(rule=>rule.id===state.domain)?.label||t('All domains','全部领域');$('statusSelection').textContent=model?`${catalog.filter(item=>item.model_scores?.[model.model_id]).length} ${t('reported benchmarks','个已报分 Benchmark')}`:t('No landmark selected','尚未选择节点');}syncUrl();}
    function showToast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1600);}

    const resizer=$('inspectorResizer');let resizing=false;
    resizer.addEventListener('pointerdown',event=>{if(window.innerWidth<=1050)return;resizing=true;$('app').classList.add('resizing-inspector');event.preventDefault();});
    window.addEventListener('pointermove',event=>{if(!resizing)return;setInspectorWidth(window.innerWidth-event.clientX);});
    const finishInspectorResize=()=>{if(!resizing)return;resizing=false;$('app').classList.remove('resizing-inspector');const width=parseFloat(getComputedStyle($('app')).getPropertyValue('--inspector-width'));setInspectorWidth(width,true);if(state.mode==='map')fitView();};
    window.addEventListener('pointerup',finishInspectorResize);window.addEventListener('pointercancel',finishInspectorResize);
    resizer.addEventListener('dblclick',()=>{setInspectorWidth(defaultInspectorWidth,true);if(state.mode==='map')fitView();});
    resizer.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();const current=parseFloat(getComputedStyle($('app')).getPropertyValue('--inspector-width'));setInspectorWidth(event.key==='Home'?defaultInspectorWidth:current+(event.key==='ArrowLeft'?16:-16),true);if(state.mode==='map')fitView();});

    const vp=$('viewport');vp.addEventListener('pointerdown',e=>{if(e.target.closest('.node,.focus-hub-control,.domain-hub-control'))return;state.drag=true;state.startX=e.clientX;state.startY=e.clientY;state.baseX=state.x;state.baseY=state.y;vp.setPointerCapture(e.pointerId);vp.classList.add('dragging')});vp.addEventListener('pointermove',e=>{if(!state.drag)return;state.x=state.baseX+e.clientX-state.startX;state.y=state.baseY+e.clientY-state.startY;applyTransform()});vp.addEventListener('pointerup',()=>{state.drag=false;vp.classList.remove('dragging')});vp.addEventListener('wheel',e=>{e.preventDefault();const r=vp.getBoundingClientRect();zoom(e.deltaY<0?.08:-.08,e.clientX-r.left,e.clientY-r.top)},{passive:false});
    $('zoomIn').addEventListener('click',()=>zoom(.1));$('zoomOut').addEventListener('click',()=>zoom(-.1));$('resetView').addEventListener('click',fitView);$('shareView').addEventListener('click',prepareShareLink);$('focusBack').addEventListener('click',()=>enterDomainFocus('all'));$('closeInspector').addEventListener('click',()=>closeInspector());$('mapNav').addEventListener('click',()=>switchMode('map'));$('rankNav').addEventListener('click',()=>switchMode('ranking'));document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>switchMode(btn.dataset.mode)));$('variantSelect').addEventListener('change',event=>{const row=state.activeVariants[Number(event.target.value)];if(!row)return;state.activeProtocol=row.comparability_group_id||'';updateEvidence(row,state.activeItem);syncUrl();});$('search').addEventListener('input',e=>{state.query=e.target.value.trim();applyFilters();renderSearchResults();});$('search').addEventListener('keydown',event=>{if(event.key==='Enter'){const first=$('searchResults').querySelector('.search-result');if(first){event.preventDefault();openSearchResult(first.dataset.key);}}if(event.key==='Escape')closeSearch();});document.addEventListener('click',event=>{if(!event.target.closest('.search-wrap'))closeSearch();if(!event.target.closest('.matrix-controls')){$('matrixModelMenu').classList.remove('open');$('matrixModelButton').setAttribute('aria-expanded','false');}});document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus();$('search').select();}});window.addEventListener('resize',()=>{const width=parseFloat(getComputedStyle($('app')).getPropertyValue('--inspector-width'));setInspectorWidth(width);if(state.mode==='map')fitView();});window.addEventListener('hashchange',applyUrlState);

    const formatCount=value=>Number(value||0).toLocaleString('en-US');
    $('railCount').textContent=`${data.summary.result_count} ROWS · ${data.summary.model_count} MODELS · ${data.summary.benchmark_group_count} BENCHMARKS`;
    $('headerReports').textContent=`${formatCount(data.summary.report_count)} source reports`;
    $('headerResults').textContent=formatCount(data.summary.result_count);
    $('headerModels').textContent=formatCount(data.summary.model_count);
    $('headerBenchmarks').textContent=formatCount(data.summary.benchmark_group_count);
    $('statusResults').textContent=`${formatCount(data.summary.result_count)} results`;
    $('statusModels').textContent=`${formatCount(data.summary.model_count)} ${t('models','模型')}`;
    $('mapCoverage').textContent=`${featured.length} / ${formatCount(data.summary.benchmark_group_count)} ${t('landmarks shown','个 Benchmark 已显示')}`;
    restoreInspectorWidth();renderFilters();renderMap();applyFilters();fitView();
    const requestedBenchmark=initialHash.get('benchmark');const initialBenchmark=catalog.some(item=>item.rank_group_key===requestedBenchmark)?requestedBenchmark:null;const initialItem=catalog.find(item=>item.rank_group_key===initialBenchmark);
    if(initialItem&&!mapRepresentativeFor(initialItem)&&state.mode==='map')enterDomainFocus(getMacro(initialItem).id,false);
    if(window.matchMedia('(max-width:650px)').matches&&!initialHash.has('view'))state.mode='registry';
    switchMode(state.mode);if(initialItem){const score=modelScore(initialItem);selectBenchmark(initialBenchmark,state.initialProtocol||score?.g||'',state.modelId);}else closeInspector(false);
