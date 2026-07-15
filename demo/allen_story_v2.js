/* Elman cinematic replay — a single diagram that BUILDS UP step by step.
   A persistent pipeline rail (top) grows node-by-node; a detail panel (below)
   shows the current step's example. Plays a vetted Allen Visual Cortex run
   baked into story_data.json. */
(function(){
'use strict';

var DATA=null, HEROES={};

// ============================ helpers ============================
function esc(t){ return (t==null?'':String(t)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function prettyRel(r){ return (r||'').replace(/_/g,' ').replace(/\bOF\b/g,'of').toLowerCase().replace(/^./,function(c){return c.toUpperCase();}); }
function snippet(t,n){ t=(t||'').replace(/\s+/g,' ').trim(); return t.length>n ? t.slice(0,n-1)+'…' : t; }
// like snippet but keeps newlines (markdown needs them); trims trailing space
function clip(t,n){ t=(t==null?'':String(t)); return t.length>n ? t.slice(0,n-1).replace(/\s+$/,'')+'…' : t; }
// tiny, safe markdown → html: escape first (content is our own baked data), then
// render headings, bold, italic and line breaks.
function mdToHtml(t){
  t=esc(t||'');
  t=t.replace(/^[ \t]*#{1,6}[ \t]+(.+?)\s*$/gm,'<span class="md-h">$1</span>');
  t=t.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');
  t=t.replace(/\*([^*\n]+)\*/g,'<i>$1</i>');
  t=t.replace(/\n{2,}/g,'<br><br>').replace(/\n/g,'<br>');
  return t;
}
function $(id){ return document.getElementById(id); }

// ============================ evidence-graph renderer (ported from allen_findings_lab) ============================
function typeColor(type){
  var t=(type||'').toLowerCase().replace(/[^a-z]/g,'');
  var M={celltype:'#2b8a88',rna:'#3a6fd8',protein:'#8b54c6',drug:'#F76233',smallmolecule:'#F76233',
    geneticvariant:'#cc4c6a',phenotype:'#2f8a63',pathway:'#b5790f',gene:'#3a6fd8',computationalmodel:'#5b6b8c'};
  return M[t]||'#7a7a85';
}
var EG_BUCKETS={
  supporting:{label:'Supporting',color:'#1f9d63'},
  insignificant:{label:'Not significant',color:'#b5790f'},
  no_effect:{label:'No effect',color:'#d8385a'},
  context:{label:'Context',color:'#9aa3b2'}
};
function egBucketKey(e){ return e.edge_kind==='context'?'context':(EG_BUCKETS[e.bucket]?e.bucket:'insignificant'); }
function egNodeLabel(id){ var s=String(id||''); return s.indexOf(':')!==-1 ? s.split(':').pop() : s; }
function truncLabel(s,n){ s=String(s||''); return s.length>n ? s.slice(0,n-1)+'…' : s; }
var EG_SEP=60;

function forceComponent(ids, edges){
  var N=ids.length, lidx={}; ids.forEach(function(id,i){lidx[id]=i;});
  var inComp={}; ids.forEach(function(id){inComp[id]=1;});
  var links=[];
  edges.forEach(function(e){ if(e.source!==e.target && inComp[e.source] && inComp[e.target]){
    var s=lidx[e.source],t=lidx[e.target]; if(s!==t) links.push({s:s,t:t}); }});
  if(N===1) return {ids:ids,pos:[{x:0,y:0}]};
  if(N===2) return {ids:ids,pos:[{x:0,y:0},{x:EG_SEP*1.7,y:0}]};
  var base=Math.max(EG_SEP*2, Math.round(Math.sqrt(N)*EG_SEP*1.7));
  var sideW=Math.round(base*1.35), sideH=Math.round(base*0.82);
  var M=EG_SEP*0.55, k=EG_SEP*1.7, GA=Math.PI*(3-Math.sqrt(5));
  var pos=ids.map(function(id,i){ var rr=(Math.sqrt(i+0.5)/Math.sqrt(N))*Math.min(sideW,sideH)*0.46, a=i*GA;
    return {x:sideW/2+Math.cos(a)*rr, y:sideH/2+Math.sin(a)*rr, vx:0, vy:0}; });
  function relax(strength){
    for(var i=0;i<N;i++) for(var j=i+1;j<N;j++){
      var dx=pos[j].x-pos[i].x, dy=pos[j].y-pos[i].y, d=Math.sqrt(dx*dx+dy*dy);
      if(d<EG_SEP){ var ux,uy;
        if(d<0.001){ var a=i*12.9898+j*78.233; ux=Math.cos(a); uy=Math.sin(a); d=0.001; }
        else { ux=dx/d; uy=dy/d; }
        var push=((EG_SEP-d)/2)*strength;
        pos[i].x-=ux*push; pos[i].y-=uy*push; pos[j].x+=ux*push; pos[j].y+=uy*push;
      }
    }
  }
  var iterations=N>120?120:300;
  for(var it=0; it<iterations; it++){
    var temp=(1-it/iterations);
    for(var i=0;i<N;i++){ var fx=0,fy=0;
      for(var j=0;j<N;j++){ if(i===j)continue;
        var dx=pos[i].x-pos[j].x, dy=pos[i].y-pos[j].y, d=Math.sqrt(dx*dx+dy*dy)||0.01;
        var rep=(k*k)/d; fx+=(dx/d)*rep; fy+=(dy/d)*rep; }
      pos[i].vx=fx; pos[i].vy=fy; }
    links.forEach(function(l){ var dx=pos[l.s].x-pos[l.t].x, dy=pos[l.s].y-pos[l.t].y, d=Math.sqrt(dx*dx+dy*dy)||0.01;
      var att=(d*d)/k, ax=(dx/d)*att, ay=(dy/d)*att;
      pos[l.s].vx-=ax; pos[l.s].vy-=ay; pos[l.t].vx+=ax; pos[l.t].vy+=ay; });
    for(var i2=0;i2<N;i2++){ pos[i2].vx+=(sideW/2-pos[i2].x)*0.010; pos[i2].vy+=(sideH/2-pos[i2].y)*0.012;
      var disp=Math.sqrt(pos[i2].vx*pos[i2].vx+pos[i2].vy*pos[i2].vy)||0.01, lim=Math.min(disp,temp*k*2);
      pos[i2].x=Math.max(M,Math.min(sideW-M,pos[i2].x+(pos[i2].vx/disp)*lim));
      pos[i2].y=Math.max(M,Math.min(sideH-M,pos[i2].y+(pos[i2].vy/disp)*lim)); }
    relax(0.5);
  }
  var fp=Math.max(140,Math.min(340,N*2));
  for(var c=0;c<fp;c++){ relax(1); for(var i3=0;i3<N;i3++){ pos[i3].x=Math.max(M,Math.min(sideW-M,pos[i3].x)); pos[i3].y=Math.max(M,Math.min(sideH-M,pos[i3].y)); } }
  return {ids:ids,pos:pos};
}

// Lay out the graph: keep the main connected component PROMINENT, pack the small
// satellite components compactly to the side so the canvas fills width without
// the main mechanism shrinking into a corner.
function layoutGraph(nodes, edges){
  var adj={}; nodes.forEach(function(n){adj[n.id]=[];});
  edges.forEach(function(e){ if(e.source!==e.target && adj[e.source] && adj[e.target]){ adj[e.source].push(e.target); adj[e.target].push(e.source); }});
  var seen={}, comps=[];
  nodes.forEach(function(n){ if(seen[n.id]) return; var st=[n.id]; seen[n.id]=1; var c=[];
    while(st.length){ var id=st.pop(); c.push(id); (adj[id]||[]).forEach(function(m){ if(!seen[m]){ seen[m]=1; st.push(m); }}); }
    comps.push(c); });
  var PADC=EG_SEP*0.45, gap=EG_SEP*0.55;  // tight packing — fills the panel, less scatter
  var boxes=comps.map(function(ids){
    var L=forceComponent(ids,edges);
    var xs=L.pos.map(function(p){return p.x;}), ys=L.pos.map(function(p){return p.y;});
    var minx=Math.min.apply(null,xs), miny=Math.min.apply(null,ys);
    var maxx=Math.max.apply(null,xs), maxy=Math.max.apply(null,ys);
    return {L:L, minx:minx, miny:miny, w:(maxx-minx)+PADC*2, h:(maxy-miny)+PADC*2, n:ids.length};
  });
  boxes.sort(function(a,b){ return (b.w*b.h)-(a.w*a.h); });
  var widest=Math.max.apply(null, boxes.map(function(b){return b.w;}));
  // Size the packing canvas to the detail panel's aspect (~2.2:1 wide) so the
  // graph fills the space instead of sitting as a small band/square with big
  // margins. Derived from total component area so it scales with graph size.
  var totalArea=0; boxes.forEach(function(b){ totalArea+=b.w*b.h; });
  var targetW=Math.max(widest, Math.round(Math.sqrt(totalArea*1.5))), PAD=EG_SEP*0.5;
  var x=0,y=0,rowH=0,usedW=0,out={};
  boxes.forEach(function(b){
    if(x>0 && x+b.w>targetW){ x=0; y+=rowH+gap; rowH=0; }
    var ox=x,oy=y;
    b.L.pos.forEach(function(p,i){ out[b.L.ids[i]]={x:PAD+ox+PADC+(p.x-b.minx), y:PAD+oy+PADC+(p.y-b.miny)}; });
    x+=b.w+gap; if(x-gap>usedW) usedW=x-gap; rowH=Math.max(rowH,b.h);
  });
  var W=usedW+PAD*2, H=(y+rowH)+PAD*2, MINW=560;
  if(W<MINW){ var dx=(MINW-W)/2; Object.keys(out).forEach(function(id){ out[id].x+=dx; }); W=MINW; }
  return {posById:out, W:Math.max(1,W), H:Math.max(1,H), sep:EG_SEP, nodeR:14, font:23, strokeW:3};
}
function egShorten(x1,y1,x2,y2,r1,r2){ var dx=x2-x1,dy=y2-y1,d=Math.sqrt(dx*dx+dy*dy)||1;
  return {x1:x1+dx/d*r1,y1:y1+dy/d*r1,x2:x2-dx/d*r2,y2:y2-dy/d*r2}; }
function egEdgePath(x1,y1,x2,y2,offset){
  if(!offset) return 'M'+x1.toFixed(1)+' '+y1.toFixed(1)+' L'+x2.toFixed(1)+' '+y2.toFixed(1);
  var mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1;
  var cx=mx+(-dy/len)*offset, cy=my+(dx/len)*offset;
  return 'M'+x1.toFixed(1)+' '+y1.toFixed(1)+' Q'+cx.toFixed(1)+' '+cy.toFixed(1)+' '+x2.toFixed(1)+' '+y2.toFixed(1);
}
function egEdgeTitle(e){ return egNodeLabel(e.source)+' → '+egNodeLabel(e.target)+'  ·  '+prettyRel(e.rel_type)+
  (e.p_display?('  ·  p='+e.p_display):'')+'  ·  '+(EG_BUCKETS[egBucketKey(e)]||{}).label; }

function buildSvg(nodes, edges){
  var layout=layoutGraph(nodes,edges);
  var posById=layout.posById, R=layout.nodeR, F=layout.font, SW=layout.strokeW;
  var pairCount={}; edges.forEach(function(e){ if(e.source===e.target) return; var k=[e.source,e.target].sort().join('|'); pairCount[k]=(pairCount[k]||0)+1; });
  var seen={}, edgeSvg='';
  edges.forEach(function(e,i){
    if(e.source===e.target) return;
    var ps=posById[e.source], pt=posById[e.target]; if(!ps||!pt) return;
    var k=[e.source,e.target].sort().join('|');
    seen[k]=(seen[k]==null?0:seen[k]+1);
    var cnt=pairCount[k], offset=cnt>1?((seen[k]-(cnt-1)/2)*(layout.sep*0.34)):0;
    var bk=egBucketKey(e), col=EG_BUCKETS[bk].color;
    var dash=bk==='context'?(' stroke-dasharray="'+(SW*2.5).toFixed(1)+' '+(SW*2.5).toFixed(1)+'"'):'';
    var sh=egShorten(ps.x,ps.y,pt.x,pt.y,R+1,R+5);
    edgeSvg+='<path class="eg-edge" data-ei="'+i+'" d="'+egEdgePath(sh.x1,sh.y1,sh.x2,sh.y2,offset)+'" fill="none" stroke="'+col+'" stroke-width="'+SW.toFixed(1)+'"'+dash+' marker-end="url(#egm-'+bk+')"><title>'+esc(egEdgeTitle(e))+'</title></path>';
  });
  // Only LABEL the most-connected entities (hubs) — labelling all 79 nodes makes
  // an unreadable thicket. Everything else is a dot (label on hover via <title>).
  var deg={};
  edges.forEach(function(e){ if(e.source!==e.target){ deg[e.source]=(deg[e.source]||0)+1; deg[e.target]=(deg[e.target]||0)+1; } });
  var labeled={};
  nodes.map(function(n){return n.id;})
    .filter(function(id){ return (deg[id]||0)>=2; })
    .sort(function(a,b){ return (deg[b]||0)-(deg[a]||0); })
    .slice(0,16)
    .forEach(function(id){ labeled[id]=1; });
  var nodeSvg='';
  nodes.forEach(function(n){
    var p=posById[n.id]; if(!p) return;
    var lab = labeled[n.id] ? ('<text class="eg-node-label" x="'+p.x.toFixed(1)+'" y="'+(p.y-(R+6)).toFixed(1)+'" text-anchor="middle" style="font-size:'+F+'px">'+esc(truncLabel(n.label,22))+'</text>') : '';
    nodeSvg+='<g class="eg-node" data-nid="'+esc(n.id)+'">'+lab+
      '<circle class="eg-node-dot" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="'+R+'" fill="'+typeColor(n.type)+'" fill-opacity="0.95" stroke="#ffffff" stroke-width="'+Math.max(1.5,SW*0.9).toFixed(1)+'"><title>'+esc((n.type?n.type+': ':'')+n.label)+'</title></circle>'+
    '</g>';
  });
  var defs=['supporting','insignificant','no_effect','context'].map(function(b){
    return '<marker id="egm-'+b+'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="'+EG_BUCKETS[b].color+'"/></marker>'; }).join('');
  return '<svg class="eg-svg" viewBox="0 0 '+layout.W.toFixed(0)+' '+layout.H.toFixed(0)+'" preserveAspectRatio="xMidYMid meet"><defs>'+defs+'</defs>'+edgeSvg+nodeSvg+'</svg>';
}
function buildLegend(nodes, edges){
  var present={}; edges.forEach(function(e){ present[egBucketKey(e)]=1; });
  var edgeLeg=['supporting','insignificant','no_effect','context'].filter(function(b){return present[b];})
    .map(function(b){ return '<span class="lg"><span class="ln" style="background:'+EG_BUCKETS[b].color+'"></span>'+EG_BUCKETS[b].label+'</span>'; }).join('');
  var types=[], seen={};
  nodes.forEach(function(n){ var t=n.type||'Other'; if(!seen[t]){ seen[t]=1; types.push(t); }});
  var typeLeg=types.slice(0,8).map(function(t){ return '<span class="lg"><span class="dt" style="background:'+typeColor(t)+'"></span>'+esc(t)+'</span>'; }).join('');
  return '<div class="eg-legend">'+edgeLeg+(edgeLeg&&typeLeg?'<span style="opacity:.4">|</span>':'')+typeLeg+'</div>';
}
function bucketCounts(g){ var m={}; (g.edges||[]).forEach(function(e){ var b=egBucketKey(e); m[b]=(m[b]||0)+1; }); return m; }
function graphStageHTML(g){ return '<div class="eg-stage eg-prebloom">'+buildSvg(g.nodes||[],g.edges||[])+'</div>'+buildLegend(g.nodes||[],g.edges||[]); }
function bloom(stage){
  if(!stage) return;
  var dots=stage.querySelectorAll('.eg-node-dot'), labels=stage.querySelectorAll('.eg-node-label'), edges=stage.querySelectorAll('.eg-edge');
  var ns=dots.length;
  for(var i=0;i<dots.length;i++){ var del=Math.min(i*9,850); dots[i].style.transitionDelay=del+'ms'; if(labels[i]) labels[i].style.transitionDelay=del+'ms'; }
  for(var j=0;j<edges.length;j++){ edges[j].style.transitionDelay=(Math.min(ns*9,850)+Math.min(j*5,750))+'ms'; }
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ stage.classList.remove('eg-prebloom'); }); });
}
function statLine(g, role){
  var bc=bucketCounts(g);
  if(role==='disproven') return g.node_count+' entities · '+g.edge_count+' connections · <b style="color:var(--disproven)">'+(bc.no_effect||0)+'</b> no-effect';
  return g.node_count+' entities · '+g.edge_count+' connections · <b style="color:var(--proven)">'+(bc.supporting||0)+'</b> supporting';
}

// ============================ content builders (return HTML / animate) ============================
function datasetsHTML(){
  var d=DATA.discovery||{}, s=d.summary||{}, ds=(d.datasets||[]).slice(0,12);
  var more=Math.max(0,(s.studies_total||0)-ds.length);
  var srcDist=s.source_distribution||{};
  var order=['GEO','Synapse','EGA'];
  var srcKeys=order.filter(function(k){return srcDist[k]!=null;})
    .concat(Object.keys(srcDist).filter(function(k){return order.indexOf(k)<0;}));
  var badges=srcKeys.map(function(k){
    return '<span class="src-badge ds-'+esc(k.toLowerCase())+'"><span class="src-dot"></span>'+esc(k)+' <b>'+esc(String(srcDist[k]))+'</b></span>';
  }).join('');
  var cards=ds.map(function(x){
    var src=(x.source||'').toString();
    return '<div class="ds-card ds-reveal"><div class="ds-acc">'+esc(x.accession||'')+'</div>'+
      '<div class="ds-title">'+esc(truncLabel(x.title||'',70))+'</div>'+
      '<div class="ds-meta"><span class="ds-src ds-'+esc(src.toLowerCase())+'">'+esc(src)+'</span>'+
      (x.n_subjects?'<span class="ds-n">'+esc(String(x.n_subjects))+' subj</span>':'')+
      (x.sub_indication?'<span class="ds-sub">'+esc(x.sub_indication)+'</span>':'')+'</div></div>';
  }).join('');
  return '<div class="discover">'+
    '<div class="disc-head"><span class="scan"><span class="scan-dot"></span>Scanning GEO · Synapse · EGA</span>'+
      '<span class="disc-badges">'+badges+'</span></div>'+
    '<div class="disc-counter"><b class="disc-n">0</b> datasets found <span class="disc-sub">· '+(s.studies_included||0)+' pass quality filters</span></div>'+
    '<div class="ds-grid-wrap"><div class="ds-grid">'+cards+'</div>'+
      (more>0?'<div class="ds-more">+'+more+' more datasets</div>':'')+'</div></div>';
}
function cohortHTML(){
  var s=(DATA.discovery||{}).summary||{}, subs=s.sub_indications||{};
  var vals=Object.keys(subs).map(function(k){ return subs[k]; });
  var maxv=Math.max.apply(null,[1].concat(vals));
  var bars=Object.keys(subs).sort(function(a,b){ return subs[b]-subs[a]; }).map(function(k){
    var v=subs[k], pct=Math.max(4,Math.round(v/maxv*100));
    return '<div class="co-bar"><div class="co-bar-l">'+esc(k)+'</div><div class="co-track"><div class="co-fill" data-pct="'+pct+'" style="width:0"></div></div><div class="co-v">'+v+'</div></div>';
  }).join('');
  function fmt(n){ return (n||0).toLocaleString(); }
  var tf=s.tissue_flags||{};
  var tags=[];
  if(s.treatment_naive) tags.push('Treatment-naïve <b>'+fmt(s.treatment_naive)+'</b>');
  if(s.treated) tags.push('Treated <b>'+fmt(s.treated)+'</b>');
  if(tf.pbmc) tags.push('Matched PBMC / blood <b>'+fmt(tf.pbmc)+'</b>');
  var extra = tags.length ? '<div class="co-extra">'+tags.map(function(t){ return '<span class="co-tag">'+t+'</span>'; }).join('')+'</div>' : '';
  var msets=''; for(var i=0;i<12;i++){ msets+='<span class="mset"></span>'; }
  return '<div class="cohort-wrap">'+
    '<div class="merge"><div class="mset-row">'+msets+'</div>'+
      '<div class="merge-core"><b>'+fmt(s.total_subjects)+'</b><span>subjects · one unified cohort</span></div></div>'+
    '<div class="co-stats">'+
    '<div class="co-stat res"><div class="num" data-to="'+(s.healthy_donors||0)+'">0</div><div class="lab">healthy donors</div></div>'+
    '<div class="co-stat vuln"><div class="num" data-to="'+(s.diseased||0)+'">0</div><div class="lab">diseased</div></div></div>'+
    '<div class="co-subs"><div class="co-subs-h">By sub-indication</div>'+bars+'</div>'+extra+'</div>';
}
function cellsHTML(){
  var cells=[['L4 IT 1','res'],['L4 IT 2','res'],['L4 IT 3','res'],['L4 IT 4','res'],
    ['L4 IT 5','vuln'],['L4 IT 6','vuln'],['L4 IT 7','vuln'],['L4 IT 8','vuln'],
    ['L2/3 IT',''],['L5 ET',''],['Astrocyte',''],['Microglia',''],['Oligodendrocyte',''],['OPC',''],['Pvalb',''],['Sst','']];
  return '<div class="cells-row">'+cells.map(function(c){ return '<span class="cellchip '+c[1]+'">'+esc(c[0])+'</span>'; }).join('')+'</div>';
}
// single-cell map: clusters of cells that resolve from grey to their type colour
// (mirrors the real pipeline: scVI integrate → cluster → hierarchical annotation).
function cellsMapSVG(){
  var W=760,H=236, G='#1f9d63', R='#d8385a', S='#9aa3b2';
  var types=[G,G,G,G,R,R,R,R,S,S,S,S,S,S,S,S];   // 4 resilient, 4 vulnerable, 8 other
  var N=types.length, GA=Math.PI*(3-Math.sqrt(5)), cx=W/2, cy=H/2, sx=W*0.40, sy=H*0.40, dots='';
  for(var t=0;t<N;t++){
    var rr=Math.sqrt((t+0.5)/N), a=t*GA, ccx=cx+Math.cos(a)*sx*rr, ccy=cy+Math.sin(a)*sy*rr;
    var nd=11+Math.floor(Math.random()*6);
    for(var d=0;d<nd;d++){
      var da=Math.random()*Math.PI*2, dr=Math.random()*15, x=ccx+Math.cos(da)*dr, y=ccy+Math.sin(da)*dr;
      dots+='<circle class="cmd" data-c="'+types[t]+'" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="3.3"/>';
    }
  }
  return '<svg class="cellmap" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+dots+'</svg>';
}
function questionCardHTML(){
  return '<div class="qcard"><div class="qlabel">Target-validation challenge</div>'+
    '<div class="qtext">Find the molecular fork between <span style="color:var(--disproven)">vulnerable</span> and <span style="color:var(--proven)">resilient</span> neurons in the visual cortex — which genes drive failure, and which protect?</div>'+
  '</div>';
}
function qsplitHTML(){
  return '<div class="qsplit"><div class="qgroup vuln"><div class="blob">L4 IT<br>5–8</div><div class="cap">Vulnerable — these die</div></div>'+
    '<div class="qgroup res"><div class="blob">L4 IT<br>1–4</div><div class="cap">Resilient — these survive</div></div></div>';
}
function verdictCardHTML(h){
  var v=h.role==='disproven'?'disproven':'proven', label=v==='proven'?'PROVEN':'DISPROVEN', foot='';
  if(h.target_quality) foot+='<span>Target quality: '+esc(h.target_quality)+'</span>';
  if(h.graph) foot+='<span>'+h.graph.edge_count+' evidence edges</span>';
  foot+='<span>Every edge links to its source</span>';
  return '<div class="verdict-card"><div class="vc-top"><span class="verdict '+v+'">'+label+'</span><span class="vc-name">'+esc(h.name)+'</span></div>'+
    '<div class="vc-body">'+mdToHtml(clip(h.short_hypothesis,300))+'</div>'+
    (h.research_paper?'<div class="vc-body md" style="margin-top:10px;color:var(--faint)">'+mdToHtml(clip(h.research_paper,440))+'</div>':'')+
    '<div class="vc-foot">'+foot+'</div></div>';
}
function pairColHTML(h, label){
  var g=h.graph, v=h.role==='disproven'?'disproven':'proven';
  return '<div class="col"><div class="graph-head" style="margin-bottom:4px"><span class="graph-title" style="font-size:18px">'+esc(label)+
    ' <span class="verdict '+v+'">'+(v==='proven'?'PROVEN':'DISPROVEN')+'</span></span></div>'+
    '<div class="graph-stat" style="margin-bottom:6px">'+statLine(g,v)+'</div>'+graphStageHTML(g)+'</div>';
}
function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function animateCounter(el, to, ms){
  if(!el) return; var start=null, from=0;
  function tick(ts){ if(start==null) start=ts; var p=Math.min(1,(ts-start)/ms);
    // thousands separator, so the counted-up numbers match the static ones (3,014)
    el.textContent=Math.round(from+(to-from)*(p<1?(1-Math.pow(1-p,2)):1)).toLocaleString('en-GB');
    if(p<1) requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
}
function explosionHTML(){
  return '<div class="explosion" id="explosion"><div class="core">Vulnerable vs Resilient L4 IT?</div>'+
    '<div class="counter" id="exp-counter"><b>0</b> hypotheses</div></div>';
}
function runExplosion(){
  var box=$('explosion'); if(!box) return;
  if(box.querySelector('.hchip')) return;  // already scattered — don't re-run
  var W=box.clientWidth||900, H=box.clientHeight||520;
  // elliptical scatter that uses the full width (not limited by height), so the
  // chips spread out instead of clustering in the centre.
  var rx=Math.max(180, W*0.45), ry=Math.max(130, H*0.44);
  // 8 of the 124 rows carry no name; drop them rather than render a chip that
  // literally reads "hypothesis" (116 named ones is plenty for a 72-chip cloud).
  var named=(DATA.hypotheses||[]).filter(function(h){ return h && (h.name||'').trim(); });
  var sample=shuffle(named).slice(0,72);
  sample.forEach(function(h,i){
    var c=document.createElement('div');
    c.className='hchip'+(h.status==='proven'?' proven':h.status==='disproven'?' disproven':'');
    c.textContent=h.name;
    box.appendChild(c);
    var ang=Math.random()*Math.PI*2, frac=0.40+Math.random()*0.60;
    var x=Math.cos(ang)*rx*frac, y=Math.sin(ang)*ry*frac;
    c.style.transitionDelay=(i*20)+'ms';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      c.style.transform='translate(calc(-50% + '+x.toFixed(0)+'px), calc(-50% + '+y.toFixed(0)+'px)) scale(1)';
      c.classList.add('out');
    }); });
  });
  animateCounter(box.querySelector('#exp-counter b'), (DATA.counts&&DATA.counts.total)||124, 1700);
}
function ledgerHTML(){
  var c=DATA.counts_raw||{}, cm=DATA.counts||{};
  var total=cm.total||124, proven=c['complete-proven']||cm.proven||0, dis=c['complete-disproven']||cm.disproven||0;
  return '<div class="ledger"><div class="lstat total"><div class="num">'+total+'</div><div class="lab">hypotheses tested</div></div>'+
    '<div class="lstat proven"><div class="num">'+proven+'</div><div class="lab">proven</div></div>'+
    '<div class="lstat disproven"><div class="num">'+dis+'</div><div class="lab">disproven</div></div></div>'+
    '<div class="note">Every verdict is backed by a graph of real evidence — bioinformatics, literature and single-cell data — openable edge by edge.</div>';
}
// ============================ detail renderers (fill #detail) ============================
var detail=null, _grayTimer=null;
function dIntro(showLede){
  // Build the intro once; slide 2 just fades the subtitle in. Rebuilding (or a
  // panel crossfade) would blink the headline — this keeps logo+headline static.
  var box=detail.querySelector('.d-intro');
  if(!box){ detail.innerHTML='<div class="d-intro">'+
    '<div class="logo"><svg class="elman-wm" viewBox="0 0 427 106" role="img" aria-label="Elman">'+
      '<path d="M187.659 88.178H143.641V18.7797H186.37V26.711H152.266V48.9184H180.918V56.8496H152.266V80.2468H187.659V88.178Z"/>'+
      '<path d="M222.998 80.7425H238.365V88.178H199.601V80.7425H214.869V26.2153H199.601V18.7797H222.998V80.7425Z"/>'+
      '<path d="M296.074 37.0216C306.087 37.0216 312.531 44.0605 312.531 55.5608V88.178H304.401V55.8582C304.401 49.1167 301.229 44.6554 294.983 44.6554C288.341 44.6554 284.474 49.7115 284.474 56.3539V88.178H276.345V55.8582C276.345 49.6124 273.767 44.6554 266.629 44.6554C260.086 44.6554 256.418 49.8107 256.418 57.0479V88.178H248.288V37.6164H255.129L255.823 42.97C258.4 39.3018 262.763 37.0216 268.513 37.0216C274.56 37.0216 279.319 40.0949 281.599 44.7545C284.573 40.0949 289.431 37.0216 296.074 37.0216Z"/>'+
      '<path d="M369.348 80.7425H371.926V88.178H367.465C360.723 88.178 358.443 85.3029 358.344 80.3459C355.171 84.9064 350.115 88.7728 341.391 88.7728C330.287 88.7728 322.752 83.221 322.752 74.0009C322.752 63.8886 329.791 58.2376 343.076 58.2376H357.947V54.7677C357.947 48.2244 353.288 44.2588 345.356 44.2588C338.218 44.2588 333.46 47.6296 332.468 52.7849H324.339C325.528 42.8708 333.559 37.0216 345.753 37.0216C358.641 37.0216 366.077 43.4657 366.077 55.2634V77.3717C366.077 80.0485 367.068 80.7425 369.348 80.7425ZM357.947 67.5568V65.0783H342.283C335.046 65.0783 330.981 67.7551 330.981 73.5052C330.981 78.4622 335.244 81.833 341.986 81.833C352.098 81.833 357.947 75.9837 357.947 67.5568Z"/>'+
      '<path d="M407.124 37.0216C418.029 37.0216 426.952 42.97 426.952 59.0307V88.178H418.823V59.5264C418.823 49.7115 414.064 44.4571 405.736 44.4571C396.813 44.4571 391.063 51.0995 391.063 61.9058V88.178H382.934V37.6164H389.973L391.063 44.4571C394.037 40.5906 399.094 37.0216 407.124 37.0216Z"/>'+
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M14.3232 0C6.4127 0 0 6.4127 0 14.3232C0 22.2336 6.4127 28.6463 14.3232 28.6463C17.3575 28.6463 20.1714 27.7028 22.4876 26.0931L34.0446 39.1457L25.6695 43.8752C23.0504 40.4809 18.9421 38.2946 14.3232 38.2946C6.4127 38.2946 0 44.7073 0 52.6178C0 60.5282 6.4127 66.9409 14.3232 66.9409C19.2672 66.9409 23.6262 64.436 26.2001 60.626C26.1602 60.685 26.1199 60.7438 26.0791 60.8023L34.0446 65.3004L22.0484 78.849C19.8195 77.4187 17.1682 76.5892 14.3232 76.5892C6.4127 76.5892 0 83.0019 0 90.9124C0 98.8228 6.4127 105.236 14.3232 105.236C21.6618 105.236 27.7115 99.7163 28.5477 92.6023L67.2129 92.6023C68.0491 99.7163 74.0987 105.236 81.4374 105.236C89.3479 105.236 95.7606 98.8228 95.7606 90.9124C95.7606 83.0019 89.3479 76.5892 81.4374 76.5892C78.5925 76.5892 75.9414 77.4186 73.7126 78.8488L50.1377 52.2231L73.2734 26.0934C75.5895 27.7029 78.4033 28.6463 81.4374 28.6463C89.3479 28.6463 95.7606 22.2336 95.7606 14.3232C95.7606 6.4127 89.3479 0 81.4374 0C74.0986 0 68.049 5.51927 67.2129 12.6334L28.5477 12.6334C27.7116 5.51927 21.6619 0 14.3232 0ZM3.37978 14.3232C3.37979 8.2793 8.2793 3.37978 14.3232 3.37978C20.367 3.37979 25.2665 8.2793 25.2665 14.3232C25.2665 20.367 20.367 25.2665 14.3232 25.2665C8.2793 25.2665 3.37978 20.367 3.37978 14.3232ZM28.5477 16.0131C28.1959 19.0055 26.9218 21.7157 25.0173 23.8517L37.0541 37.4462L68.2184 19.8475C67.7149 18.644 67.3709 17.357 67.2129 16.0131L28.5477 16.0131ZM69.8828 22.7891L39.3452 40.0339L47.8806 49.6739L70.7437 23.8521C70.4403 23.5119 70.153 23.1572 69.8828 22.7891ZM71.1008 80.9974L47.8806 54.7723L39.3452 64.4122L70.3071 81.8966C70.5592 81.5858 70.824 81.2858 71.1008 80.9974ZM68.5003 84.7577L37.0541 66.9999L24.6602 80.9977C26.7622 83.1888 28.1744 86.0468 28.5477 89.2226H67.2129C67.3987 87.6411 67.8422 86.1385 68.5003 84.7577ZM27.6721 57.8204L36.3358 62.7128L45.6235 52.2231L36.3358 41.7333L27.405 46.7766C27.3971 46.7588 27.3891 46.741 27.3811 46.7233C28.1939 48.521 28.6463 50.5165 28.6463 52.6178C28.6463 54.4531 28.3011 56.2077 27.6721 57.8204ZM70.494 14.3232C70.494 8.2793 75.3935 3.37978 81.4374 3.37978C87.4813 3.37979 92.3808 8.2793 92.3808 14.3232C92.3808 20.367 87.4813 25.2665 81.4374 25.2665C75.3935 25.2665 70.494 20.367 70.494 14.3232ZM3.37978 52.6178C3.37979 46.5739 8.2793 41.6744 14.3232 41.6744C20.367 41.6744 25.2665 46.5739 25.2665 52.6178C25.2665 58.6616 20.367 63.5611 14.3232 63.5611C8.2793 63.5611 3.37978 58.6616 3.37978 52.6178ZM3.37978 90.9124C3.37979 84.8685 8.2793 79.969 14.3232 79.969C20.367 79.969 25.2665 84.8685 25.2665 90.9124C25.2665 96.9562 20.367 101.856 14.3232 101.856C8.2793 101.856 3.37978 96.9562 3.37978 90.9124ZM70.494 90.9124C70.494 84.8685 75.3935 79.969 81.4374 79.969C87.4813 79.969 92.3808 84.8685 92.3808 90.9124C92.3808 96.9562 87.4813 101.856 81.4374 101.856C75.3935 101.856 70.494 96.9562 70.494 90.9124Z"/>'+
    '</svg></div>'+
    '<h1 class="h1">One engine, from <span class="brandword">siloed data and papers</span> to <span class="brandword">validated mechanisms</span>.</h1>'+
    '<p class="lede intro-lede">Integrated and fully traceable — the opposite of today’s slow, siloed workflow.</p></div>';
    box=detail.querySelector('.d-intro');
  }
  var lede=box.querySelector('.intro-lede'), myAnim=_anim;
  if(showLede){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ if(myAnim===_anim && lede) lede.classList.add('show'); }); }); }
  else if(lede){ lede.classList.remove('show'); }
}
function dIndication(){
  detail.innerHTML='<div class="d-center"><div class="big-pill reveal"><span class="pulse"></span>Alzheimer’s disease</div>'+
    '<p class="lede reveal-lede">The engine takes one disease and runs the whole pipeline on it.</p></div>';
  var myAnim=_anim, pill=detail.querySelector('.big-pill'), lede=detail.querySelector('.reveal-lede');
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ if(myAnim===_anim && pill) pill.classList.add('in'); }); });
  setTimeout(function(){ if(myAnim===_anim && lede) lede.classList.add('in'); }, 520);
}
function dDatasets(){
  detail.innerHTML='<div class="d-block">'+datasetsHTML()+'</div>';
  var myAnim=_anim, s=(DATA.discovery||{}).summary||{};
  var nEl=detail.querySelector('.disc-n'); if(nEl) animateCounter(nEl, s.studies_total||109, 1700);
  var badges=detail.querySelectorAll('.src-badge');
  for(var i=0;i<badges.length;i++){ (function(b,idx){ setTimeout(function(){ if(myAnim===_anim) b.classList.add('on'); }, 350+idx*280); })(badges[i],i); }
  var cards=detail.querySelectorAll('.ds-reveal'), j=0;
  (function pop(){ if(myAnim!==_anim||j>=cards.length) return; cards[j].classList.add('in'); j++; setTimeout(pop, 190); })();
}
function dCohort(){
  detail.innerHTML='<div class="d-block">'+cohortHTML()+'</div>';
  var myAnim=_anim, merge=detail.querySelector('.merge'), core=detail.querySelector('.merge-core');
  // many discovered datasets collapse into one cohort pill
  setTimeout(function(){ if(myAnim!==_anim) return; if(merge) merge.classList.add('go'); if(core) core.classList.add('in'); }, 450);
  // count the healthy/diseased split up
  setTimeout(function(){ if(myAnim!==_anim) return; var nums=detail.querySelectorAll('.co-stat .num');
    for(var i=0;i<nums.length;i++){ animateCounter(nums[i], +nums[i].dataset.to||0, 1100); } }, 1250);
  // fill the sub-indication bars
  setTimeout(function(){ if(myAnim!==_anim) return; var fills=detail.querySelectorAll('.co-fill');
    for(var i=0;i<fills.length;i++){ (function(f,idx){ setTimeout(function(){ if(myAnim===_anim) f.style.width=(f.dataset.pct||0)+'%'; }, idx*90); })(fills[i],i); } }, 1450);
  // reveal the treatment-status / tissue tags
  setTimeout(function(){ if(myAnim!==_anim) return; var ex=detail.querySelector('.co-extra'); if(ex) ex.classList.add('in'); }, 2050);
}
function dCells(){
  detail.innerHTML='<div class="d-center">'+cellsMapSVG()+cellsHTML()+
    '<p class="lede" style="margin-top:12px">Every cell labelled — down to L4 IT neuron subtypes.</p>'+
    '<p class="cells-method">scVI integration · clustering · hierarchical marker-tree annotation</p></div>';
  var myAnim=_anim;
  // colour the cell clusters in a wave (annotation resolving the map)
  var dots=detail.querySelectorAll('.cmd');
  for(var i=0;i<dots.length;i++){ (function(el,idx){ setTimeout(function(){ if(myAnim===_anim) el.style.fill=el.getAttribute('data-c'); }, 350+idx*10); })(dots[i],i); }
  // label the legend chips in sequence
  var chips=detail.querySelectorAll('.cellchip'), j=0;
  (function lab(){ if(myAnim!==_anim||j>=chips.length) return; chips[j].classList.add('labelled'); j++; setTimeout(lab, 150); })();
}
function dQuestion(split){
  // Additive: keep the question card across steps 6→7 and pop the vulnerable /
  // resilient split in (rather than re-rendering the whole card).
  var card=detail.querySelector('.qcard');
  if(!card){ detail.innerHTML='<div class="d-center">'+questionCardHTML()+'</div>'; card=detail.querySelector('.qcard'); }
  if(split){
    if(!card.querySelector('.qsplit')){
      card.insertAdjacentHTML('beforeend', qsplitHTML());
      var myAnim=_anim, groups=card.querySelectorAll('.qsplit .qgroup');
      // both populations fork apart almost together (a small offset keeps it lively)
      for(var i=0;i<groups.length;i++){ (function(g,idx){ setTimeout(function(){ if(myAnim===_anim) g.classList.add('in'); }, 150+idx*120); })(groups[i],i); }
    }
  } else {
    var qs=card.querySelector('.qsplit'); if(qs) qs.remove();
  }
}
function dExplosion(){ if(!detail.querySelector('#explosion')) detail.innerHTML='<div class="d-center">'+explosionHTML()+'</div>'; runExplosion(); }
function dValBuild(){
  detail.innerHTML='<div class="d-center"><div class="lanes"><div class="lane bio"><span class="ldot"></span>Bioinformatics</div>'+
    '<div class="lane lit"><span class="ldot"></span>Literature</div><div class="lane sc"><span class="ldot"></span>Single-cell data</div></div>'+
    '<div class="lede" style="margin-top:18px">Building the causal graph of evidence…</div></div>';
  var lanes=detail.querySelectorAll('.lane'); for(var i=0;i<lanes.length;i++){ (function(l,idx){ setTimeout(function(){ l.classList.add('on'); }, 200+idx*300); })(lanes[i],i); }
}
function dProven(){
  var h=HEROES.nova1; if(!h){ detail.innerHTML=''; return; }
  detail.innerHTML='<div class="graphwrap"><div class="graph-head"><span class="graph-title">'+esc(h.name)+'</span>'+
    '<span class="graph-stat">'+statLine(h.graph,'proven')+'</span></div>'+graphStageHTML(h.graph)+'</div>';
  bloom(detail.querySelector('.eg-stage'));
}
function dVerdict(){ var h=HEROES.nova1; detail.innerHTML='<div class="d-center">'+(h?verdictCardHTML(h):'')+'</div>'; }
function dPair(){
  var a=HEROES.prex1, d=HEROES.prex2;
  if(!a||!d){ detail.innerHTML=''; return; }
  detail.innerHTML='<div class="pair">'+pairColHTML(a,'PREX1')+pairColHTML(d,'PREX2')+'</div>';
  var stages=detail.querySelectorAll('.eg-stage'); bloom(stages[0]); bloom(stages[1]);
  _grayTimer=setTimeout(function(){ var cols=detail.querySelectorAll('.col'); if(cols[1]){ var s=cols[1].querySelector('.eg-stage'); if(s) s.classList.add('eg-graying'); } }, 1900);
}
function dLedger(){ detail.innerHTML='<div class="d-center">'+ledgerHTML()+'</div>'; }
// The finale: two sibling groups under the one engine — what it PROVED in this run
// (validated mechanisms, 48/39), and what the same engine ALSO does (four use-cases).
// No lines between them: the use-cases are peer jobs of the engine, not derivatives of
// the Allen result. Step 1 reveals the proven group; step 2 reveals the use-cases.
var UNLOCKS=[
  ['Predict trial failure','the mechanistic reason, before you dose patients'],
  ['Rescue a stalled asset','find the liability, then re-engineer it'],
  ['Patient stratification','who responds, and the mechanism why'],
  ['Drug repurposing','a new indication, backed by mechanism']
];
// Two sibling groups, NOT a fan: the left is what the engine proved in THIS run, the
// right is what the same engine also does. No connecting lines — the four use-cases do
// not derive from the Allen result, they are peer jobs of the one engine (the rail
// header above already brands the whole thing "THE ENGINE").
function unlocksHTML(){
  var cards=UNLOCKS.map(function(u){
    return '<div class="ucard"><div class="ut">'+esc(u[0])+'</div><div class="us">'+esc(u[1])+'</div></div>';
  }).join('');
  return '<div class="unlocks-two">'+
    '<div class="uf-col proven-col">'+
      '<div class="uf-grouplbl proven">In this run</div>'+
      '<div class="uf-hub">'+
        '<div class="uf-l">Validated mechanisms</div>'+
        '<div class="uf-why">48 proven · 39 disproven</div>'+
        '<div class="uf-sub">every verdict traces to its evidence</div></div></div>'+
    '<div class="uf-col cap-col">'+
      '<div class="uf-grouplbl">The same engine also</div>'+
      '<div class="uf-cards">'+cards+'</div></div>'+
  '</div>';
}
function dUnlocks(expanded){
  var wrap=detail.querySelector('.unlocks-two');
  if(!wrap){
    detail.innerHTML='<div class="d-center"><div class="uf-title">What the engine unlocks</div>'+
      unlocksHTML()+
      '<div class="uf-note">None of these work from a prediction alone. They need the mechanism, and that is what the engine gives you.</div></div>';
    wrap=detail.querySelector('.unlocks-two');
  }
  var myAnim=_anim, hub=wrap.querySelector('.uf-hub'), note=detail.querySelector('.uf-note');
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ if(myAnim===_anim && hub) hub.classList.add('in'); }); });
  if(expanded){
    wrap.classList.add('show-cap');
    var cards=wrap.querySelectorAll('.ucard');
    for(var i=0;i<cards.length;i++){ (function(c,idx){ setTimeout(function(){ if(myAnim===_anim) c.classList.add('in'); }, 300+idx*230); })(cards[i],i); }
    setTimeout(function(){ if(myAnim===_anim && note) note.classList.add('in'); }, 300+UNLOCKS.length*230);
  } else {
    wrap.classList.remove('show-cap');
    if(note) note.classList.remove('in');
    var cards=wrap.querySelectorAll('.ucard'); for(var i=0;i<cards.length;i++) cards[i].classList.remove('in');
  }
}

// ============================ deep GENERATE + VALIDATE (the hidden work) ============================
// These steps reveal what the agents actually do, and hint at the complexity
// behind each tool call — the heart of the "verifiable AI" claim.

// ---- Generate: a small mechanism graph that grows as the loop cycles ----
function genGraphSVG(){
  var W=760,H=240,N=22,GA=Math.PI*(3-Math.sqrt(5)),cx=W/2,cy=H/2,sx=W*0.43,sy=H*0.40;
  var PAL=['#3a6fd8','#8b54c6','#b5790f','#2b8a88','#1f9d63','#d8385a'];
  // labels colour-matched to node type (gene / protein / pathway / cell / RNA / phenotype)
  var POOLS=[
    ['NOVA1','CAMTA1','PREX1','PREX2'],
    ['RBFOX1','ELAVL3','hnRNP A1','CELF4'],
    ['alt. splicing','intron retention','Ca²⁺ signaling','vesicle cycle'],
    ['L4 IT','L2/3 IT','astrocyte','microglia'],
    ['CAMTA1-IT1','lncRNA','miR-124'],
    ['synapse loss','neuron death','dendrite loss']
  ];
  var pos=[];
  for(var i=0;i<N;i++){ var rr=Math.sqrt((i+0.5)/N), a=i*GA; pos.push({x:cx+Math.cos(a)*sx*rr, y:cy+Math.sin(a)*sy*rr}); }
  var edges='';
  for(var i=1;i<N;i++){ var j=Math.max(0, i-1-Math.floor(Math.random()*3));
    edges+='<line class="ge" data-to="'+i+'" x1="'+pos[j].x.toFixed(1)+'" y1="'+pos[j].y.toFixed(1)+'" x2="'+pos[i].x.toFixed(1)+'" y2="'+pos[i].y.toFixed(1)+'"/>'; }
  var nodes='', labels='';
  for(var i=0;i<N;i++){
    nodes+='<circle class="gn" data-i="'+i+'" cx="'+pos[i].x.toFixed(1)+'" cy="'+pos[i].y.toFixed(1)+'" r="5" fill="'+PAL[i%PAL.length]+'"/>';
    var lab=POOLS[i%6][Math.floor(i/6)]||'';
    if(lab) labels+='<text class="gnl" data-i="'+i+'" x="'+pos[i].x.toFixed(1)+'" y="'+(pos[i].y-9).toFixed(1)+'" text-anchor="middle">'+esc(lab)+'</text>';
  }
  return '<svg class="gen-graph" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+edges+nodes+labels+'</svg>';
}
// ---- Generate: the Explorer agent's cycle ----
var GL_STAGES=[
  ['Read the data','which genes differ, cell by cell',
   '<span class="gex">NOVA1 ↓ <i>L4 IT</i></span><span class="gex">PREX1 ↑</span><span class="gex">p-adj 0.002</span><span class="gex">1,240 genes shift</span>'],
  ['Mine the literature','what is already known',
   '<span class="gex">12,000+ papers screened</span><span class="gex">“NOVA1 controls neuronal splicing”</span><span class="gex">known resilience markers</span>'],
  ['Build cause→effect chains','gene → protein → pathway → disease',
   '<span class="gchain"><b>NOVA1</b><i>→</i>alternative splicing<i>→</i>synapse loss<i>→</i>neuron death</span>'],
  ['Find the gaps','what is still unexplained',
   '<span class="gex gap">Why do L4 IT 1–4 survive? — no mechanism yet</span>']
];
function dGenLoop(){
  var cards=GL_STAGES.map(function(s,i){
    return (i>0?'<div class="gl-arrow">→</div>':'')+
      '<div class="gl-stage" data-i="'+i+'"><div class="gl-t">'+esc(s[0])+'</div><div class="gl-s">'+esc(s[1])+'</div></div>';
  }).join('');
  detail.innerHTML='<div class="d-center"><div class="genloop"><div class="gl-row">'+cards+'</div>'+
    '<div class="gl-back"><span class="gl-back-line"></span><span class="gl-back-lbl">↻ repeat until the list of plausible hypotheses is exhaustive</span></div>'+
    '<div class="gl-example" id="gl-ex"></div>'+
    '<div class="gl-meter"><span class="gl-cyc">Cycle 1</span><span class="gl-dot">·</span><b class="gl-count">0</b> candidate mechanisms</div>'+
    genGraphSVG()+'</div></div>';
  var myAnim=_anim, stages=detail.querySelectorAll('.gl-stage');
  var cycEl=detail.querySelector('.gl-cyc'), cntEl=detail.querySelector('.gl-count'), exEl=detail.querySelector('#gl-ex');
  // grow the mechanism graph node-by-node across the whole loop duration
  var gns=detail.querySelectorAll('.gen-graph .gn');
  var revMs=Math.max(170, Math.round((STEPS[cur].dur||11000)/(gns.length+2))), gi=0;
  (function grow(){
    if(myAnim!==_anim || gi>=gns.length) return;
    gns[gi].classList.add('on');
    var e=detail.querySelector('.gen-graph .ge[data-to="'+gi+'"]'); if(e) e.classList.add('on');
    var lab=detail.querySelector('.gen-graph .gnl[data-i="'+gi+'"]'); if(lab) lab.classList.add('on');
    gi++; setTimeout(grow, revMs);
  })();
  // Pace the loop to the narration: 2 cycles over the 4 stages span the step
  // duration, so each stage lingers long enough to read its example.
  var LAPS=2, tallies=[80,124];
  var stageMs=Math.max(1100, Math.round((STEPS[cur].dur||11000)/(LAPS*stages.length)));
  function showEx(html){ if(!exEl) return; exEl.classList.remove('show'); exEl.innerHTML=html; void exEl.offsetWidth; exEl.classList.add('show'); }
  var idx=0, lap=0;
  (function tick(){
    if(myAnim!==_anim) return;
    for(var i=0;i<stages.length;i++) stages[i].classList.toggle('on', i===idx);
    showEx(GL_STAGES[idx][2]||'');
    idx++;
    if(idx>=stages.length){
      idx=0; lap++;
      if(cntEl) animateCounter(cntEl, tallies[Math.min(lap-1,tallies.length-1)], 600);
      if(cycEl) cycEl.textContent = lap>=LAPS ? 'Saturated' : ('Cycle '+(lap+1));
      if(lap>=LAPS){
        for(var k=0;k<stages.length;k++) stages[k].classList.add('on');
        showEx('<span class="gex gdone">124 mechanisms — no new ones appearing</span>');
        return;
      }
    }
    setTimeout(tick, stageMs);
  })();
}

// ---- Validate: the loop that decides which tool to use each round ----
var VL_STAGES=[
  ['Find the gap','what is still unproven?'],
  ['Pick the best tool','read papers, run the numbers, or run an experiment'],
  ['Add evidence','new edges, each with its source'],
  ['Score it','seven checks']
];
function vlDiagramHTML(){
  var cards=VL_STAGES.map(function(s,i){
    var tools = i===1 ? '<div class="vl-tools"><span class="vtool lit">Read literature</span><span class="vtool bio">Run the numbers</span><span class="vtool wet">Run an experiment</span></div>' : '';
    return (i>0?'<div class="gl-arrow">→</div>':'')+
      '<div class="vl-stage'+(i===1?' pick':'')+'" data-i="'+i+'"><div class="gl-t">'+esc(s[0])+'</div><div class="gl-s">'+esc(s[1])+'</div>'+tools+'</div>';
  }).join('');
  return '<div class="genloop valloop vl-diagram"><div class="gl-row">'+cards+'</div>'+
    '<div class="gl-back"><span class="gl-back-line"></span><span class="gl-back-lbl">↻ loop until the evidence is enough for a verdict</span></div></div>';
}

// ---- Validate: drill into ONE tool call to reveal the hidden sub-pipeline ----
function revealSteps(stepMs){
  var myAnim=_anim, steps=detail.querySelectorAll('.dstep'), i=0;
  (function reveal(){
    if(myAnim!==_anim || i>=steps.length) return;
    steps[i].classList.add('in'); i++; setTimeout(reveal, stepMs);
  })();
}
function egDrillHTML(){
  return '<div class="drill">'+
    '<div class="drill-call"><span class="mc-dot"></span><span class="mc-tool">evidence_gathering</span>'+
      '<span class="mc-arg">( "NOVA1 · resilient neurons" )</span><span class="mc-tag">one tool call</span></div>'+
    '<div class="drill-body">'+
      '<div class="dstep"><span class="dn">1</span><div class="dtext"><b>Search the literature</b><em>thousands of papers, ranked for relevance</em></div></div>'+
      '<div class="dstep"><span class="dn">2</span><div class="dtext"><b>Keep the open full-text papers</b><em>only what it can actually read in full</em></div></div>'+
      '<div class="dstep"><span class="dn">3</span><div class="dtext"><b>Read them in parallel</b><div class="papers"></div><span class="mini-badge">up to 10 papers at once</span></div></div>'+
      '<div class="dstep"><span class="dn">4</span><div class="dtext"><b>Pull out the hard numbers</b><div class="exchips"><span class="exchip">p = 0.004</span><span class="exchip">log2FC −1.3</span><span class="exchip">cell type: L4 IT</span><span class="exchip">human cortex</span></div></div></div>'+
      '<div class="dstep"><span class="dn">5</span><div class="dtext"><b>Write traceable edges</b><em>every edge keeps its paper and its p-value</em></div></div>'+
    '</div></div>';
}
function bioDrillHTML(){
  return '<div class="drill bio">'+
    '<div class="drill-call bio"><span class="mc-dot"></span><span class="mc-tool">bioinformatic_analysis</span>'+
      '<span class="mc-arg">( "NOVA1 in visual-cortex single-cell" )</span><span class="mc-tag">runs the analysis</span></div>'+
    '<div class="drill-body">'+
      '<div class="dstep"><span class="dn">1</span><div class="dtext"><b>Spin up a cloud machine</b><em>on demand, just for this run</em></div></div>'+
      '<div class="dstep"><span class="dn">2</span><div class="dtext"><b>Load the patient single-cell data</b></div></div>'+
      '<div class="dstep"><span class="dn">3</span><div class="dtext"><b>Compute the statistics</b><em>differential expression · co-expression · enrichment</em></div></div>'+
      '<div class="dstep"><span class="dn">4</span><div class="dtext"><b>Write the result back</b><div class="exchips"><span class="exchip">log2FC +0.9</span><span class="exchip">adj. p = 0.002</span></div></div></div>'+
      '<div class="dstep"><span class="dn">5</span><div class="dtext"><b>Shut the machine down</b><em>no idle cost</em></div></div>'+
    '</div></div>';
}
// The third evidence tool: a real experiment, reached for when the cheaper tools do
// not settle it. The engine designs it and reads it back; only the physical run is
// external (Moustafa: design + readout + graph write-back are in-house).
function wetDrillHTML(){
  return '<div class="drill wet">'+
    '<div class="drill-call wet"><span class="mc-dot"></span><span class="mc-tool">wet_lab_experiment</span>'+
      '<span class="mc-arg">( "NOVA1 knockdown · resilient neurons" )</span>'+
      '<span class="dev-tag">in development</span><span class="mc-tag">commissions a test</span></div>'+
    '<div class="drill-body">'+
      '<div class="dstep"><span class="dn">1</span><div class="dtext"><b>Design the experiment</b><em>the perturbation that would settle the question</em></div></div>'+
      '<div class="dstep"><span class="dn">2</span><div class="dtext"><b>A partner lab runs it</b><span class="mini-badge ext">the only external step</span></div></div>'+
      '<div class="dstep"><span class="dn">3</span><div class="dtext"><b>Read the result back in</b><em>the engine reads the raw readout</em></div></div>'+
      '<div class="dstep"><span class="dn">4</span><div class="dtext"><b>Write new edges into the graph</b><div class="exchips"><span class="exchip">NOVA1 ↓ → survival ↓</span><span class="exchip">causal</span></div></div></div>'+
    '</div></div>';
}

// ---- Validate: the 7 checks + the kill-switch ----
var SCORE_DIMS=['Timing','Location','Effect size','Agreement','Statistics','Model faithfulness','Novelty'];
function scoreHTML(){
  var chips=SCORE_DIMS.map(function(d,i){ return '<span class="sc-chip" style="transition-delay:'+(i*90)+'ms">'+esc(d)+'</span>'; }).join('');
  return '<div class="score-wrap">'+
    '<div class="sc-h">Seven checks score the evidence</div>'+
    '<div class="sc-grid">'+chips+'</div>'+
    '<div class="killswitch"><span class="ks-cond">A key gene shows <b>no effect</b> in the data</span><span class="ks-arrow">→</span><span class="verdict disproven">DISPROVEN</span></div>'+
    '<p class="lede" style="margin-top:4px">It can prove, disprove, or keep looking — it is not a yes-machine.</p>'+
    '</div>';
}
// One renderer for the whole validate phase: the loop diagram stays pinned at the
// top across the sub-steps; each sub-step lights the relevant stage and reveals
// its drill-down below, with the diagram sliding up to make room.
function dValidate(mode){
  var wrap=detail.querySelector('.vwrap');
  if(!wrap){
    detail.innerHTML='<div class="d-center vwrap"><div class="vl-hyp">Testing one hypothesis: <b>NOVA1 protects the neurons that survive</b></div>'+
      vlDiagramHTML()+'<div class="vl-focus" id="vl-focus"></div></div>';
    wrap=detail.querySelector('.vwrap');
  }
  var myAnim=_anim, stages=wrap.querySelectorAll('.vl-stage'), tools=wrap.querySelectorAll('.vtool'), focus=wrap.querySelector('#vl-focus');
  function setHi(active, toolIdx){
    for(var i=0;i<stages.length;i++) stages[i].classList.toggle('on', active.indexOf(i)>=0);
    for(var t=0;t<tools.length;t++) tools[t].classList.toggle('chosen', toolIdx===t);
  }
  if(mode==='loop'){
    wrap.classList.remove('drilled');
    if(focus) focus.innerHTML='';
    var stageMs=Math.max(900, Math.round((STEPS[cur].dur||7500)/stages.length)), idx=0, lap=0;
    (function tick(){
      if(myAnim!==_anim) return;
      setHi([idx], idx===1?(lap%2):-1);
      idx++; if(idx>=stages.length){ idx=0; lap++; }
      setTimeout(tick, stageMs);
    })();
    return;
  }
  wrap.classList.add('drilled');
  if(mode==='eg'){
    setHi([1,2],0); focus.innerHTML=egDrillHTML();
    var pc=focus.querySelector('.papers'); if(pc){ var ph=''; for(var i=0;i<8;i++){ ph+='<span class="paper" style="transition-delay:'+(i*70)+'ms"></span>'; } pc.innerHTML=ph; }
    revealSteps(900);
  } else if(mode==='bio'){
    setHi([1,2],1); focus.innerHTML=bioDrillHTML(); revealSteps(850);
  } else if(mode==='wet'){
    setHi([1,2],2); focus.innerHTML=wetDrillHTML(); revealSteps(850);
  } else {
    setHi([3],-1); focus.innerHTML=scoreHTML();
    var chipsEl=focus.querySelectorAll('.sc-chip'), ks=focus.querySelector('.killswitch');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ if(myAnim!==_anim) return; for(var i=0;i<chipsEl.length;i++) chipsEl[i].classList.add('in'); }); });
    setTimeout(function(){ if(myAnim===_anim && ks) ks.classList.add('in'); }, 1100);
  }
}
// ============================ pipeline rail ============================
var rail=null;
var NODES=[
  {label:'Alzheimer’s', sub:'indication'},
  {label:'Collect data', sub:'discover · unify · annotate', substeps:['discover','unify','annotate']},
  {label:'The question', sub:'vulnerable vs resilient'},
  {label:'Generate', sub:'124 hypotheses'},
  {label:'Validate', sub:'evidence → verdict', substeps:['evidence','bioinformatics','wet lab'], loop:true, dev:['wet lab']}
];
function buildRail(){
  // A full-width header labels the whole pipeline as one engine (Moustafa: "everything
  // is the engine"). It sits on its own wrap row above the nodes, so it survives the
  // rail wrapping on narrow viewports.
  rail.innerHTML='<div class="engine-bracket"><span class="eb-label">The engine</span></div>'+
    NODES.map(function(n,i){
    // A loop node (Validate) lists its tools with a ↻ glyph and lights only the active
    // one — no fixed order, no done-ticks. A sequential node (Collect data) keeps ticks.
    var sub = n.substeps
      ? '<div class="node-sub'+(n.loop?' loop':'')+'">'+(n.loop?'<i class="ss-loop">↻</i>':'')+n.substeps.map(function(s,k){
          // a sub-tool listed in n.dev is not built yet — say so, quietly, on every slide
          var dev=(n.dev||[]).indexOf(s)>=0 ? '<i class="ss-dev">in development</i>' : '';
          return '<span class="ss" data-ss="'+k+'">'+esc(s)+dev+'</span>'; }).join('<i class="ss-sep">·</i>')+'</div>'
      : '<div class="node-s">'+esc(n.sub)+'</div>';
    return (i>0?'<div class="conn" data-ci="'+i+'"></div>':'')+
      '<div class="node'+(n.roadmap?' roadmap':'')+'" data-ni="'+i+'">'+
        '<div class="node-dot"></div><div class="node-l">'+esc(n.label)+'</div>'+sub+'</div>';
  }).join('');
}
function updateRail(curNode){
  // The rail is the five real pipeline phases (indication → validate). It ends
  // at Validate; the finale's unlocks branch off Validate in the detail panel,
  // not as rail nodes.
  // On the finale (unlocks) the pipeline is finished and sits behind the output, so the
  // whole rail goes quiet: every node reads done, none active, and the rail dims.
  var quiet = STEPS[cur] && STEPS[cur].group==='unlocks';
  rail.classList.toggle('rail-quiet', !!quiet);
  var bracket=rail.querySelector('.engine-bracket');
  if(bracket) bracket.classList.toggle('in', curNode>=0);
  var nodes=rail.querySelectorAll('.node');
  for(var i=0;i<nodes.length;i++){ var el=nodes[i], ni=+el.dataset.ni;
    el.classList.toggle('shown', ni<=curNode);
    el.classList.toggle('active', !quiet && ni===curNode);
    el.classList.toggle('done', ni>=0 && (quiet ? ni<=curNode : ni<curNode));
  }
  var conns=rail.querySelectorAll('.conn');
  for(var j=0;j<conns.length;j++){ var c=conns[j], ci=+c.dataset.ci;
    c.classList.toggle('shown', ci<=curNode); }
  // Sub-steps, per node: Collect data is sequential (light current, tick the past);
  // Validate is a loop (light only the tool this round uses, never a done-tick).
  var subVal=STEPS[cur].sub;
  for(var i2=0;i2<nodes.length;i2++){ var host=nodes[i2], hni=+host.dataset.ni;
    var subBox=host.querySelector('.node-sub'); if(!subBox) continue;
    var isLoop=subBox.classList.contains('loop');
    var cur2=(hni===curNode && !quiet) ? subVal : null;
    var ss=subBox.querySelectorAll('.ss');
    for(var k=0;k<ss.length;k++){ var si=+ss[k].dataset.ss;
      if(isLoop){
        ss[k].classList.toggle('on', cur2!=null && si===cur2);
        ss[k].classList.remove('did');
      } else {
        var on=(cur2!=null && si===cur2);
        var did=(hni<curNode) || (cur2!=null && si<cur2);
        ss[k].classList.toggle('on', on);
        ss[k].classList.toggle('did', did && !on);
      }
    }
  }
}

// ============================ steps ============================
var STEPS=[
  {node:-1, group:'intro', cap:'Elman is one engine. For a single disease, it turns thousands of siloed datasets and papers into validated mechanisms.', render:function(){dIntro(false);}},
  {node:-1, group:'intro', cap:'It is integrated and fully traceable — the opposite of today’s slow, siloed workflow.', render:function(){dIntro(true);}},
  {node:0,  group:'indication', cap:'Every run starts with one disease. Here, Alzheimer’s.', render:dIndication},
  {node:1,  sub:0, group:'datasets', cap:'First, the engine collects the data itself — it finds 109 Alzheimer’s datasets.', render:dDatasets},
  {node:1,  sub:1, group:'cohort', cap:'It downloads, cleans and unifies them into one cohort — 3,014 subjects.', render:dCohort},
  {node:1,  sub:2, group:'cells', cap:'Then it labels every cell by type, down to the finest subtypes. In this example, it separates the vulnerable neurons from the resilient ones.', render:dCells, dur:8000},
  {node:2,  group:'question', cap:'Now you ask one focused question. As Alzheimer’s spreads through the visual cortex, some neurons die while their close neighbours survive.', render:function(){dQuestion(false);}},
  {node:2,  group:'question', cap:'Which genes drive that failure, and which ones protect?', render:function(){dQuestion(true);}},
  {node:3,  group:'genloop', cap:'Generating hypotheses is not one prompt. An Explorer agent works in cycles — it reads the data, mines the literature, builds cause-and-effect chains, then looks for what is still unexplained and goes again.', render:dGenLoop, dur:11000},
  {node:3,  group:'explosion', cap:'It keeps going until it has an exhaustive list of plausible hypotheses, drawn from the data and the literature.', render:dExplosion, dur:5200},
  {node:3,  group:'explosion', cap:'In this run, 124 distinct hypotheses.', render:dExplosion},
  {node:4,  group:'validate', cap:'Validating is also a loop. To test one hypothesis, the agent gathers real evidence round after round, each round filling the biggest gap.', render:function(){dValidate('loop');}, dur:7500},
  {node:4,  sub:0, group:'validate', cap:'Round one, read the literature. But one tool call hides a whole sub-pipeline — it searches thousands of papers, reads dozens in parallel, and pulls out every p-value, effect size and cell type.', render:function(){dValidate('eg');}, dur:8800},
  {node:4,  sub:1, group:'validate', cap:'The engine can also run its own bioinformatics analysis. A cloud machine computes the statistics on real patient data, then writes the result back.', render:function(){dValidate('bio');}, dur:7800},
  {node:4,  group:'validate', cap:'Seven checks turn the evidence into a verdict. If a key gene shows no effect, the hypothesis is killed — the engine can say no.', render:function(){dValidate('score');}, dur:6800},
  {node:4,  sub:2, group:'validate', cap:'In the future, when the other tools do not settle it, the engine commissions a wet-lab experiment. It designs the test, a partner lab runs it, then the engine reads the result back into the graph as new evidence.', render:function(){dValidate('wet');}, dur:11200},
  {node:4,  group:'proven', cap:'Every round adds traceable edges. For one proven hypothesis, the full graph: 79 entities, 74 connections, 46 of them supporting.', render:dProven, dur:5800},
  {node:4,  group:'verdict', cap:'All of that work collapses into one plain, traceable verdict.', render:dVerdict, dur:5000},
  {node:4,  group:'pair', cap:'Same logic, sister genes: PREX1 holds up, PREX2 collapses. The engine discriminates — it is not a yes-machine.', render:dPair, dur:7000},
  {node:4,  group:'ledger', cap:'For this Alzheimer’s question, 124 hypotheses tested, 48 proven, 39 disproven — and every verdict traces back to its evidence.', render:dLedger, dur:5200},
  {node:4,  group:'unlocks', cap:'This is the engine today. It turns siloed data and papers into validated mechanisms, each one traceable to its evidence.', render:function(){dUnlocks(false);}},
  {node:4,  group:'unlocks', cap:'The same engine takes on the next jobs: predict a trial failure, rescue a stalled asset, stratify patients, find a new indication. None of them work from a prediction alone — they need the mechanism.', render:function(){dUnlocks(true);}, dur:10900}
];

// ============================ voiceover (baked alloy MP3s, live TTS fallback) ============================
var voiceOn=true, narration=null, _speakGen=0, audioCache={}, _narrStep=-1;
function getNarration(){ if(!narration){ narration=new Audio(); narration.preload='auto'; } return narration; }
function ttsSanitize(t){ return String(t||'').replace(/→/g,' to ').replace(/[·—–]/g,', ').replace(/\s+/g,' ').trim(); }
function hashKey(s){ var h=5381; for(var i=0;i<s.length;i++){ h=((h<<5)+h+s.charCodeAt(i))>>>0; } return h.toString(16); }
function liveTts(spoken){
  return fetch('/studio/tts',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:JSON.stringify({text:spoken,hd:true})})
    .then(function(r){ if(!r.ok) throw new Error('tts post '+r.status); return r.json(); })
    .then(function(d){ if(!d||!d.token) throw new Error('no token'); return fetch('/studio/tts/'+d.token); })
    .then(function(r){ if(!r.ok) throw new Error('tts get '+r.status); return r.blob(); });
}
function getAudioUrl(spoken){
  if(audioCache[spoken]) return audioCache[spoken];
  var p=fetch('/demo/audio/'+hashKey(spoken)+'.mp3')
    .then(function(r){ if(r.ok) return r.blob(); throw new Error('no baked clip'); })
    .catch(function(){ return liveTts(spoken); })
    .then(function(b){ return URL.createObjectURL(b); });
  audioCache[spoken]=p;
  p.catch(function(){ delete audioCache[spoken]; });
  return p;
}
function speakCaption(text, opts){
  opts=opts||{}; var myGen=++_speakGen, n=getNarration();
  try{ n.pause(); n.onended=null; n.onerror=null; }catch(e){}
  var spoken=ttsSanitize(text);
  if(!spoken){ if(opts.onEnd) opts.onEnd(); return; }
  getAudioUrl(spoken).then(function(url){
    if(myGen!==_speakGen) return;
    n.src=url;
    n.onended=function(){ if(myGen===_speakGen && opts.onEnd) opts.onEnd(); };
    n.onerror=function(){ if(myGen===_speakGen && opts.onFail) opts.onFail(); };
    var pr=n.play(); if(pr && pr.catch) pr.catch(function(){ if(myGen===_speakGen && opts.onFail) opts.onFail(); });
  }).catch(function(){ if(myGen===_speakGen && opts.onFail) opts.onFail(); });
}
function cancelNarration(){ _speakGen++; var n=getNarration(); try{ n.pause(); n.onended=null; n.onerror=null; }catch(e){} }
function prefetchNext(){ if(cur<STEPS.length-1){ var cap=STEPS[cur+1].cap; if(cap) getAudioUrl(ttsSanitize(cap)).catch(function(){}); } }

// ============================ controller ============================
var cur=0, playing=false, playTimer=null, _userStarted=false, _anim=0;
var _lingerTimer=null, _transTimer=null, _hasRendered=false;
var LINGER=1000;   // hold the previous step on screen this long before advancing
var EXIT_MS=260;   // collapse-out duration before the new step expands in
// ---- running-time meter (elapsed / total estimate) ----
var _totalMs=0, _elapsedMs=0, _segStart=0, _segShown=0, _tickTimer=null;
function fmtTime(ms){ var s=Math.max(0,Math.round(ms/1000)); return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2); }
function stepEstMs(i){ return (STEPS[i].dur||4200)+LINGER+EXIT_MS; }
function elapsedToStep(i){ var t=0; for(var k=0;k<i;k++) t+=stepEstMs(k); return t; }
function totalEstMs(){ var t=0; for(var k=0;k<STEPS.length;k++) t+=stepEstMs(k); return t; }
function updateTimer(){ var el=$('timer'); if(el) el.textContent=fmtTime(_elapsedMs)+' / '+fmtTime(_totalMs); }
function tick(){ if(!playing) return; _elapsedMs=Math.min(_totalMs,_segShown+(performance.now()-_segStart)); updateTimer(); }
function startTick(){ stopTick(); _segStart=performance.now(); _segShown=_elapsedMs; _tickTimer=setInterval(tick,250); }
function stopTick(){ if(_tickTimer){ clearInterval(_tickTimer); _tickTimer=null; } }
function isLast(){ return cur===STEPS.length-1; }
function isFirst(){ return cur===0; }
function nodeFirstStep(node){ for(var i=0;i<STEPS.length;i++){ if(STEPS[i].node===node) return i; } return 0; }

function setCaption(txt){ var el=$('caption'); if(!el) return; el.classList.add('fade'); setTimeout(function(){ el.textContent=txt||''; el.classList.remove('fade'); }, 160); }
function buildDots(){
  var host=$('dots'); if(!host) return;
  host.innerHTML=NODES.map(function(n,i){ return '<div class="dot-act" data-a="'+i+'"><span class="bar"></span><span class="lbl">'+esc(n.label.split(' ')[0])+'</span></div>'; }).join('');
  Array.prototype.forEach.call(host.querySelectorAll('.dot-act'), function(d){ d.addEventListener('click', function(){ _userStarted=true; pause(); setPosition(nodeFirstStep(+d.dataset.a)); }); });
}
function updateDots(curNode){
  var host=$('dots'); if(!host) return;
  Array.prototype.forEach.call(host.querySelectorAll('.dot-act'), function(d){ var i=+d.dataset.a;
    d.classList.toggle('active', i===curNode); d.classList.toggle('done', i<curNode); });
}
function applyStep(){
  var step=STEPS[cur], node=step.node;
  updateRail(node);
  updateDots(node);
  step.render();
  setCaption(step.cap);
  var bb=$('beatbar'); if(bb) bb.style.width=(((cur+1)/STEPS.length)*100).toFixed(2)+'%';
  var bp=$('btn-prev'), bn=$('btn-next'); if(bp) bp.disabled=isFirst(); if(bn) bn.disabled=isLast();
  // running-time meter: jump to this step's estimated start, then tick within it
  _elapsedMs=elapsedToStep(cur); _segShown=_elapsedMs; _segStart=performance.now(); updateTimer();
}
// Anchor the detail's transform-origin to the active rail node, so new content
// visually "expands" out of the pipeline node it belongs to.
function setDetailOrigin(){
  var node=STEPS[cur].node, activeEl=node>=0?rail.querySelector('.node[data-ni="'+node+'"]'):null;
  if(activeEl){ var nr=activeEl.getBoundingClientRect(), dr=detail.getBoundingClientRect();
    detail.style.transformOrigin=(nr.left+nr.width/2-dr.left).toFixed(0)+'px 0px'; }
  else detail.style.transformOrigin='50% 0px';
}
// Transition into the current step. Different "group" → collapse the old content
// up into the rail, then expand the new content out of its node. Same group
// (e.g. intro→intro, question→question) → a soft crossfade, no big collapse.
function transitionTo(prev){
  var myAnim=_anim;
  var same=STEPS[cur].group && STEPS[prev] && STEPS[cur].group===STEPS[prev].group;
  if(same && (STEPS[cur].group==='intro' || STEPS[cur].group==='explosion' || STEPS[cur].group==='question' || STEPS[cur].group==='validate' || STEPS[cur].group==='unlocks')){
    // additive: the structure stays on screen (question card, or the pinned
    // validate loop diagram), and the renderer animates the change itself.
    // Clear any leftover transition class from a morph this click interrupted,
    // or the panel could stay hidden (opacity:0) under fast manual stepping.
    detail.classList.remove('to-out','to-in','soft-out');
    applyStep();
    advanceControl();
    return;
  }
  if(same){
    applyStep();
    detail.classList.remove('to-in','to-out');
    detail.classList.add('no-trans','soft-out'); void detail.offsetWidth; detail.classList.remove('no-trans');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ if(myAnim===_anim) detail.classList.remove('soft-out'); }); });
    advanceControl();
    return;
  }
  detail.classList.remove('to-in','soft-out');
  detail.classList.add('to-out');
  _transTimer=setTimeout(function(){
    if(myAnim!==_anim) return; _transTimer=null;
    applyStep();
    setDetailOrigin();
    pulseRail(STEPS[cur].node);  // fire the connector + node the content emerges from
    detail.classList.add('no-trans'); detail.classList.remove('to-out'); detail.classList.add('to-in');
    void detail.offsetWidth; detail.classList.remove('no-trans');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ if(myAnim===_anim) detail.classList.remove('to-in'); }); });
    advanceControl();
  }, EXIT_MS);
}
// Signature "engine" touch: when a new node activates, send a light pulse along
// the connector leading into it and fire the node's dot — so the detail panel
// reads as energy flowing down the one pipeline into the node it expands from.
function oneShot(el, cls, ms){
  if(!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  // cleanup is NOT _anim-gated: under fast manual stepping the class must still
  // clear (otherwise a flowed connector stays stuck showing the gradient).
  setTimeout(function(){ el.classList.remove(cls); }, ms);
}
function pulseRail(node){
  if(!rail || node==null || node<0) return;
  var conn=rail.querySelector('.conn[data-ci="'+node+'"]');
  if(conn && conn.classList.contains('shown')) oneShot(conn, 'flow', 760);
  oneShot(rail.querySelector('.node[data-ni="'+node+'"] .node-dot'), 'fire', 800);
}
function advanceControl(){
  if(playTimer){ clearTimeout(playTimer); playTimer=null; }
  // Only narrate while PLAYING. Manual stepping (arrows / Next-Back) is silent,
  // so a presenter can talk over the slides like a deck.
  if(playing && voiceOn && _userStarted){
    prefetchNext();
    _narrStep=cur;
    speakCaption(STEPS[cur].cap, {
      onEnd: function(){ if(!(playing&&voiceOn)) return; if(isLast()){ playing=false; cancelNarration(); updatePlayBtn(); } else lingerThenNext(); },
      onFail: function(){ if(playing&&voiceOn) scheduleNext(); }
    });
  } else if(playing){ scheduleNext(); }
}
// Resume the current step's narration from where it was paused, instead of
// restarting it. Returns false if there's nothing to resume (then speak fresh).
function resumeNarration(){
  if(!(voiceOn && _userStarted)) return false;
  var n=getNarration();
  if(_narrStep!==cur || !n.src || n.ended || !isFinite(n.duration) || n.currentTime<=0 || n.currentTime>=n.duration) return false;
  var myGen=++_speakGen;
  n.onended=function(){ if(myGen!==_speakGen || !(playing&&voiceOn)) return; if(isLast()){ playing=false; cancelNarration(); updatePlayBtn(); } else lingerThenNext(); };
  n.onerror=function(){ if(myGen===_speakGen && playing && voiceOn) scheduleNext(); };
  var pr=n.play(); if(pr && pr.catch) pr.catch(function(){ if(myGen===_speakGen && playing && voiceOn) scheduleNext(); });
  return true;
}
function setPosition(i){
  i=Math.max(0,Math.min(STEPS.length-1,i));
  var prev=cur;
  cur=i;
  _anim++;  // invalidate any in-flight step animation (loops/reveals stop on next tick)
  if(_grayTimer){ clearTimeout(_grayTimer); _grayTimer=null; }
  if(playTimer){ clearTimeout(playTimer); playTimer=null; }
  if(_lingerTimer){ clearTimeout(_lingerTimer); _lingerTimer=null; }
  if(_transTimer){ clearTimeout(_transTimer); _transTimer=null; }
  if(_hasRendered && prev!==i){ transitionTo(prev); }
  else { applyStep(); advanceControl(); }
  _hasRendered=true;
}
function scheduleNext(){
  if(playTimer){ clearTimeout(playTimer); playTimer=null; }
  if(isLast()){ playing=false; updatePlayBtn(); return; }
  var dur=STEPS[cur].dur||4200;
  playTimer=setTimeout(function(){ if(playing) next(); }, dur);
}
// Hold the finished step on screen for LINGER ms, then advance (voice-on path).
function lingerThenNext(){
  if(_lingerTimer){ clearTimeout(_lingerTimer); }
  // Skip the hold when the next step just continues the same group (the UI barely
  // changes, e.g. the question card → its vulnerable/resilient split) — flow straight in.
  var nx=cur+1, same=nx<STEPS.length && STEPS[nx].group && STEPS[cur].group===STEPS[nx].group;
  if(same){ _lingerTimer=null; if(playing && voiceOn) next(); return; }
  _lingerTimer=setTimeout(function(){ _lingerTimer=null; if(playing && voiceOn) next(); }, LINGER);
}
function next(){ if(!isLast()) setPosition(cur+1); }
function prev(){ if(!isFirst()) setPosition(cur-1); }
function updatePlayBtn(){ var b=$('btn-play'); if(b) b.textContent=playing?'⏸ Pause':'▶ Play'; }
function play(){ _userStarted=true; playing=true; updatePlayBtn(); startTick(); if(isLast()){ setPosition(0); } else if(!resumeNarration()){ advanceControl(); } }
function pause(){ playing=false; cancelNarration(); if(playTimer){ clearTimeout(playTimer); playTimer=null; } if(_lingerTimer){ clearTimeout(_lingerTimer); _lingerTimer=null; } stopTick(); updatePlayBtn(); }
function togglePlay(){ if(playing) pause(); else play(); }

function wireControls(){
  var bp=$('btn-prev'), bn=$('btn-next'), bpl=$('btn-play'), br=$('btn-restart');
  if(bp) bp.addEventListener('click', function(){ _userStarted=true; pause(); prev(); });
  if(bn) bn.addEventListener('click', function(){ _userStarted=true; pause(); next(); });
  if(bpl) bpl.addEventListener('click', function(){ _userStarted=true; togglePlay(); });
  if(br) br.addEventListener('click', function(){ _userStarted=true; pause(); setPosition(0); });
  document.addEventListener('keydown', function(e){
    if(e.key==='ArrowRight'){ e.preventDefault(); _userStarted=true; pause(); next(); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); _userStarted=true; pause(); prev(); }
    else if(e.key===' '||e.code==='Space'){ e.preventDefault(); _userStarted=true; togglePlay(); }
  });
}

// The story is a fixed full-screen presentation; browser zoom (cmd/ctrl +/-)
// shrinks the layout viewport and makes the fixed-size rail/headings overflow.
// Block the zoom shortcuts and ctrl/pinch wheel so it always renders at 100%.
// (Reset, cmd/ctrl-0, is left alone; menu-driven zoom can't be blocked by JS.)
function lockZoom(){
  window.addEventListener('keydown', function(e){
    if((e.ctrlKey||e.metaKey) && ['+','-','=','_'].indexOf(e.key)>=0) e.preventDefault();
  }, {passive:false});
  window.addEventListener('wheel', function(e){ if(e.ctrlKey) e.preventDefault(); }, {passive:false});
  window.addEventListener('gesturestart', function(e){ e.preventDefault(); });
  window.addEventListener('gesturechange', function(e){ e.preventDefault(); });
}
function init(){
  detail=$('detail'); rail=$('rail');
  lockZoom();
  buildRail();
  buildDots();
  wireControls();
  _totalMs=totalEstMs(); _elapsedMs=0; updateTimer();
  fetch(window.STORY_DATA_URL)
    .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(d){ DATA=d; HEROES=d.heroes||{}; setPosition(0); })
    .catch(function(err){ var cap=$('caption'); if(cap) cap.textContent='Could not load story data: '+err.message; DATA={hypotheses:[],counts:{},counts_raw:{},discovery:{}}; HEROES={}; setPosition(0); });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
