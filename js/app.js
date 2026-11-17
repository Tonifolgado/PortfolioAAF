/* PortfolioAAF · lógica del panel: cálculos, tablas, gráficos, formularios y exportación a Excel. */
(() => {
const $ = s => document.querySelector(s);
const eur = (v, d = 0) => (v ?? 0).toLocaleString('de-DE', {minimumFractionDigits: d, maximumFractionDigits: d}) + ' €';
const num = (v, d = 2) => (v ?? 0).toLocaleString('de-DE', {minimumFractionDigits: d, maximumFractionDigits: d});
const pct = (v, d = 1) => (v >= 0 ? '+' : '') + num(v * 100, d) + ' %';
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const today = new Date().toISOString().slice(0, 10);

const S = {docs: {}, loaded: false, db: null, canWrite: true, view: 'resumen', collapsed: new Set()};
try{JSON.parse(localStorage.getItem('collapsed')||'[]').forEach(g=>S.collapsed.add(g))}catch(e){}
const charts = {};
if(window.Chart){Chart.defaults.font.family='"IBM Plex Sans", "Segoe UI", system-ui, sans-serif';}

function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,Math.max(3200,msg.length*70))}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function tok(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()}

/* ---------- derived data ---------- */
function meta(){return S.docs.meta||{catalog:{},prices:{}}}
function orders(){return Object.entries(S.docs).filter(([k])=>k.startsWith('orders-')).flatMap(([k,d])=>(d.rows||[]).map(r=>({...r,_doc:k}))).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.id<b.id?-1:1)}
function divs(){return Object.entries(S.docs).filter(([k])=>k.startsWith('divs-')).flatMap(([k,d])=>(d.rows||[]).map(r=>({...r,_doc:k}))).sort((a,b)=>a.date<b.date?-1:1)}
function plansDoc(){return S.docs.plans||{plans:{},snapshots:[]}}
function plans(){return Object.entries(plansDoc().plans||{}).map(([id,p])=>{const value=(+p.units||0)*(+p.nav||0), c=p.contributed==null||p.contributed===''?null:+p.contributed;return {id,...p,value,contributed:c,pl:c!=null?value-c:null}}).sort((a,b)=>(a.order||9)-(b.order||9))}
function info(t){const c=meta().catalog[t]||{};return {name:c.name||t,kind:c.kind||'Acción',sector:c.sector||'',region:c.region||'',broker:c.broker||''}}

function positions(){
  const P={};
  for(const o of orders()){
    if(o.type==='fee'||!o.ticker)continue;
    const p=P[o.ticker]??={ticker:o.ticker,qty:0,cost:0,cost0:0,fees:0,realized:0,n:0,first:o.date,last:o.date,lastPrice:o.price};
    p.fees+=+o.fee||0;p.n++;p.last=o.date;p.lastPrice=o.price;
    if(o.type==='buy'){p.qty+=+o.qty;p.cost+=o.qty*o.price+(+o.fee||0);p.cost0+=o.qty*o.price}
    else{const avg=p.qty?p.cost/p.qty:0;const q=Math.min(+o.qty,p.qty);p.cost0-=(p.qty?p.cost0/p.qty:0)*q;p.realized+=q*o.price-(+o.fee||0)-avg*q;p.cost-=avg*q;p.qty-=q}
  }
  const D=divs(), cut=new Date(Date.now()-365*864e5).toISOString().slice(0,10), prices=meta().prices||{};
  for(const p of Object.values(P)){
    if(Math.abs(p.qty)<1e-9){p.qty=0;p.cost=0;p.cost0=0}
    const pr=prices[p.ticker];p.ref=pr?.price??p.lastPrice;p.refDate=pr?.date??p.last;p.refSrc=pr?.src??'última orden';
    p.value=p.qty*p.ref;p.pl=p.value-p.cost;
    p.div=D.filter(d=>d.ticker===p.ticker).reduce((s,d)=>s+ +d.amount,0);
    p.div12=D.filter(d=>d.ticker===p.ticker&&d.date>cut).reduce((s,d)=>s+ +d.amount,0);
  }
  return Object.values(P);
}
function yearly(){
  const Y={};
  for(const o of orders()){const y=o.date.slice(0,4);const r=Y[y]??={net:0,fees:0,n:0,div:0};
    r.fees+=+o.fee||0; if(o.type!=='fee'){r.n++;r.net+=(o.type==='buy'?1:-1)*o.qty*o.price}}
  for(const d of divs()){const y=d.date.slice(0,4);(Y[y]??={net:0,fees:0,n:0,div:0}).div+=+d.amount}
  return Object.keys(Y).sort().map(y=>({year:y,...Y[y]}));
}

/* ---------- KPIs ---------- */
function renderKpis(){
  const P=positions().filter(p=>p.qty>0);
  const cost=P.reduce((s,p)=>s+p.cost,0), val=P.reduce((s,p)=>s+p.value,0);
  const D=divs(), divT=D.reduce((s,d)=>s+ +d.amount,0);
  const cut=new Date(Date.now()-365*864e5).toISOString().slice(0,10);
  const div12=D.filter(d=>d.date>cut).reduce((s,d)=>s+ +d.amount,0);
  const fees=orders().reduce((s,o)=>s+(+o.fee||0),0);
  const gross=orders().filter(o=>o.type==='buy').reduce((s,o)=>s+o.qty*o.price,0);
  const PL=plans(), pv=PL.reduce((s,p)=>s+p.value,0);
  const big=[
    ['Total invertido en bolsa',eur(cost),`${P.length} posiciones · valor de referencia ${eur(val)}`],
    ['Total planes y fondos',eur(pv),`${PL.length} productos · valor actual`],
  ];
  $('#patri').innerHTML=`<span class="lbl">Patrimonio total</span><span class="v">${eur(pv+val)}</span><span class="s">bolsa ${eur(val)} (valor ref.) + planes y fondos ${eur(pv)}</span>`;
  const k=[
    ['Bolsa: valor ref.',eur(val),'precios de la pestaña Posiciones'],
    ['Plusvalía latente',`<span class="${val-cost>=0?'pos':'neg'}">${eur(val-cost)}</span>`,cost?pct(val/cost-1):''],
    ['Dividendos cobrados',eur(divT),'brutos, desde el inicio'],
    ['Dividendos 12 meses',eur(div12),cost?`${num(div12/cost*100,2)} % sobre coste`:''],
    ['Comisiones y custodia',`<span class="neg">${eur(fees)}</span>`,gross?`${num(fees/gross*100,1)} % de lo comprado`:''],
  ];
  const tile=([l,v,s],cls='')=>`<div class="kpi${cls}"><span class="eyebrow">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`;
  $('#kpis').innerHTML=`<div class="kpis main">${big.map(x=>tile(x,' big')).join('')}</div><div class="kpis">${k.map(x=>tile(x)).join('')}</div>`;
}

/* ---------- charts ---------- */
function baseOpts(extra={}){
  const fg=tok('--muted'), grid=tok('--line');
  return Object.assign({responsive:true,maintainAspectRatio:false,animation:false,
    plugins:{legend:{labels:{color:fg,boxWidth:12,font:{family:'IBM Plex Sans'}}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${eur(c.parsed.y??c.parsed.x,0)}`}}},
    scales:{x:{ticks:{color:fg},grid:{display:false}},y:{ticks:{color:fg,callback:v=>v.toLocaleString('de-DE')},grid:{color:grid}}}},extra);
}
function draw(id,cfg){charts[id]?.destroy();if(!window.Chart)return;charts[id]=new Chart($('#'+id),cfg)}
function renderResumen(){
  const Y=yearly();
  draw('chYear',{type:'bar',data:{labels:Y.map(y=>y.year),datasets:[
    {label:'Aportación neta',data:Y.map(y=>Math.round(y.net)),backgroundColor:tok('--c1'),borderRadius:3},
    {label:'Dividendos',data:Y.map(y=>Math.round(y.div)),backgroundColor:tok('--c2'),borderRadius:3},
    {label:'Comisiones',data:Y.map(y=>Math.round(y.fees)),backgroundColor:tok('--bad'),borderRadius:3}]},options:baseOpts()});
  const D=divs(), years=[...new Set(D.map(d=>d.date.slice(0,4)))].sort();
  const pal=['--c5','--c3','--c4','--c2','--c1'];
  const cur=today.slice(0,7);
  draw('chCum',{type:'line',data:{labels:MONTHS,datasets:years.map((y,i)=>{let acc=0;const data=MONTHS.map((_,m)=>{const key=`${y}-${String(m+1).padStart(2,'0')}`;if(key>cur)return null;acc+=D.filter(d=>d.date.startsWith(key)).reduce((s,d)=>s+ +d.amount,0);return Math.round(acc*100)/100});
      const c=tok(pal[(pal.length-years.length+i+pal.length)%pal.length]);return {label:y,data,borderColor:c,backgroundColor:c,pointRadius:0,borderWidth:i===years.length-1?3:1.6,tension:.15,spanGaps:false}})},options:baseOpts()});
  const SN=plansDoc().snapshots||[], pcol=['--c4','--c2','--c3','--c5'], series=[['bolsa','ETF y acciones','--c1'],...plans().map((p,i)=>[p.id,p.name,pcol[i%pcol.length]])];
  draw('chEvo',{type:'bar',data:{labels:SN.map(s=>s.label),datasets:series.map(([k,l,c])=>({label:l,data:SN.map(s=>s[k]??0),backgroundColor:tok(c),borderRadius:2}))},
    options:baseOpts({scales:{x:{stacked:true,ticks:{color:tok('--muted')},grid:{display:false}},y:{stacked:true,ticks:{color:tok('--muted'),callback:v=>v.toLocaleString('de-DE')},grid:{color:tok('--line')}}}})});
  const W=[...positions().filter(p=>p.qty>0).map(p=>({label:`${p.ticker} · ${info(p.ticker).name}`,v:p.value,c:info(p.ticker).kind==='ETF'?'--c1':'--c5'})),...plans().map(p=>({label:p.name,v:p.value,c:'--c4'}))].sort((a,b)=>b.v-a.v);
  const tot=W.reduce((s,w)=>s+w.v,0);
  draw('chWeight',{type:'bar',data:{labels:W.map(w=>w.label),datasets:[{label:'Valor',data:W.map(w=>Math.round(w.v)),backgroundColor:W.map(w=>tok(w.c)),borderRadius:3}]},
    options:baseOpts({indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${eur(c.parsed.x)} · ${num(c.parsed.x/tot*100,1)} %`}}},
      scales:{x:{ticks:{color:tok('--muted')},grid:{color:tok('--line')}},y:{ticks:{color:tok('--fg'),font:{size:11}},grid:{display:false}}}})});
}

/* ---------- positions ---------- */
function renderPos(){
  const all=positions(), P=all.filter(p=>p.qty>0).sort((a,b)=>b.value-a.value), PL=plans();
  const totV=P.reduce((s,p)=>s+p.value,0)+PL.reduce((s,p)=>s+p.value,0);
  const dis=S.canWrite?'':'disabled';
  const wcell=v=>{const w=totV?v/totV:0;return `<td class="n"><div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">${num(w*100,1)} %<div class="bar" style="width:60px"><i style="width:${Math.min(100,w*100/25*100)}%"></i></div></div></td>`};
  const stockRow=p=>{const i=info(p.ticker), plp=p.cost?p.value/p.cost-1:0;
    return `<tr><td><span class="tk">${esc(p.ticker)}</span>${meta().catalog?.[p.ticker]?.flag?` <span class="chip flag">${esc(meta().catalog[p.ticker].flag)}</span>`:''}<span class="nm">${esc(i.name)} · ${esc(i.broker)}</span></td>
    <td class="n">${num(p.qty,0)}</td><td class="n">${num(p.cost/p.qty)}</td><td class="n">${eur(p.cost)}</td>
    <td class="n"><input class="price" type="number" step="any" data-t="${esc(p.ticker)}" id="px-${esc(p.ticker)}" value="${p.ref}" ${dis} aria-label="Precio de referencia ${esc(p.ticker)}"><span class="nm" style="text-align:right">${esc(p.refSrc)} · ${p.refDate.split('-').reverse().join('/')}</span></td>
    <td class="n">${eur(p.value)}</td><td class="n ${plp>=0?'pos':'neg'}">${pct(plp)}</td>
    <td class="n">${eur(p.div,2)}</td><td class="n">${eur(p.div12,2)}<span class="nm">${p.cost?num(p.div12/p.cost*100,1)+' % s/coste':''}</span></td>
    <td class="n">${num(p.fees/(p.cost||1)*100,1)} %</td>${wcell(p.value)}</tr>`};
  const sumS=L=>L.reduce((a,p)=>({c:a.c+p.cost,v:a.v+p.value,d:a.d+p.div,d12:a.d12+p.div12,f:a.f+p.fees}),{c:0,v:0,d:0,d12:0,f:0});
  const subS=(label,T)=>`<tr class="sub"><td>${label}</td><td></td><td></td><td class="n">${eur(T.c)}</td><td></td><td class="n">${eur(T.v)}</td><td class="n ${T.v>=T.c?'pos':'neg'}">${T.c?pct(T.v/T.c-1):''}</td><td class="n">${eur(T.d,2)}</td><td class="n">${eur(T.d12,2)}</td><td class="n">${num(T.f/(T.c||1)*100,1)} %</td>${wcell(T.v)}</tr>`;
  const planRow=p=>{const id=esc(p.id);
    return `<tr><td><span class="tk">${esc(p.name)}</span> <span class="chip">${esc(p.kind)}</span><span class="nm">${esc(p.manager)} · acumulación</span></td>
    <td class="n"><input class="plan" type="number" step="any" data-id="${id}" data-f="units" id="pu-${id}" value="${p.units??''}" ${dis} aria-label="Participaciones ${esc(p.name)}"></td>
    <td class="n">${p.contributed!=null&&p.units?num(p.contributed/p.units):'—'}</td>
    <td class="n"><input class="plan" type="number" step="any" data-id="${id}" data-f="contributed" id="pc-${id}" value="${p.contributed??''}" placeholder="aportado" ${dis} aria-label="Aportado a ${esc(p.name)}"></td>
    <td class="n"><input class="plan" type="number" step="any" data-id="${id}" data-f="nav" id="pn-${id}" value="${p.nav??''}" ${dis} aria-label="Valor liquidativo ${esc(p.name)}"><span class="nm" style="text-align:right">${esc(p.navSrc||'manual')} · ${(p.navDate||'').split('-').reverse().join('/')}</span></td>
    <td class="n"><input class="plan" type="number" step="any" data-id="${id}" data-f="value" id="pv-${id}" value="${Math.round(p.value*100)/100}" ${dis} aria-label="Valor total ${esc(p.name)}"></td><td class="n ${p.pl==null?'muted':p.pl>=0?'pos':'neg'}">${p.pl==null?'falta aportado':pct(p.value/p.contributed-1)}</td>
    <td class="n muted">no reparte</td><td class="n muted">—</td><td class="n muted">—</td>${wcell(p.value)}</tr>`};
  const E=P.filter(p=>info(p.ticker).kind==='ETF'), A=P.filter(p=>info(p.ticker).kind!=='ETF');
  const TE=sumS(E), TA=sumS(A), TB=sumS(P);
  const pv=PL.reduce((s,p)=>s+p.value,0), known=PL.filter(p=>p.contributed!=null), pc=known.reduce((s,p)=>s+p.contributed,0), pvk=known.reduce((s,p)=>s+p.value,0);
  const grp=(g,t,n)=>{const open=!S.collapsed.has(g);return `<tr class="grp"><td colspan="11"><button type="button" class="gtoggle" data-g="${g}" aria-expanded="${open}"><span class="chev" aria-hidden="true">▸</span>${t} <span class="muted" style="font-family:var(--f-body);font-weight:500">· ${n}</span></button></td></tr>`};
  const inG=(g,html)=>S.collapsed.has(g)?html.replaceAll('<tr>',`<tr data-g="${g}" hidden>`):html.replaceAll('<tr>',`<tr data-g="${g}">`);
  const head=`<thead><tr><th>Activo</th><th class="n">Acciones / partic.</th><th class="n">Coste medio</th><th class="n">Invertido</th><th class="n">Precio ref. / VL</th><th class="n">Valor</th><th class="n">Plusvalía</th><th class="n">Dividendos</th><th class="n">Div. 12 m</th><th class="n">Comis./coste</th><th class="n">Peso</th></tr></thead>`;
  let body='';
  if(E.length)body+=grp('etf','ETF',`${E.length} posiciones · ${eur(TE.v)}`)+inG('etf',E.map(stockRow).join(''))+subS('Subtotal ETF',TE);
  if(A.length)body+=grp('acc','Acciones',`${A.length} posiciones · ${eur(TA.v)}`)+inG('acc',A.map(stockRow).join(''))+subS('Subtotal acciones',TA);
  if(P.length)body+=subS('Total bolsa',TB).replace('class="sub"','class="sub grand"');
  if(PL.length)body+=grp('plan','Planes de pensiones y fondos',`${PL.length} productos · ${eur(pv)}`)+inG('plan',PL.map(planRow).join(''))+
    `<tr class="sub"><td>Subtotal planes y fondo</td><td></td><td></td><td class="n">${known.length?eur(pc)+(known.length<PL.length?' *':''):'—'}</td><td></td><td class="n">${eur(pv)}</td><td class="n ${pvk>=pc?'pos':'neg'}">${known.length?pct(pvk/pc-1):''}</td><td></td><td></td><td></td>${wcell(pv)}</tr>`;
  body+=`<tr class="grand"><td>Total patrimonio invertido</td><td></td><td></td><td></td><td></td><td class="n">${eur(totV)}</td><td></td><td class="n">${eur(TB.d,2)}</td><td class="n">${eur(TB.d12,2)}</td><td></td><td class="n">100 %</td></tr>`;
  $('#tPos').innerHTML=(P.length||PL.length)?head+`<tbody>${body}</tbody>`:`<tbody><tr><td class="empty">Aún no hay posiciones. Registra tu primera compra en «Compras y ventas».</td></tr></tbody>`;
  const C=all.filter(p=>p.qty===0);
  $('#tClosed').innerHTML=C.length?`<thead><tr><th>Activo</th><th class="n">Órdenes</th><th class="n">Última</th><th class="n">Resultado realizado</th></tr></thead><tbody>${C.map(p=>`<tr><td><span class="tk">${esc(p.ticker)}</span><span class="nm">${esc(info(p.ticker).name)}</span></td><td class="n">${p.n}</td><td class="n">${p.last.split('-').reverse().join('/')}</td><td class="n ${p.realized>=0?'pos':'neg'}">${eur(p.realized,2)}</td></tr>`).join('')}</tbody>`:`<tbody><tr><td class="empty">Sin posiciones cerradas.</td></tr></tbody>`;
}
/* ---------- orders ---------- */
function fillSelect(sel,opts,keep){const v=sel.value;sel.innerHTML=opts.map(([val,l])=>`<option value="${esc(val)}">${esc(l)}</option>`).join('');if([...sel.options].some(o=>o.value===v))sel.value=v;else if(keep!=null)sel.value=keep}
function renderOrders(){
  const O=orders();
  fillSelect($('#fYear'),[['','Todos los años'],...[...new Set(O.map(o=>o.date.slice(0,4)))].sort().reverse().map(y=>[y,y])]);
  fillSelect($('#fTk'),[['','Todos los activos'],...[...new Set(O.map(o=>o.ticker).filter(Boolean))].sort().map(t=>[t,`${t} · ${info(t).name}`])]);
  const y=$('#fYear').value,t=$('#fTk').value;
  const L=O.filter(o=>(!y||o.date.startsWith(y))&&(!t||o.ticker===t)).reverse();
  const lab={buy:'Compra',sell:'Venta',fee:'Gasto'};
  $('#tOrders').innerHTML=`<thead><tr><th>Fecha</th><th>Tipo</th><th>Activo</th><th class="n">Acciones</th><th class="n">Precio</th><th class="n">Importe</th><th class="n">Comisión</th><th class="n">% comisión</th><th></th></tr></thead><tbody>${
    L.map(o=>{const imp=o.qty*o.price;return `<tr><td class="n" style="text-align:left">${o.date.split('-').reverse().join('/')}</td><td><span class="chip ${o.type}">${lab[o.type]}</span></td>
    <td>${o.ticker?`<span class="tk">${esc(o.ticker)}</span><span class="nm">${esc(info(o.ticker).name)}</span>`:esc(o.note||'')}</td>
    <td class="n">${o.type==='fee'?'':num(o.qty,0)}</td><td class="n">${o.type==='fee'?'':num(o.price,3)}</td><td class="n">${o.type==='fee'?'':eur(imp,2)}</td>
    <td class="n">${eur(+o.fee,2)}</td><td class="n ${imp&&o.fee/imp>0.02?'neg':''}">${imp?num(o.fee/imp*100,1)+' %':''}</td>
    <td>${S.canWrite?`<button class="btn ghost" data-del="${o._doc}|${o.id}">Borrar</button>`:''}</td></tr>`}).join('')||`<tr><td colspan="9" class="empty">No hay órdenes con este filtro.</td></tr>`}</tbody>
    <tfoot><tr><td colspan="3">${L.length} movimientos</td><td class="n" title="Acciones compradas menos vendidas">${(()=>{const bq=L.filter(o=>o.type==='buy').reduce((s,o)=>s+ +o.qty,0),sq=L.filter(o=>o.type==='sell').reduce((s,o)=>s+ +o.qty,0);return `${num(bq-sq,0)}<span class="nm" style="text-align:right;font-weight:400">${sq?`${num(bq,0)} compradas · ${num(sq,0)} vendidas`:'compradas'}</span>`})()}</td><td></td><td class="n">${eur(L.filter(o=>o.type!=='fee').reduce((s,o)=>s+(o.type==='buy'?1:-1)*o.qty*o.price,0),2)}</td><td class="n">${eur(L.reduce((s,o)=>s+(+o.fee||0),0),2)}</td><td colspan="2"></td></tr></tfoot>`;
}

/* ---------- dividends ---------- */
function renderDivs(){
  const D=divs(), years=[...new Set(D.map(d=>d.date.slice(0,4)))].sort().reverse();
  fillSelect($('#dYear'),years.map(y=>[y,`Año ${y}`]),years[0]);
  const y=$('#dYear').value, Dy=D.filter(d=>d.date.startsWith(y));
  const ae=document.activeElement, keep=ae&&ae.id&&(ae.closest('#tDivMatrix')||ae.closest('#tDivs'))?{id:ae.id,v:ae.value}:null;
  const tks=[...new Set(Dy.map(d=>d.ticker))].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
  const pays=(t,m)=>Dy.filter(d=>d.ticker===t&&+d.date.slice(5,7)===m);
  const cell=(t,m)=>pays(t,m).reduce((s,d)=>s+ +d.amount,0);
  const mt=MONTHS.map((_,i)=>Dy.filter(d=>+d.date.slice(5,7)===i+1).reduce((s,d)=>s+ +d.amount,0));
  const maxC=Math.max(1,...tks.flatMap(t=>MONTHS.map((_,i)=>cell(t,i+1))));
  const dis=S.canWrite?'':'disabled';
  const mcell=(t,m)=>{const P=pays(t,m), v=cell(t,m), bg=v?`background:color-mix(in srgb, var(--gold) ${Math.round(8+v/maxC*40)}%, transparent)`:'';
    const id=`dm-${t}-${m}`;
    if(P.length>1)return `<td class="n" style="${bg}"><button type="button" class="multi" data-goto="${esc(t)}|${m}" title="${P.length} cobros este mes: edítalos en la lista de abajo">${num(v)}<sup>${P.length}</sup></button></td>`;
    return `<td class="n" style="${bg}"><input class="dcell" id="${esc(id)}" inputmode="decimal" data-t="${esc(t)}" data-m="${m}" value="${v?num(v):''}" ${dis} aria-label="${esc(info(t).name)} ${MONTHS[m-1]} ${y}"></td>`};
  $('#tDivMatrix').innerHTML=tks.length?`<thead><tr><th>Activo</th>${MONTHS.map(m=>`<th class="n">${m}</th>`).join('')}<th class="n">Total</th></tr></thead><tbody>${tks.map(t=>`<tr><td><span class="tk">${esc(t)}</span><span class="nm">${esc(info(t).name)}</span></td>${MONTHS.map((_,i)=>mcell(t,i+1)).join('')}<td class="n"><b>${num(Dy.filter(d=>d.ticker===t).reduce((s,d)=>s+ +d.amount,0))}</b></td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Total</td>${mt.map(v=>`<td class="n">${v?num(v):''}</td>`).join('')}<td class="n">${num(mt.reduce((a,b)=>a+b,0))}</td></tr></tfoot>`:`<tbody><tr><td class="empty">No hay dividendos registrados este año.</td></tr></tbody>`;
  $('#tDivs').innerHTML=`<thead><tr><th>Fecha</th><th>Activo</th><th class="n">Importe (€)</th><th></th></tr></thead><tbody>${[...Dy].reverse().map(d=>{const k=`${d._doc}|${d.id}`;return `<tr data-row="${esc(d.ticker)}|${+d.date.slice(5,7)}">
    <td><input class="dl" type="date" id="dd-${d.id}" data-k="${k}" data-f="date" value="${d.date}" ${dis} aria-label="Fecha"></td>
    <td><input class="dl tkin" id="dt-${d.id}" data-k="${k}" data-f="ticker" list="tickers" value="${esc(d.ticker)}" ${dis} aria-label="Ticker"> <span class="muted">${esc(info(d.ticker).name)}</span></td>
    <td class="n"><input class="dl amt" id="da-${d.id}" data-k="${k}" data-f="amount" inputmode="decimal" value="${num(+d.amount)}" ${dis} aria-label="Importe"></td>
    <td>${S.canWrite?`<button class="btn ghost" data-del="${k}">Borrar</button>`:''}</td></tr>`}).join('')}</tbody>`;
  if(keep){const el=document.getElementById(keep.id);if(el){el.value=keep.v;el.focus()}}
}

/* ---------- analysis ---------- */
function renderHealth(){
  const O=orders(), cut=new Date(Date.now()-365*864e5).toISOString().slice(0,10);
  const last=O.filter(o=>o.date>cut), buys=last.filter(o=>o.type==='buy');
  const amt=buys.reduce((s,o)=>s+o.qty*o.price,0), fees=last.reduce((s,o)=>s+(+o.fee||0),0);
  const ticket=buys.length?amt/buys.length:0, fr=amt?fees/amt:0;
  const byB={};for(const o of O){if(o.type==='fee'){(byB['Custodia']??={a:0,f:0,n:0}).f+=+o.fee;continue}const b=info(o.ticker).broker||'Otro';const r=byB[b]??={a:0,f:0,n:0};r.a+=o.qty*o.price;r.f+=+o.fee||0;r.n++}
  const cls=v=>v>0.02?'hi':v>0.01?'md':'ok';
  $('#liveHealth').innerHTML=`
   <div class="panel"><header><h3>Tus últimos 12 meses</h3><span class="muted" style="font-size:12px">se recalcula con cada orden</span></header>
    <div class="out"><div><span class="eyebrow">Órdenes de compra</span><b>${buys.length}</b></div><div><span class="eyebrow">Importe comprado</span><b>${eur(amt)}</b></div><div><span class="eyebrow">Ticket medio</span><b>${eur(ticket)}</b></div><div><span class="eyebrow">Fricción</span><b class="${fr>0.01?'neg':'pos'}">${num(fr*100,1)} %</b></div></div>
    <div class="finding"><span class="sev ${cls(fr)}"></span><span>${fr>0.01?`Cada 100 € invertidos este año, ${num(fr*100,1)} € se fueron en comisiones y custodia. El objetivo razonable es menos de 0,5 €.`:'Fricción por debajo del 1 %: vas bien.'}</span></div></div>
   <div class="panel"><header><h3>Coste por bróker</h3><span class="muted" style="font-size:12px">histórico completo</span></header>
    <div class="tbl" style="border:0"><table><thead><tr><th>Bróker</th><th class="n">Órdenes</th><th class="n">Importe</th><th class="n">Comisiones</th><th class="n">%</th></tr></thead><tbody>${Object.entries(byB).map(([b,r])=>`<tr><td>${esc(b)}</td><td class="n">${r.n||''}</td><td class="n">${r.a?eur(r.a):''}</td><td class="n">${eur(r.f,2)}</td><td class="n ${r.a&&r.f/r.a>0.02?'neg':''}">${r.a?num(r.f/r.a*100,2)+' %':''}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderAnalysis(){
  const A=S.docs.analysis||{};
  $('#anSummaryBox').hidden=!A.summary;$('#anSummary').textContent=A.summary||'';
  $('#analysis').innerHTML=A.html||'<p class="muted">Aún no hay un análisis guardado. Los indicadores de arriba se calculan solos con tus datos; un análisis escrito puede añadirse dentro de la copia de seguridad (documento «analysis»).</p>';
  $('#anNote').textContent=A.note||'No soy asesor financiero ni fiscal: esta información es para que decidas tú.';
}

/* ---------- simulator ---------- */
function renderSim(){
  const m=+$('#sMonthly').value||0, F=Math.max(0,+$('#sFee').value||0), r=(+$('#sRet').value||0)/100, yld=(+$('#sYld').value||0)/100, Yr=Math.max(1,Math.min(40,+$('#sYears').value||1));
  const C=m*12;
  const N=F>0&&C>0&&r>0?Math.min(12,Math.sqrt(C*r/(2*F))):12;
  const months=Math.max(1,Math.round(12/N)), ticket=m*months, ordersY=12/months;
  const costOpt=ordersY*F+C*r*(months-1)/24;
  const costNow=Math.max(1,orders().filter(o=>o.type==='buy'&&o.date>new Date(Date.now()-365*864e5).toISOString().slice(0,10)).length)*F;
  const P=positions().filter(p=>p.qty>0), start=P.reduce((s,p)=>s+p.value,0);
  const sim=(fr)=>{let v=start;const out=[v];for(let y=1;y<=Yr;y++){for(let k=0;k<12;k++)v=v*(1+r/12)+m*(1-fr);out.push(v)}return out};
  const ideal=sim(F/ticket), now=sim(F/Math.max(1,C/Math.max(1,costNow/F)));
  $('#simOut').innerHTML=`<div><span class="eyebrow">Compra cada</span><b>${months===1?'mes':months+' meses'}</b></div><div><span class="eyebrow">Ticket por orden</span><b>${eur(ticket)}</b></div><div><span class="eyebrow">Coste anual</span><b>${eur(costOpt)}</b><span class="muted" style="font-size:12px">${num(costOpt/(C||1)*100,2)} % de lo aportado</span></div><div><span class="eyebrow">Cartera en ${Yr} años</span><b>${eur(ideal.at(-1))}</b></div><div><span class="eyebrow">Dividendos/año entonces</span><b>${eur(ideal.at(-1)*yld)}</b><span class="muted" style="font-size:12px">${eur(ideal.at(-1)*yld/12)} al mes</span></div>`;
  $('#simNote').textContent=`Parte del valor de referencia actual (${eur(start)}). La línea gris repite tu ritmo de los últimos 12 meses (${Math.round(costNow/F)} órdenes con esta comisión); la diferencia final es de ${eur(ideal.at(-1)-now.at(-1))}. Rentabilidades supuestas, no garantizadas.`;
  draw('chSim',{type:'line',data:{labels:ideal.map((_,i)=>i?`Año ${i}`:'Hoy'),datasets:[
    {label:'Frecuencia óptima',data:ideal.map(Math.round),borderColor:tok('--c1'),backgroundColor:'transparent',pointRadius:0,borderWidth:3},
    {label:'Ritmo actual',data:now.map(Math.round),borderColor:tok('--c5'),borderDash:[5,4],pointRadius:0,borderWidth:1.6}]},options:baseOpts()});
}

/* ---------- render all ---------- */
function renderAll(){
  renderKpis();
  const dl=$('#tickers');dl.innerHTML=Object.entries(meta().catalog||{}).map(([t,c])=>`<option value="${esc(t)}">${esc(c.name)}</option>`).join('');
  renderPos();renderPlanForm();renderOrders();renderDivs();renderHealth();
  renderAnalysis();renderSince();renderBackupInfo();
  if(S.view==='resumen')renderResumen();
  if(S.view==='simulador')renderSim();
}
function show(v){S.view=v;document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.v===v));document.querySelectorAll('section.view').forEach(s=>s.hidden=s.id!=='v-'+v);if(v==='resumen')renderResumen();if(v==='simulador')renderSim();try{localStorage.setItem('tab',v)}catch(e){}}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)show(b.dataset.v)});

/* ---------- writes ---------- */
let queue=Promise.resolve();
function enqueue(fn){queue=queue.then(fn).catch(e=>{console.error(e);toast(e?.code==='invalid_argument'?'No tienes permiso para modificar estos datos.':'No se pudo guardar. Inténtalo de nuevo.')});return queue}
async function writeRows(docId,mutate){
  if(!S.db)throw {code:'unavailable'};
  const cur=S.docs[docId]?.rows||[], next=mutate(cur.map(r=>({...r})));
  const ref=S.db.doc('ledger/'+docId);
  if(S.docs[docId])await ref.update({rows:next});else await ref.set({rows:next});
}
const uid=()=>'u'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

function syncOrderForm(){
  const type=$('#oType').value, t=$('#oTicker').value.trim().toUpperCase(), known=!!meta().catalog?.[t];
  const isFee=type==='fee';
  ['#lName','#lKind','#lIsin','#lBroker'].forEach(s=>$(s).hidden=isFee||known||!t);
  $('#lNote').hidden=!isFee;
  $('#oTicker').required=!isFee;$('#oQty').required=!isFee;$('#oPrice').required=!isFee;
  $('#oQty').closest('label').hidden=isFee;$('#oPrice').closest('label').hidden=isFee;$('#oTicker').closest('label').hidden=isFee;
  const p=positions().find(p=>p.ticker===t);
  $('#oHint').textContent=isFee?'Los gastos cuentan en «Comisiones y custodia».':t&&known?`${info(t).name}: tienes ${num(p?.qty||0,0)} acciones a ${num(p&&p.qty?p.cost/p.qty:0)} € de coste medio.`:t?'Ticker nuevo: indica su nombre para darlo de alta.':'';
}
['#oType','#oTicker'].forEach(s=>$(s).addEventListener('input',syncOrderForm));
$('#oDate').value=today;$('#dDate').value=today;

$('#fOrder').addEventListener('submit',e=>{e.preventDefault();
  const type=$('#oType').value, date=$('#oDate').value, fee=+$('#oFee').value||0;
  let row;
  if(type==='fee'){if(!fee)return toast('Indica el importe del gasto en «Comisión».');row={id:uid(),date,type,ticker:'',qty:0,price:0,fee,note:$('#oNote').value.trim()||'Gasto'}}
  else{
    const t=$('#oTicker').value.trim().toUpperCase(), qty=+$('#oQty').value, price=+$('#oPrice').value;
    if(!t||!(qty>0)||!(price>0))return toast('Completa ticker, acciones y precio.');
    if(type==='sell'){const held=positions().find(p=>p.ticker===t)?.qty||0;if(qty>held+1e-9)return toast(`Solo tienes ${num(held,0)} acciones de ${t}.`)}
    const isNew=!meta().catalog?.[t];
    if(isNew&&!$('#oName').value.trim())return toast('Escribe el nombre del activo nuevo.');
    row={id:uid(),date,type,ticker:t,qty,price,fee};
    if(isNew)enqueue(()=>S.db.doc('ledger/meta').update({catalog:{[t]:{name:$('#oName').value.trim(),kind:$('#oKind').value,broker:$('#oBroker').value.trim()||'—',isin:$('#oIsin').value.trim().toUpperCase(),sector:'',region:''}}}));
  }
  enqueue(async()=>{await writeRows('orders-'+date.slice(0,4),rows=>[...rows,row]);toast(type==='buy'?'Compra guardada':type==='sell'?'Venta guardada':'Gasto guardado');
    ['#oQty','#oPrice','#oName','#oNote','#oBroker','#oIsin'].forEach(s=>$(s).value='');syncOrderForm()});
});
$('#fDiv').addEventListener('submit',e=>{e.preventDefault();
  const date=$('#dDate').value, t=$('#dTicker').value.trim().toUpperCase(), amount=+$('#dAmt').value;
  if(!t||!(amount>0))return toast('Indica ticker e importe.');
  if(!meta().catalog?.[t])return toast(`${t} no está en tu cartera. Regístralo primero con una compra.`);
  enqueue(async()=>{await writeRows('divs-'+date.slice(0,4),rows=>[...rows,{id:uid(),date,ticker:t,amount:Math.round(amount*100)/100}]);toast('Dividendo guardado');$('#dAmt').value='';$('#dYear').value=date.slice(0,4)});
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-del]');if(!b)return;
  if(!b.classList.contains('armed')){document.querySelectorAll('.armed').forEach(x=>{x.classList.remove('armed');x.textContent='Borrar'});b.classList.add('armed');b.textContent='¿Seguro?';return}
  const [doc,id]=b.dataset.del.split('|');enqueue(async()=>{await writeRows(doc,rows=>rows.filter(r=>r.id!==id));toast('Borrado')});
});
document.addEventListener('change',e=>{const q=e.target.closest('input.plan');if(q){const v=q.value===''?null:+q.value;if(v!=null&&!(v>=0))return;const f=q.dataset.f;
  let patch={[f]:v};
  if(f==='value'){const pl=plansDoc().plans?.[q.dataset.id];if(!(+pl?.units>0))return toast('Indica primero las participaciones.');patch={nav:Math.round(v/pl.units*10000)/10000}}
  if(f==='nav'||f==='value'){patch.navDate=today;patch.navSrc='manual'}
  enqueue(async()=>{await S.db.doc('ledger/plans').update({plans:{[q.dataset.id]:patch}});toast('Plan actualizado')});return}
  const i=e.target.closest('input.price');if(!i)return;const v=+i.value;if(!(v>0))return;
  enqueue(async()=>{await S.db.doc('ledger/meta').update({prices:{[i.dataset.t]:{price:v,date:today,src:'manual'}}});toast(`Precio de ${i.dataset.t} actualizado`)})});
['#fYear','#fTk'].forEach(s=>$(s).addEventListener('change',renderOrders));
$('#dYear').addEventListener('change',renderDivs);
$('#fSim').addEventListener('input',renderSim);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(S.view==='resumen')renderResumen();if(S.view==='simulador')renderSim()});
new MutationObserver(()=>{if(S.view==='resumen')renderResumen();if(S.view==='simulador')renderSim()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});


/* ---------- collapsible groups ---------- */
function setGroups(groups,open){groups.forEach(g=>open?S.collapsed.delete(g):S.collapsed.add(g));
  try{localStorage.setItem('collapsed',JSON.stringify([...S.collapsed]))}catch(e){}
  document.querySelectorAll('#tPos .gtoggle').forEach(b=>b.setAttribute('aria-expanded',!S.collapsed.has(b.dataset.g)));
  document.querySelectorAll('#tPos tr[data-g]').forEach(r=>r.hidden=S.collapsed.has(r.dataset.g))}
$('#tPos').addEventListener('click',e=>{const b=e.target.closest('.gtoggle');if(b)setGroups([b.dataset.g],S.collapsed.has(b.dataset.g))});
$('#gOpen').addEventListener('click',()=>setGroups(['etf','acc','plan'],true));
$('#gClose').addEventListener('click',()=>setGroups(['etf','acc','plan'],false));

/* ---------- plan update form ---------- */
const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function prefillPlan(){
  const p=plans().find(x=>x.id===$('#pId').value);if(!p)return;
  $('#pUnits').value=p.units??'';$('#pNav').value=p.nav??'';$('#pValue').value=Math.round(p.value*100)/100;$('#pContrib').value=p.contributed??'';
  $('#pHint').textContent=`Último dato: ${eur(p.value,2)} a ${(p.navDate||'').split('-').reverse().join('/')} (${p.navSrc||'manual'}).`;
}
function renderPlanForm(){
  const PL=plans();$('#planPanel').hidden=!PL.length;if(!PL.length)return;
  const before=$('#pId').value;fillSelect($('#pId'),PL.map(p=>[p.id,p.name]),PL[0].id);
  if(!$('#pDate').value)$('#pDate').value=today;
  if($('#pId').value!==before||!$('#pUnits').value)prefillPlan();
  $('#pSave').disabled=!S.canWrite;
}
$('#pId').addEventListener('change',prefillPlan);
$('#pValue').addEventListener('input',()=>{const u=+$('#pUnits').value,v=+$('#pValue').value;if(u>0&&v>=0)$('#pNav').value=Math.round(v/u*10000)/10000});
['#pUnits','#pNav'].forEach(s=>$(s).addEventListener('input',()=>{const u=+$('#pUnits').value,n=+$('#pNav').value;if(u>0&&n>0)$('#pValue').value=Math.round(u*n*100)/100}));
$('#fPlan').addEventListener('submit',e=>{e.preventDefault();
  const id=$('#pId').value, date=$('#pDate').value, units=+$('#pUnits').value, v=+$('#pValue').value;
  let nav=+$('#pNav').value;
  if(!(units>0))return toast('Indica las participaciones (si no las conoces, pon 1 y el valor total).');
  if(v>0)nav=v/units; if(!(nav>0))return toast('Indica el valor total o el valor liquidativo.');
  nav=Math.round(nav*10000)/10000;
  const patch={units,nav,navDate:date,navSrc:'manual'};
  if($('#pContrib').value!=='')patch.contributed=+$('#pContrib').value;
  const doSnap=$('#pSnap').checked;
  enqueue(async()=>{
    const upd={plans:{[id]:patch}};
    if(doSnap){
      const key=date.slice(0,7), cur=plansDoc().snapshots||[], prev=cur.find(s=>s.date===key);
      const bolsa=positions().filter(p=>p.qty>0).reduce((s,p)=>s+p.value,0);
      const snap={date:key,label:`${MES[+key.slice(5,7)-1]} ${key.slice(2,4)}`,bolsa:prev?.bolsa??Math.round(bolsa)};
      for(const p of plans())snap[p.id]=prev?.[p.id]??Math.round(p.value);
      snap[id]=Math.round(units*nav);
      upd.snapshots=[...cur.filter(s=>s.date!==key),snap].sort((a,b)=>a.date<b.date?-1:1);
    }
    if(S.docs.plans)await S.db.doc('ledger/plans').update(upd);else await S.db.doc('ledger/plans').set(upd);
    toast(doSnap?'Valores guardados y añadidos al gráfico':'Valores guardados');
  });
});


/* ---------- dividend editing ---------- */
const parseAmt=s=>{s=String(s).trim().replace(/\s|€/g,'');if(!s)return 0;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');const v=Number(s);return isFinite(v)?v:NaN};
function divById(k){const [doc,id]=k.split('|');return (S.docs[doc]?.rows||[]).find(r=>r.id===id)}
document.addEventListener('change',e=>{
  const c=e.target.closest('input.dcell');
  if(c){const t=c.dataset.t,m=+c.dataset.m,y=$('#dYear').value,v=parseAmt(c.value);
    if(isNaN(v)||v<0){toast('Escribe un importe válido, p. ej. 12,34');return renderDivs()}
    const key=`${y}-${String(m).padStart(2,'0')}`, doc='divs-'+y, P=divs().filter(d=>d.ticker===t&&d.date.startsWith(key));
    if(P.length>1)return;
    enqueue(async()=>{
      if(!P.length){if(!v)return;await writeRows(doc,rows=>[...rows,{id:uid(),date:key+'-15',ticker:t,amount:Math.round(v*100)/100}]);toast('Dividendo añadido')}
      else if(!v){await writeRows(P[0]._doc,rows=>rows.filter(r=>r.id!==P[0].id));toast('Dividendo borrado')}
      else{await writeRows(P[0]._doc,rows=>rows.map(r=>r.id===P[0].id?{...r,amount:Math.round(v*100)/100}:r));toast('Dividendo corregido')}
    });return}
  const l=e.target.closest('input.dl');
  if(l){const k=l.dataset.k,f=l.dataset.f,row=divById(k);if(!row)return;
    let val=l.value;
    if(f==='amount'){val=parseAmt(val);if(!(val>0)){toast('El importe debe ser mayor que 0. Para quitarlo usa «Borrar».');return renderDivs()}val=Math.round(val*100)/100}
    if(f==='ticker'){val=val.trim().toUpperCase();if(!meta().catalog?.[val]){toast(`${val||'Ese ticker'} no está en tu cartera.`);return renderDivs()}}
    if(f==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(val)){toast('Fecha no válida.');return renderDivs()}
    const [doc,id]=k.split('|');
    enqueue(async()=>{
      const cur=divById(k);if(!cur||cur[f]===val)return;
      const next={...cur,[f]:val}, newDoc='divs-'+next.date.slice(0,4);
      if(newDoc===doc)await writeRows(doc,rows=>rows.map(r=>r.id===id?next:r));
      else{await writeRows(newDoc,rows=>[...rows,next]);await writeRows(doc,rows=>rows.filter(r=>r.id!==id))}
      toast('Cobro corregido');
    })}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input.dcell,input.dl'))e.target.blur()});
$('#tDivMatrix').addEventListener('click',e=>{const b=e.target.closest('.multi');if(!b)return;
  const rows=[...document.querySelectorAll(`#tDivs tr[data-row="${CSS.escape(b.dataset.goto)}"]`)];
  if(!rows.length)return;rows[0].scrollIntoView({block:'center',behavior:'smooth'});rows.forEach(r=>r.classList.add('flash'));setTimeout(()=>rows.forEach(r=>r.classList.remove('flash')),2200)});


/* ---------- export to Excel ---------- */
const EURF='#,##0.00\\ "€"', DATEF='dd-mm-yyyy';
const cN=(v,z=EURF)=>v==null||v===''?null:{t:'n',v:Math.round(+v*10000)/10000,z};
const cD=s=>{const [y,m,d]=s.split('-').map(Number);return {t:'d',v:new Date(y,m-1,d),z:DATEF}};
const cS=s=>s==null?null:{t:'s',v:String(s)};
const cF=f=>({t:'n',f,z:EURF});
function sheet(aoa,widths){const ws=XLSX.utils.aoa_to_sheet(aoa.map(r=>r.map(c=>c&&typeof c==='object'?c:c==null?null:typeof c==='number'?{t:'n',v:c}:{t:'s',v:String(c)})),{cellDates:true});if(widths)ws['!cols']=widths.map(w=>({wch:w}));return ws}
function howTo(lines){return sheet(lines.map(l=>[l]),[110])}
async function saveBook(wb,name){
  if(!window.XLSX)return toast('No se pudo cargar el generador de Excel. Recarga la página.');
  const dl=await window.platform.use('downloads');if(!dl)return toast('La descarga no está disponible en esta vista.');
  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array',cellDates:true});
  try{await dl.save({filename:`${name}_${today}.xlsx`,data:new Blob([buf])});toast('Archivo descargado')}
  catch(e){if(e?.code==='declined')return;toast(e?.code==='rate_limited'?'Ya hay una descarga pendiente de confirmar.':'No se pudo descargar el archivo.')}
}
const prodName=t=>{const c=meta().catalog?.[t]||{};return c.xlName||(c.name||t).toUpperCase()};
function exportOrders(){
  const y=$('#fYear').value,t=$('#fTk').value;
  const L=orders().filter(o=>(!y||o.date.startsWith(y))&&(!t||o.ticker===t)).reverse();
  const head=['Fecha','Producto','ISIN','Bolsa ','Centro','Número','Precio','Valor local','Costes transac. ','Total'];
  const rows=L.map(o=>{
    if(o.type==='fee')return [cD(o.date),cS((o.note||'Gasto').toUpperCase()),cS('******'),cS('---'),cS('---'),cS('---'),cS('----'),cS('---'),cN(-(+o.fee||0)),cN(-(+o.fee||0))];
    const c=meta().catalog?.[o.ticker]||{}, n=o.type==='sell'?-o.qty:+o.qty, val=n*o.price, fee=-(+o.fee||0);
    return [cD(o.date),cS(prodName(o.ticker)),cS(c.isin||''),cS(c.bolsa||''),cS(c.centro||''),{t:'n',v:n,z:'0'},cN(o.price),cN(val),fee?cN(fee):null,cN(-val+fee)];
  });
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,sheet([head,...rows],[12,44,15,7,8,9,12,13,15,13]),'Ordenes');
  XLSX.utils.book_append_sheet(wb,howTo([
    'Cómo pasar estas órdenes a la hoja «Ordenes» del Excel original',
    '',
    '1. Las columnas A a J de este archivo son las columnas B a K de tu hoja (Fecha … Total), con el mismo formato y signos:',
    '   compras con Número positivo y Total negativo; ventas con Número negativo; gastos como «CUSTODIA DE VALORES».',
    '2. Las órdenes van de la más reciente a la más antigua, igual que en tu hoja.',
    '3. Para añadir solo las nuevas, filtra antes por año en el panel o copia únicamente las filas que no tengas.',
    '4. En tu hoja, inserta tantas filas vacías como órdenes vayas a pegar justo encima de la orden más reciente (fila 18).',
    '5. Copia aquí desde la columna A hasta la J y pega en la columna B de esa primera fila vacía (Pegado especial › Valores).',
    '6. Revisa la comprobación por años (columnas L–M) para confirmar que las sumas cuadran.',
    '',
    `Exportado el ${today.split('-').reverse().join('/')} · ${L.length} movimientos${y?` · año ${y}`:''}${t?` · ${t}`:''}.`]),'Cómo importar');
  saveBook(wb,'Ordenes'+(y?'_'+y:'')+(t?'_'+t:''));
}
function exportDividends(){
  const D=divs(), years=[...new Set(D.map(d=>d.date.slice(0,4)))].sort().reverse();
  const cat=meta().catalog||{}, first={};for(const o of orders())if(o.ticker&&o.type==='buy')first[o.ticker]??=o.date.slice(0,4);
  const wb=XLSX.utils.book_new();
  const cols=['Ticker','Mercado','TOTAL','Ene','Feb','Mar','Abr','','','May','Jun','Jul','Ago','','Sep','Oct','Nov','Dic','TOTAL'];
  const monthCol=[3,4,5,6,9,10,11,12,14,15,16,17];
  const L=c=>XLSX.utils.encode_col(c);
  for(const y of years){
    const Dy=D.filter(d=>d.date.startsWith(y));
    const inTable=Object.keys(cat).filter(t=>cat[t].divOrder&&first[t]&&first[t]<=y).sort((a,b)=>cat[a].divOrder-cat[b].divOrder);
    const extra=[...new Set(Dy.map(d=>d.ticker))].filter(t=>!inTable.includes(t)).sort();
    const tks=[...inTable,...extra];
    const rows=tks.map((t,i)=>{const r=Array(19).fill(null),R=i+2;r[0]=cS(t);r[1]=cS(cat[t]?.mkt||'');
      MONTHS.forEach((_,m)=>{const v=Dy.filter(d=>d.ticker===t&&+d.date.slice(5,7)===m+1).reduce((s,d)=>s+ +d.amount,0);if(v)r[monthCol[m]]=cN(v)});
      r[2]=cF(`SUM(D${R}:R${R})`);r[18]=cF(`SUM(D${R}:R${R})`);return r});
    const n=tks.length, tot=Array(19).fill(null);tot[1]=cS('TOTAL');
    [2,...monthCol,18].forEach(c=>tot[c]=cF(`SUM(${L(c)}2:${L(c)}${n+1})`));
    XLSX.utils.book_append_sheet(wb,sheet([cols,...rows,Array(19).fill(null),tot],[9,9,10,8,8,8,8,3,3,8,8,8,8,3,8,8,8,8,10]),'Dividendo '+y);
  }
  XLSX.utils.book_append_sheet(wb,sheet([['Fecha','Ticker','Producto','Importe'],...D.map(d=>[cD(d.date),cS(d.ticker),cS(info(d.ticker).name),cN(d.amount)])],[12,9,36,12]),'Cobros');
  XLSX.utils.book_append_sheet(wb,howTo([
    'Cómo pasar estos dividendos a la hoja «Dividendo» del Excel original',
    '',
    '1. Hay una pestaña por año con la misma estructura que las tablas anuales de tu hoja: Ticker (columna E), Mercado (F), TOTAL (G),',
    '   meses de Ene a Dic (H a V, con las mismas columnas vacías L, M y R) y TOTAL (W).',
    '2. Las filas están en el mismo orden que en tu hoja. Los activos nuevos, si los hay, aparecen al final.',
    '3. Copia el rango de Ene a Dic (columnas D a R de este archivo) y pégalo en las columnas H a V de la primera fila del año en tu hoja',
    '   con Pegado especial › Valores. Así no se tocan las fórmulas de TOTAL ni de rentabilidad de tu hoja.',
    '4. La pestaña «Cobros» tiene todos los cobros en lista (fecha, ticker, importe) por si prefieres revisarlos uno a uno.',
    '   Los cobros importados del Excel llevan día 15 porque la hoja original solo indica el mes.',
    '',
    `Exportado el ${today.split('-').reverse().join('/')} · ${D.length} cobros.`]),'Cómo importar');
  saveBook(wb,'Dividendos');
}
function exportPositions(){
  const cat=meta().catalog||{}, P=positions().filter(p=>p.qty>0).sort((a,b)=>(cat[a.ticker]?.sumOrder||99)-(cat[b.ticker]?.sumOrder||99)||a.ticker.localeCompare(b.ticker));
  const head=['Symbol','Title','Sector','Broker','Shares','Avg Cost / Share','Total','Precio ref.','Fecha precio','Valor','Plusvalía','Plusvalía %','Coste medio con comisiones','Comisiones','Dividendos cobrados','Dividendos 12 meses','En cartera'];
  const rows=P.map((p,i)=>{const c=cat[p.ticker]||{},R=i+2,avg0=p.cost0/p.qty;return [cS(p.ticker),cS(c.name||p.ticker),cS(c.xlSector||c.sector||''),cS(c.broker||''),{t:'n',v:p.qty,z:'0'},cN(avg0),cF(`E${R}*F${R}`),cN(p.ref),cD(p.refDate),cF(`E${R}*H${R}`),cF(`J${R}-E${R}*M${R}`),{t:'n',f:`IF(E${R}*M${R}=0,"",J${R}/(E${R}*M${R})-1)`,z:'0.0%'},cN(p.cost/p.qty),cN(p.fees),cN(p.div),cN(p.div12),cS('YES')]});
  const n=P.length, tot=Array(17).fill(null);tot[1]=cS('TOTAL');['G','J','K','N','O','P'].forEach(col=>{tot[XLSX.utils.decode_col(col)]=cF(`SUM(${col}2:${col}${n+1})`)});
  const PL=plans();
  const ph=['Producto','Tipo','Gestora','Participaciones','Valor liquidativo','Fecha VL','Valor','Aportado','Plusvalía','Plusvalía %'];
  const start=n+5;
  const prows=PL.map((p,i)=>{const R=start+1+i;return [cS(p.name),cS(p.kind),cS(p.manager),{t:'n',v:+p.units||0,z:'#,##0.00'},cN(p.nav),p.navDate?cD(p.navDate):null,cF(`D${R}*E${R}`),p.contributed!=null?cN(p.contributed):null,{t:'n',f:`IF(H${R}="","",G${R}-H${R})`,z:EURF},{t:'n',f:`IF(H${R}="","",G${R}/H${R}-1)`,z:'0.0%'}]});
  const ptot=[cS('TOTAL'),null,null,null,null,null,cF(`SUM(G${start+1}:G${start+PL.length})`),cF(`SUM(H${start+1}:H${start+PL.length})`),null,null];
  const aoa=[head,...rows,Array(17).fill(null).map((_,i)=>tot[i]),[],[cS('Planes de pensiones y fondos')],ph,...prows,ptot];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,sheet(aoa,[9,30,15,11,9,15,12,11,12,12,12,11,15,11,15,15,10]),'Posiciones');
  XLSX.utils.book_append_sheet(wb,howTo([
    'Cómo pasar las posiciones al Excel original',
    '',
    '1. Las 7 primeras columnas (Symbol … Total) siguen el orden de la tabla resumen de la hoja «Dividendo» (columnas D a J),',
    '   con los activos en el mismo orden de filas. Para actualizar acciones y coste medio, copia «Shares» y «Avg Cost / Share»',
    '   y pégalos en las columnas H e I de tu hoja con Pegado especial › Valores.',
    '2. «Avg Cost / Share» es el precio medio sin comisiones, como en tu hoja. El coste con comisiones está en una columna aparte.',
    '3. Las columnas siguientes (precio, valor, plusvalía, dividendos) son información extra del panel y no existen en tu hoja.',
    '4. Debajo, el bloque de planes de pensiones y fondo recoge participaciones y valor liquidativo, como en la hoja «Inversiones».',
    '',
    `Exportado el ${today.split('-').reverse().join('/')} · ${n} posiciones y ${PL.length} planes o fondos.`]),'Cómo importar');
  saveBook(wb,'Posiciones');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-export]');if(!b)return;({orders:exportOrders,dividends:exportDividends,positions:exportPositions})[b.dataset.export]()});


/* ---------- header extras & backups ---------- */
function renderSince(){const O=orders();const f=O[0]?.date;$('#since').textContent=f?`Bolsa, planes y fondos · desde ${MONTHS[+f.slice(5,7)-1].toLowerCase()}. ${f.slice(0,4)}`:'Bolsa, planes y fondos'}
let BK=null;
let SYNC=null;
const hhmm=d=>d?new Date(d).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
function renderBackupInfo(){
  if(!BK)return;const empty=BK.isEmpty();$('#welcome').hidden=!empty;
  if(SYNC?.mode==='archivo'){const st=SYNC.status();$('#ghPush').hidden=false;
    $('#bkInfo').innerHTML=st.state==='saving'?`Guardando en ${esc(st.file)}…`:st.state==='error'?`<b>No se pudo guardar en ${esc(st.file)}: ${esc(st.error)}. ¿Sigue abierto serve.py?</b>`:`Guardado en ${esc(st.file)}${st.savedAt?' · '+hhmm(st.savedAt):''}`;return}
  const last=BK.lastDate();const days=last?Math.floor((Date.now()-new Date(last))/864e5):null;
  $('#bkInfo').innerHTML=empty?'':!last?'<b>Aún no has guardado ninguna copia de seguridad.</b>':days>30?`<b>Última copia: ${last.split('-').reverse().join('/')} (hace ${days} días).</b>`:`Última copia: ${last.split('-').reverse().join('/')}`;
}
$('#ghPush').addEventListener('click',async()=>{const b=$('#ghPush');b.disabled=true;b.textContent='Subiendo…';
  try{const r=await SYNC.publish();toast(r.message)}catch(e){toast(e?.message||'No se pudo subir a GitHub.');if(e?.detail)console.warn(e.detail)}
  finally{b.disabled=false;b.textContent='Subir a GitHub'}});
$('#bkExport').addEventListener('click',async()=>{try{await BK.export();toast('Copia de seguridad descargada');renderBackupInfo()}catch(e){toast('No se pudo generar la copia.')}});
const pickBackup=()=>{if(!BK.isEmpty()&&!confirm('Restaurar una copia sustituye todos los datos de este navegador por los del archivo. ¿Continuar?'))return;$('#bkFile').value='';$('#bkFile').click()};
$('#bkImport').addEventListener('click',pickBackup);$('#bkImport2').addEventListener('click',pickBackup);
$('#bkFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const n=await BK.restore(f);toast(`Copia restaurada: ${n} documentos`)}catch(err){toast(err?.message||'No se pudo restaurar la copia.')}});

/* ---------- boot ---------- */
try{const t=localStorage.getItem('tab');if(t&&document.querySelector(`#tabs [data-v="${t}"]`))show(t)}catch(e){}
renderAll();syncOrderForm();
(async()=>{
  const db=await window.platform.use('db');
  if(!db){$('#status').innerHTML='<b>No se pudo acceder al almacenamiento del navegador.</b>';return}
  S.db=db;BK=await window.platform.use('backup');SYNC=await window.platform.use('sync');SYNC?.onChange(renderBackupInfo);
  window.platform.use('downloads').then(dl=>{if(dl&&window.XLSX)document.querySelectorAll('[data-export]').forEach(b=>b.hidden=false)});
  const user=await window.platform.use('user');
  const cw=user?await user.can('data.write'):null; if(cw===false){S.canWrite=false;document.querySelectorAll('form.entry button').forEach(b=>b.disabled=true)}
  const timer=setTimeout(()=>{if(!S.loaded)$('#status').innerHTML='<b>Los datos tardan en llegar.</b> Comprueba tu conexión.'},10000);
  db.collection('ledger').onSnapshot(snap=>{
    const docs={};snap.docs.forEach(d=>{if(d.exists)docs[d.id]=d.data()});S.docs=docs;
    if(!snap.metadata.fromCache){S.loaded=true;clearTimeout(timer)}
    const n=orders().length;
    $('#status').textContent=n?`${n} órdenes · ${divs().length} cobros de dividendo${S.canWrite?'':' · solo lectura'}`:'Sin datos todavía';
    renderAll();syncOrderForm();
  },err=>{clearTimeout(timer);$('#status').innerHTML='<b>No se pudieron cargar los datos.</b> Recarga la página.'});
})();
})();
