
const C=window.GDR_CONFIG;
let token=localStorage.getItem('gdr360_token')||'', user=JSON.parse(localStorage.getItem('gdr360_user')||'null');
let state={athletes:[],trainings:[],records:[],games:[],callups:[],users:[]};
let view='home', draft=null, callupDraft=null, selectedAthleteId=null;

const $=id=>document.getElementById(id);
const esc=(s='')=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const uid=p=>p+Math.random().toString(36).slice(2,8)+Date.now().toString(36);
const fmt=d=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-PT'):'';
const admin=()=>user?.role==='admin';
const sortName=arr=>[...arr].sort((a,b)=>a.name.localeCompare(b.name,'pt-PT',{sensitivity:'base'}));
const monthKey=d=>String(d||'').slice(0,7);

function toast(t){const x=document.createElement('div');x.className='toast';x.textContent=t;document.body.appendChild(x);setTimeout(()=>x.remove(),2200)}
async function api(action,payload={}){if(!C.API_URL)throw new Error('API_URL ainda não configurado em config.js');const r=await fetch(C.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token,...payload})});const j=await r.json();if(!j.ok)throw new Error(j.error||'Erro na API');return j}
function groupClass(g){return g==='Benjamins'?'benjamins':g==='Traquinas'?'traquinas':'misto'}
function groupBadge(g){return `<span class="group-badge ${groupClass(g)}">${esc(g)}</span>`}
function avatar(a,cls=''){return `<div class="avatar ${cls}">${a.photoUrl?`<img src="${esc(a.photoUrl)}" alt="">`:esc(a.name.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase())}</div>`}
function shirtNumber(a,equipment){return equipment==='Branco'?(a.whiteNumber||'—'):(a.redNumber||'—')}

function loginScreen(err=''){return `<div class="login-page"><div class="login-card"><img class="login-logo" src="logo-formacao-gdr.png"><h1>GDR Formação 360</h1><p>Área reservada à equipa técnica</p>${err?`<div class="error">${esc(err)}</div>`:''}<div class="field"><label>Utilizador</label><input id="lu" autocomplete="username"></div><div class="field"><label>PIN</label><input id="lp" class="pin" type="password" inputmode="numeric" maxlength="8"></div><button class="btn btn-primary btn-block" onclick="login()">Entrar</button></div></div>`}
async function login(){try{const j=await api('login',{username:$('lu').value,pin:$('lp').value});token=j.token;user=j.user;localStorage.setItem('gdr360_token',token);localStorage.setItem('gdr360_user',JSON.stringify(user));await refresh();view='home';render()}catch(e){$('app').innerHTML=loginScreen(e.message)}}
function logout(){token='';user=null;localStorage.removeItem('gdr360_token');localStorage.removeItem('gdr360_user');render()}
async function refresh(){const j=await api('getData');state=j.data}

function nav(){return `<nav class="nav">${[['home','⌂','Início'],['training','⚽','Treino'],['athletes','👥','Atletas'],['callup','📋','Convocar'],['dashboard','📊','Dashboard']].map(([v,i,t])=>`<button class="${view===v?'active':''}" onclick="go('${v}')"><span class="ico">${i}</span>${t}</button>`).join('')}</nav>`}
function shell(body){return `<div class="app"><header class="topbar"><div class="brand">${view!=='home'?'<button class="back-btn" onclick="goBack()" aria-label="Voltar">←</button>':''}<img class="brand-logo" src="logo-formacao-gdr.png"><div class="brand-copy"><h1>${C.APP_NAME}</h1><small>${esc(user.name)}</small></div><span class="role">${admin()?'Administrador':'Treinador'}</span><button class="logout" onclick="logout()">Sair</button></div></header><main class="content">${body}</main>${nav()}</div>`}
function go(v){view=v;draft=null;callupDraft=null;selectedAthleteId=null;render()}
function goBack(){
  if(view==='athleteForm'){view='athletes';render();return}
  if(view==='userForm'){view='users';render();return}
  if(view==='athleteProfile'){view='athletes';selectedAthleteId=null;render();return}
  if(view==='games'){view='home';render();return}
  if(view==='training'&&draft){draft=null;render();return}
  if(view==='callup'&&callupDraft){callupDraft=null;render();return}
  view='home';draft=null;callupDraft=null;selectedAthleteId=null;render();
}

function athleteRecords(id){return state.records.filter(x=>x.athleteId===id)}
function attendancePct(id){const r=athleteRecords(id);return r.length?Math.round(r.filter(x=>x.status==='Presente').length/r.length*100):0}
function avg(id,k){const r=athleteRecords(id).filter(x=>x.status==='Presente'&&Number(x[k]));return r.length?r.reduce((s,x)=>s+Number(x[k]),0)/r.length:0}
function score(a){return Math.round(attendancePct(a.id)*.35+avg(a.id,'effort')*20*.30+avg(a.id,'attitude')*20*.20+avg(a.id,'behavior')*20*.15)}
function athleteCallups(id){return state.callups.filter(c=>c.athleteId===id&&c.status==='Convocado')}
function recentRecords(id,n=5){return athleteRecords(id).slice().sort((a,b)=>trainingDate(b.trainingId).localeCompare(trainingDate(a.trainingId))).slice(0,n)}
function trainingDate(id){return state.trainings.find(t=>t.id===id)?.date||''}
function trend(id,key){
  const r=recentRecords(id,6).filter(x=>x.status==='Presente'&&Number(x[key])).reverse();
  if(r.length<4)return {label:'Sem tendência',cls:'neutral',delta:0};
  const half=Math.floor(r.length/2),a=r.slice(0,half),b=r.slice(half);
  const av=x=>x.reduce((s,v)=>s+Number(v[key]),0)/x.length;
  const d=av(b)-av(a);
  return d>.35?{label:'Em evolução',cls:'up',delta:d}:d<-.35?{label:'Em quebra',cls:'down',delta:d}:{label:'Estável',cls:'neutral',delta:d};
}
function athleteTrend(id){
  const keys=['attitude','effort','behavior'];
  const d=keys.reduce((s,k)=>s+trend(id,k).delta,0)/keys.length;
  return d>.25?{label:'Em evolução',icon:'📈',cls:'up'}:d<-.25?{label:'Em quebra',icon:'📉',cls:'down'}:{label:'Estável',icon:'➡️',cls:'neutral'};
}
function tagsCount(id){
  const map={};
  athleteRecords(id).forEach(r=>(r.tags||[]).forEach(t=>map[t]=(map[t]||0)+1));
  return map;
}

function home(){
 const aa=state.athletes.filter(a=>a.active),rec=state.records,p=rec.filter(x=>x.status==='Presente').length;
 const alerts=buildAlerts().slice(0,3);
 return `<section class="hero"><h2>Olá, ${esc(user.name)} 👋</h2><div class="muted">Registo rápido de treino e acompanhamento da formação.</div></section>
 <div class="grid"><div class="card kpi"><span>Atletas</span><strong>${aa.length}</strong></div><div class="card kpi"><span>Treinos</span><strong>${state.trainings.length}</strong></div><div class="card kpi"><span>Assiduidade</span><strong>${rec.length?Math.round(p/rec.length*100):0}%</strong></div><div class="card kpi"><span>Jogos</span><strong>${state.games.length}</strong></div></div>
 ${alerts.length?`<div class="section"><h3>A acompanhar</h3></div><div class="list">${alerts.map(a=>`<div class="card insight ${a.level}"><strong>${a.icon} ${esc(a.title)}</strong><div class="muted">${esc(a.text)}</div></div>`).join('')}</div>`:''}
 <div class="section"><h3>Ações rápidas</h3></div><div class="list"><button class="btn btn-primary btn-block" onclick="go('training')">⚡ Registar treino</button><button class="btn btn-secondary btn-block" onclick="go('callup')">📋 Preparar convocatória</button><button class="btn btn-secondary btn-block" onclick="go('athletes')">👥 ${admin()?'Gerir':'Ver'} atletas</button><button class="btn btn-secondary btn-block" onclick="view='games';render()">🗓️ Histórico de jogos</button>${admin()?'<button class="btn btn-secondary btn-block" onclick="view=\'users\';render()">🔐 Gerir utilizadores</button>':''}</div>`;
}

function athletes(){
 const aa=sortName(state.athletes.filter(a=>a.active));
 return `<div class="section"><h3>Atletas</h3>${admin()?'<button class="btn btn-primary" onclick="athleteForm()">+ Adicionar</button>':''}</div>
 ${!admin()?'<div class="admin-note">🔒 O treinador pode consultar os atletas. Adicionar, editar e eliminar é exclusivo do Administrador.</div>':''}
 <div class="list">${aa.map(a=>`<div class="card athlete clickable" onclick="openAthlete('${a.id}')">${avatar(a)}<div class="grow"><strong>${esc(a.name)}</strong><div class="athlete-meta">${groupBadge(a.group)}<span class="shirt-mini redshirt">🔴 ${esc(a.redNumber||'—')}</span><span class="shirt-mini whiteshirt">⚪ ${esc(a.whiteNumber||'—')}</span></div><div class="muted">${attendancePct(a.id)}% presença · ${athleteTrend(a.id).icon} ${athleteTrend(a.id).label}</div></div>${admin()?`<div class="actions" onclick="event.stopPropagation()"><button class="btn btn-small btn-ghost" onclick="athleteForm('${a.id}')">Editar</button><button class="btn btn-small btn-danger" onclick="deleteAthlete('${a.id}')">Eliminar</button></div>`:'<span class="chev">›</span>'}</div>`).join('')}</div>`;
}
function openAthlete(id){selectedAthleteId=id;view='athleteProfile';render()}
function athleteForm(id=''){
 if(!admin())return;
 const a=id?state.athletes.find(x=>x.id===id):null;view='athleteForm';
 $('app').innerHTML=shell(`<div class="section"><h3>${a?'Editar':'Novo'} atleta</h3></div><div class="card"><div class="photo-preview" id="photoPreview">${a?.photoUrl?`<img src="${esc(a.photoUrl)}">`:'Sem foto'}</div><div class="field"><label>Fotografia</label><input id="aphoto" type="file" accept="image/*" capture="environment" onchange="previewPhoto(this)"><div class="muted">A imagem será reduzida automaticamente antes do envio.</div></div><div class="field"><label>Nome</label><input id="aname" value="${esc(a?.name||'')}"></div><div class="field"><label>Escalão</label><select id="agroup"><option ${a?.group==='Benjamins'?'selected':''}>Benjamins</option><option ${a?.group==='Traquinas'?'selected':''}>Traquinas</option><option ${a?.group==='Traquinas/Benjamins'?'selected':''}>Traquinas/Benjamins</option></select></div><div class="form2"><div class="field"><label>N.º equipamento vermelho</label><input id="ared" inputmode="numeric" value="${esc(a?.redNumber||'')}" placeholder="Ex.: 7"></div><div class="field"><label>N.º equipamento branco</label><input id="awhite" inputmode="numeric" value="${esc(a?.whiteNumber||'')}" placeholder="Ex.: 12"></div></div><button class="btn btn-primary btn-block" onclick="saveAthlete('${id}')">Guardar atleta</button></div>`)
}
function previewPhoto(inp){const f=inp.files[0];if(!f)return;const u=URL.createObjectURL(f);$('photoPreview').innerHTML=`<img src="${u}">`}
async function resizePhoto(file){return new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{let w=img.width,h=img.height,max=520;if(w>h&&w>max){h=Math.round(h*max/w);w=max}else if(h>=w&&h>max){w=Math.round(w*max/h);h=max}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.78))};img.onerror=rej;img.src=u})}
async function saveAthlete(id){try{const file=$('aphoto').files[0];let photoBase64='';if(file)photoBase64=await resizePhoto(file);await api('saveAthlete',{athlete:{id,name:$('aname').value.trim(),group:$('agroup').value,redNumber:$('ared').value.trim(),whiteNumber:$('awhite').value.trim()},photoBase64});await refresh();view='athletes';render();toast('Atleta guardado')}catch(e){toast(e.message)}}
async function deleteAthlete(id){if(!confirm('Remover este atleta da lista ativa?'))return;try{await api('deleteAthlete',{id});await refresh();render();toast('Atleta removido')}catch(e){toast(e.message)}}

function athleteProfile(){
 const a=state.athletes.find(x=>x.id===selectedAthleteId);if(!a)return '<div class="empty">Atleta não encontrado.</div>';
 const r=athleteRecords(a.id).slice().sort((x,y)=>trainingDate(y.trainingId).localeCompare(trainingDate(x.trainingId)));
 const tr=athleteTrend(a.id),calls=athleteCallups(a.id),tc=tagsCount(a.id);
 return `<div class="profile-head card">${avatar(a,'avatar-xl')}<div class="grow"><h2>${esc(a.name)}</h2><div class="athlete-meta">${groupBadge(a.group)}<span class="shirt-mini redshirt">🔴 #${esc(a.redNumber||'—')}</span><span class="shirt-mini whiteshirt">⚪ #${esc(a.whiteNumber||'—')}</span></div><div class="trend ${tr.cls}">${tr.icon} ${tr.label}</div></div><button class="btn btn-small btn-secondary" onclick="printAthleteReport('${a.id}')">📄 PDF</button></div>
 <div class="grid profile-kpis"><div class="card kpi"><span>Assiduidade</span><strong>${attendancePct(a.id)}%</strong></div><div class="card kpi"><span>Empenho</span><strong>${avg(a.id,'effort').toFixed(1)}</strong></div><div class="card kpi"><span>Atitude</span><strong>${avg(a.id,'attitude').toFixed(1)}</strong></div><div class="card kpi"><span>Comportamento</span><strong>${avg(a.id,'behavior').toFixed(1)}</strong></div><div class="card kpi"><span>Treinos</span><strong>${r.length}</strong></div><div class="card kpi"><span>Convocatórias</span><strong>${calls.length}</strong></div></div>
 <div class="section"><h3>Evolução recente</h3></div>${evolutionBars(a.id)}
 ${Object.keys(tc).length?`<div class="section"><h3>Tags registadas</h3></div><div class="tag-cloud">${Object.entries(tc).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`<span>${esc(t)} <b>${n}</b></span>`).join('')}</div>`:''}
 <div class="section"><h3>Histórico de treinos</h3></div><div class="list">${r.slice(0,20).map(x=>`<div class="card history-row"><div><strong>${fmt(trainingDate(x.trainingId))}</strong><div class="muted">${esc(x.status)}${x.absenceReason?` · ${esc(x.absenceReason)}`:''}</div></div><div class="grow"></div>${x.status==='Presente'?`<div class="mini-score">A ${x.attitude} · E ${x.effort} · C ${x.behavior}</div>`:''}${x.tags?.length?`<div class="history-tags">${x.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}</div>`).join('')||'<div class="empty">Ainda sem registos.</div>'}</div>
 <div class="section"><h3>Convocatórias</h3></div><div class="list">${calls.slice().sort((a,b)=>gameDate(b.gameId).localeCompare(gameDate(a.gameId))).map(c=>{const g=state.games.find(x=>x.id===c.gameId);return `<div class="card history-row"><strong>${fmt(g?.date)}</strong><div class="grow"><div>${esc(g?.opponent||'Jogo')}</div><div class="muted">${esc(g?.equipment||'')} · #${esc(shirtNumber(a,g?.equipment||'Vermelho'))}</div></div></div>`}).join('')||'<div class="empty">Ainda sem convocatórias.</div>'}</div>`;
}
function evolutionBars(id){
 const rs=recentRecords(id,8).reverse().filter(r=>r.status==='Presente');
 if(!rs.length)return '<div class="card empty">Sem dados suficientes.</div>';
 return `<div class="card evolution-chart">${rs.map(r=>{const d=fmt(trainingDate(r.trainingId));const m=(Number(r.attitude)+Number(r.effort)+Number(r.behavior))/3;return `<div class="evo-col"><div class="evo-value">${m.toFixed(1)}</div><div class="evo-bar"><i style="height:${m/5*100}%"></i></div><small>${d.slice(0,5)}</small></div>`}).join('')}</div>`;
}

function training(){
 if(!draft)return `<div class="section"><h3>Registo Express</h3><span class="pill red">⚡ Rápido</span></div><div class="card"><div class="field"><label>Escalão</label><select id="tg"><option>Benjamins</option><option>Traquinas</option><option>Todos</option></select></div><div class="muted" style="margin-bottom:11px">Todos começam como <b>Presentes · 4/4/4</b>. Altera só as exceções.</div><button class="btn btn-primary btn-block" onclick="startTraining()">⚡ Iniciar treino</button></div>`;
 const people=trainingPeople(),c=counts(people);
 return `<div class="section"><div><h3>Treino · ${draft.group}</h3><div class="muted">${fmt(draft.date)} · ${draft.time}</div></div><span class="pill red">⚡ Express</span></div><div class="express-summary"><div class="express-stat"><strong>${c.p}</strong><span>Presentes</span></div><div class="express-stat"><strong>${c.f}</strong><span>Faltas</span></div><div class="express-stat"><strong>${c.j}</strong><span>Justificadas</span></div><div class="express-stat"><strong>${c.c}</strong><span>Alterados</span></div></div><div class="list">${people.map(trainingCard).join('')}</div><div class="sticky-save"><button class="btn btn-primary btn-block" onclick="saveTraining()">Guardar treino · ${c.p} presentes</button></div>`;
}
function startTraining(){const n=new Date();draft={id:uid('t'),date:n.toISOString().slice(0,10),time:String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0'),group:$('tg').value,records:{}};trainingPeople().forEach(a=>rec(a.id));render()}
function trainingPeople(){return sortName(state.athletes.filter(a=>a.active&&(draft.group==='Todos'||a.group===draft.group||a.group==='Traquinas/Benjamins')))}
function rec(id){if(!draft.records[id])draft.records[id]={status:'Presente',attitude:4,effort:4,behavior:4,note:'',absenceReason:'',tags:[]};return draft.records[id]}
function counts(pp){let p=0,f=0,j=0,c=0;pp.forEach(a=>{const r=rec(a.id);r.status==='Presente'?p++:r.status==='Falta'?f++:j++;if(r.status==='Presente'&&(r.attitude!==4||r.effort!==4||r.behavior!==4||r.tags.length))c++});return{p,f,j,c}}
const QUICK_TAGS=['⭐ Destaque','📈 Evolução','🎯 Concentração','🤝 Espírito de equipa','⚠️ Disciplina','💪 Empenho'];
function trainingCard(a){
 const r=rec(a.id),ch=r.status!=='Presente'||r.attitude!==4||r.effort!==4||r.behavior!==4||r.tags.length;
 return `<div class="card express-athlete ${ch?'changed':''}"><div class="athlete">${avatar(a)}<div class="grow"><strong>${esc(a.name)}</strong><div class="athlete-meta">${groupBadge(a.group)}</div></div></div>
 <div class="attendance">${['Presente','Falta','Justificada'].map(s=>`<button class="${r.status===s?(s==='Presente'?'present':s==='Falta'?'absent':'justified'):''}" onclick="status('${a.id}','${s}')">${s==='Presente'?'✅':s==='Falta'?'❌':'🟡'} ${s}</button>`).join('')}</div>
 ${r.status==='Justificada'?`<div class="field compact"><label>Motivo</label><select onchange="rec('${a.id}').absenceReason=this.value"><option value="">Selecionar...</option>${['Doença','Escola','Família','Outro'].map(x=>`<option ${r.absenceReason===x?'selected':''}>${x}</option>`).join('')}</select></div>`:''}
 ${r.status==='Presente'?`<div class="presets"><button class="${r.attitude===5&&r.effort===5&&r.behavior===5?'on':''}" onclick="preset('${a.id}',5)">🔥<span>Excelente</span></button><button class="${r.attitude===4&&r.effort===4&&r.behavior===4?'on':''}" onclick="preset('${a.id}',4)">👍<span>Bom</span></button><button class="${r.attitude===3&&r.effort===3&&r.behavior===3?'on':''}" onclick="preset('${a.id}',3)">⚠️<span>Atenção</span></button><button class="${r.behavior===2?'on':''}" onclick="behavior('${a.id}')">🚨<span>Comport.</span></button></div><div class="quick-tags">${QUICK_TAGS.map(t=>`<button class="${r.tags.includes(t)?'on':''}" onclick="toggleTag('${a.id}','${t.replace(/'/g,"\\'")}')">${t}</button>`).join('')}</div><button class="details-toggle" onclick="$('d-${a.id}').classList.toggle('open')">Ajustar individualmente ▾</button><div class="details" id="d-${a.id}">${[['attitude','Atitude'],['effort','Empenho'],['behavior','Comportamento']].map(([k,l])=>`<div class="metric"><div class="metric-head"><b>${l}</b><span>${r[k]}/5</span></div><div class="rating">${[1,2,3,4,5].map(n=>`<button class="${r[k]===n?'on':''}" onclick="rate('${a.id}','${k}',${n})">${n}</button>`).join('')}</div></div>`).join('')}<div class="field"><textarea placeholder="Observação opcional" onchange="rec('${a.id}').note=this.value">${esc(r.note)}</textarea></div></div>`:''}</div>`;
}
function status(id,s){rec(id).status=s;if(s!=='Justificada')rec(id).absenceReason='';render()}
function preset(id,n){Object.assign(rec(id),{status:'Presente',attitude:n,effort:n,behavior:n});render()}
function behavior(id){rec(id).status='Presente';rec(id).behavior=2;render()}
function rate(id,k,n){rec(id)[k]=n;render()}
function toggleTag(id,t){const r=rec(id),i=r.tags.indexOf(t);i>=0?r.tags.splice(i,1):r.tags.push(t);render()}
async function saveTraining(){try{await api('saveTraining',{training:{id:draft.id,date:draft.date,time:draft.time,group:draft.group,records:trainingPeople().map(a=>({athleteId:a.id,...rec(a.id)}))}});draft=null;await refresh();view='dashboard';render();toast('Treino guardado')}catch(e){toast(e.message)}}

function buildAlerts(){
 const alerts=[];
 state.athletes.filter(a=>a.active).forEach(a=>{
   const rs=recentRecords(a.id,5),att=attendancePct(a.id),tr=athleteTrend(a.id);
   const last3=rs.slice(0,3);
   const abs=last3.filter(r=>r.status!=='Presente').length;
   if(abs>=2)alerts.push({level:'warn',icon:'⚠️',title:a.name,text:`${abs} ausências nos últimos ${last3.length} treinos.`});
   if(tr.cls==='down')alerts.push({level:'danger',icon:'📉',title:a.name,text:'Tendência recente de quebra na avaliação.'});
   if(tr.cls==='up')alerts.push({level:'good',icon:'📈',title:a.name,text:'Evolução positiva nos treinos recentes.'});
   if(att>0&&att<70)alerts.push({level:'warn',icon:'🗓️',title:a.name,text:`Assiduidade atual de ${att}%.`});
 });
 return alerts.slice(0,12);
}
function dashboard(){
 const aa=state.athletes.filter(a=>a.active),rank=aa.map(a=>({...a,score:score(a)})).sort((a,b)=>b.score-a.score),alerts=buildAlerts(),hi=monthlyHighlights();
 return `<div class="section"><h3>Dashboard técnico</h3></div><div class="grid"><div class="card kpi"><span>Atletas</span><strong>${aa.length}</strong></div><div class="card kpi"><span>Treinos</span><strong>${state.trainings.length}</strong></div><div class="card kpi"><span>Assiduidade média</span><strong>${aa.length?Math.round(aa.reduce((s,a)=>s+attendancePct(a.id),0)/aa.length):0}%</strong></div><div class="card kpi"><span>Empenho médio</span><strong>${aa.length?(aa.reduce((s,a)=>s+avg(a.id,'effort'),0)/aa.length).toFixed(1):'0.0'}</strong></div></div>
 <div class="section"><h3>Destaques do mês</h3></div>${hi}
 <div class="section"><h3>Alertas e tendências</h3></div><div class="list">${alerts.map(a=>`<div class="card insight ${a.level}"><strong>${a.icon} ${esc(a.title)}</strong><div class="muted">${esc(a.text)}</div></div>`).join('')||'<div class="card empty">Sem alertas relevantes.</div>'}</div>
 <div class="section"><h3>Índice de treino</h3></div><div class="list">${rank.map((a,i)=>`<div class="card rank clickable" onclick="openAthlete('${a.id}')"><div class="rankno">${i+1}</div>${avatar(a)}<div class="grow"><strong>${esc(a.name)}</strong><div class="muted">${attendancePct(a.id)}% presença · Empenho ${avg(a.id,'effort').toFixed(1)}</div><div class="bar"><i style="width:${a.score}%"></i></div></div><div class="score">${a.score}</div></div>`).join('')}</div>`;
}
function monthlyHighlights(){
 const now=new Date(),mk=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 const tids=new Set(state.trainings.filter(t=>monthKey(t.date)===mk).map(t=>t.id));
 const rr=state.records.filter(r=>tids.has(r.trainingId)&&r.status==='Presente');
 if(!rr.length)return '<div class="card empty">Ainda sem dados suficientes neste mês.</div>';
 const aa=state.athletes.filter(a=>a.active);
 const metric=(id,k)=>{const x=rr.filter(r=>r.athleteId===id&&Number(r[k]));return x.length?x.reduce((s,r)=>s+Number(r[k]),0)/x.length:0};
 const best=(k)=>aa.map(a=>({a,v:metric(a.id,k)})).sort((x,y)=>y.v-x.v)[0]?.a;
 const pres=aa.map(a=>({a,v:rr.filter(r=>r.athleteId===a.id).length})).sort((x,y)=>y.v-x.v)[0]?.a;
 const evol=aa.map(a=>({a,d:athleteTrend(a.id).cls==='up'?1:0,score:score(a)})).sort((x,y)=>y.d-x.d||y.score-x.score)[0]?.a;
 return `<div class="highlights-grid">${[['⭐','Maior evolução',evol],['🔥','Maior empenho',best('effort')],['🤝','Melhor comportamento',best('behavior')],['💪','Mais presenças',pres]].map(([i,l,a])=>`<div class="card highlight">${i}<span>${l}</span><strong>${esc(a?.name||'—')}</strong></div>`).join('')}</div>`;
}

function callup(){
 if(!callupDraft)return `<div class="section"><h3>Nova convocatória</h3></div><div class="card"><div class="field"><label>Adversário</label><input id="opp"></div><div class="form2"><div class="field"><label>Data</label><input id="gd" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Hora</label><input id="gh" type="time"></div></div><div class="form2"><div class="field"><label>Escalão</label><select id="gg"><option>Benjamins</option><option>Traquinas</option></select></div><div class="field"><label>N.º jogadores</label><input id="gn" type="number" min="1" value="12"></div></div><div class="field"><label>Equipamento</label><select id="ge"><option value="Vermelho">🔴 Vermelho</option><option value="Branco">⚪ Branco</option></select></div><button class="btn btn-primary btn-block" onclick="prepareCallup()">Gerar sugestão</button></div>`;
 return callupEditor();
}
function rotationBoost(a){
 const recentGames=state.games.slice().sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0,3);
 let missed=0;
 recentGames.forEach(g=>{if(!state.callups.some(c=>c.gameId===g.id&&c.athleteId===a.id&&c.status==='Convocado'))missed++});
 return missed*4;
}
function prepareCallup(){
 const group=$('gg').value,n=Number($('gn').value||12),equipment=$('ge').value;
 const eligible=sortName(state.athletes.filter(a=>a.active&&(a.group===group||a.group==='Traquinas/Benjamins'))).map(a=>({...a,score:score(a),rotation:rotationBoost(a)}));
 const recommended=[...eligible].sort((a,b)=>(b.score+b.rotation)-(a.score+a.rotation)).slice(0,n).map(a=>a.id);
 callupDraft={id:uid('g'),opponent:$('opp').value.trim()||'Adversário',date:$('gd').value,time:$('gh').value,group,equipment,limit:n,eligible,selected:new Set(recommended)};render()
}
function toggleCallup(id){if(callupDraft.selected.has(id))callupDraft.selected.delete(id);else{if(callupDraft.selected.size>=callupDraft.limit)return toast(`Máximo de ${callupDraft.limit} convocados`);callupDraft.selected.add(id)}render()}
function callupEditor(){
 const selected=callupDraft.eligible.filter(a=>callupDraft.selected.has(a.id));
 return `<div class="section"><div><h3>${esc(callupDraft.opponent)}</h3><div class="muted">${fmt(callupDraft.date)} · ${esc(callupDraft.time||'Hora por definir')}</div></div><span class="equipment-badge ${callupDraft.equipment==='Vermelho'?'equip-red':'equip-white'}">${callupDraft.equipment==='Vermelho'?'🔴':'⚪'} ${callupDraft.equipment}</span></div><div class="callup-counter"><strong>${selected.length}</strong> / ${callupDraft.limit} convocados</div><div class="football-pitch">${pitchPlayers(selected)}</div><div class="section"><h3>Selecionar jogadores</h3></div><div class="list">${[...callupDraft.eligible].sort((a,b)=>(b.score+b.rotation)-(a.score+a.rotation)).map(a=>`<button class="card callup-row ${callupDraft.selected.has(a.id)?'selected':''}" onclick="toggleCallup('${a.id}')">${avatar(a)}<div class="grow"><strong>${esc(a.name)}</strong><div class="athlete-meta">${groupBadge(a.group)}<span class="number-badge">#${esc(shirtNumber(a,callupDraft.equipment))}</span></div><div class="muted">Índice ${score(a)}${a.rotation?` · 🔄 rotação +${a.rotation}`:''}</div></div><span class="checkmark">${callupDraft.selected.has(a.id)?'✓':''}</span></button>`).join('')}</div><div class="callup-actions"><button class="btn btn-secondary" onclick="callupDraft=null;render()">Voltar</button><button class="btn btn-secondary" onclick="printCallup()">🖨️ PDF / Imprimir</button><button class="btn btn-primary" onclick="saveCallup()">Guardar convocatória</button></div>`;
}
function pitchPlayers(players){if(!players.length)return '<div class="pitch-empty">Seleciona jogadores para os veres no campo</div>';return `<div class="pitch-grid">${players.map((a,i)=>`<div class="pitch-player p${i}"><div class="pitch-avatar">${a.photoUrl?`<img src="${esc(a.photoUrl)}">`:`<span>${esc(a.name.split(' ')[0][0])}</span>`}</div><div class="pitch-number ${callupDraft.equipment==='Vermelho'?'red':'white'}">#${esc(shirtNumber(a,callupDraft.equipment))}</div><b>${esc(a.name.split(' ')[0])}</b></div>`).join('')}</div>`}
async function saveCallup(){try{const selected=callupDraft.eligible.filter(a=>callupDraft.selected.has(a.id));if(!selected.length)return toast('Seleciona pelo menos um jogador');await api('saveCallup',{game:{id:callupDraft.id,opponent:callupDraft.opponent,date:callupDraft.date,time:callupDraft.time,group:callupDraft.group,equipment:callupDraft.equipment,athleteIds:selected.map(a=>a.id),scores:selected.map(a=>({id:a.id,score:score(a)}))}});await refresh();toast('Convocatória guardada')}catch(e){toast(e.message)}}
function printCallup(){
 const selected=callupDraft.eligible.filter(a=>callupDraft.selected.has(a.id));if(!selected.length)return toast('Seleciona jogadores');
 const missing=selected.filter(a=>shirtNumber(a,callupDraft.equipment)==='—');if(missing.length)return toast(`Falta o número ${callupDraft.equipment.toLowerCase()} em ${missing.length} atleta(s).`);
 const equipment=callupDraft.equipment,cards=selected.map(a=>`<div class="pcard"><div class="pimg">${a.photoUrl?`<img src="${esc(a.photoUrl)}">`:`<span>${esc(a.name.split(' ').slice(0,2).map(x=>x[0]).join(''))}</span>`}</div><div><b>${esc(a.name)}</b><div>${esc(a.group)}</div></div><strong class="pnum ${equipment==='Vermelho'?'r':'w'}">#${esc(shirtNumber(a,equipment))}</strong></div>`).join('');
 const pitch=`<div class="ppitch"><div class="ppitch-grid">${selected.map((a,i)=>`<div class="pp p${i}"><div class="ppi">${a.photoUrl?`<img src="${esc(a.photoUrl)}">`:esc(a.name[0])}</div><div class="ppn ${equipment==='Vermelho'?'r':'w'}">#${esc(shirtNumber(a,equipment))}</div><b>${esc(a.name.split(' ')[0])}</b></div>`).join('')}</div></div>`;
 const w=window.open('','_blank');w.document.write(printDoc('Convocatória',`GDR Faro do Alentejo vs ${esc(callupDraft.opponent)}`,`${fmt(callupDraft.date)} ${esc(callupDraft.time||'')} · ${esc(callupDraft.group)} · ${selected.length} convocados`,equipment,pitch+`<div class="plist">${cards}</div>`));w.document.close()
}
function printDoc(title,subtitle,meta,equipment,body){return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#171717;margin:0}.head{display:flex;align-items:center;border-bottom:3px solid #b5121b;padding-bottom:8px;margin-bottom:12px}.head img{width:105px;height:70px;object-fit:contain}.head div{flex:1}.head h1{margin:0;font-size:22px}.meta{font-size:12px;color:#555}.equip{font-weight:bold;padding:7px 10px;border-radius:10px;background:${equipment==='Vermelho'?'#b5121b':'#f5f5f5'};color:${equipment==='Vermelho'?'#fff':'#111'};border:1px solid #ddd}.ppitch{height:335px;background:#2f914d;border:3px solid #fff;outline:1px solid #18723a;position:relative;margin:12px 0 15px;overflow:hidden}.ppitch:before{content:'';position:absolute;left:50%;top:0;bottom:0;border-left:2px solid rgba(255,255,255,.8)}.ppitch:after{content:'';position:absolute;width:90px;height:90px;border:2px solid rgba(255,255,255,.8);border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%)}.ppitch-grid{height:100%;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:1fr;align-items:center;justify-items:center;position:relative;z-index:2}.pp{text-align:center;font-size:9px;color:#fff;text-shadow:0 1px 2px #000}.ppi{width:36px;height:36px;border-radius:50%;overflow:hidden;background:#fff;color:#111;display:grid;place-items:center;margin:auto;border:2px solid #fff;text-shadow:none}.ppi img{width:100%;height:100%;object-fit:cover}.ppn{display:inline-block;min-width:24px;padding:3px 6px;margin-top:-7px;border-radius:999px;font-size:10px;font-weight:bold;text-shadow:none}.ppn.r,.pnum.r{background:#b5121b;color:#fff}.ppn.w,.pnum.w{background:#fff;color:#111;border:1px solid #bbb}.plist{display:grid;grid-template-columns:1fr 1fr;gap:6px}.pcard{display:flex;align-items:center;gap:8px;border:1px solid #ddd;border-radius:9px;padding:6px;font-size:10px}.pimg{width:34px;height:34px;border-radius:50%;overflow:hidden;background:#eee;display:grid;place-items:center;font-weight:bold}.pimg img{width:100%;height:100%;object-fit:cover}.pcard>div:nth-child(2){flex:1}.pnum{min-width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:15px}.report-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.report-kpi{border:1px solid #ddd;border-radius:10px;padding:9px;text-align:center}.report-kpi b{display:block;font-size:18px}.report-table{width:100%;border-collapse:collapse;font-size:10px}.report-table th,.report-table td{border-bottom:1px solid #ddd;padding:6px;text-align:left}@media print{button{display:none}}</style></head><body><div class="head"><img src="${location.origin+location.pathname.replace(/[^/]*$/,'')}logo-formacao-gdr.png"><div><h1>${title}</h1><b>${subtitle}</b><div class="meta">${meta}</div></div>${equipment?`<div class="equip">${equipment}</div>`:''}</div>${body}<script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script></body></html>`}
function printAthleteReport(id){
 const a=state.athletes.find(x=>x.id===id),rr=athleteRecords(id).slice().sort((x,y)=>trainingDate(y.trainingId).localeCompare(trainingDate(x.trainingId))).slice(0,12),tr=athleteTrend(id);
 const body=`<div class="report-grid"><div class="report-kpi">Assiduidade<b>${attendancePct(id)}%</b></div><div class="report-kpi">Empenho<b>${avg(id,'effort').toFixed(1)}</b></div><div class="report-kpi">Atitude<b>${avg(id,'attitude').toFixed(1)}</b></div><div class="report-kpi">Comportamento<b>${avg(id,'behavior').toFixed(1)}</b></div></div><p><b>Evolução:</b> ${tr.icon} ${tr.label} · <b>Convocatórias:</b> ${athleteCallups(id).length}</p><table class="report-table"><thead><tr><th>Data</th><th>Presença</th><th>Atitude</th><th>Empenho</th><th>Comport.</th><th>Tags</th></tr></thead><tbody>${rr.map(r=>`<tr><td>${fmt(trainingDate(r.trainingId))}</td><td>${esc(r.status)}${r.absenceReason?` (${esc(r.absenceReason)})`:''}</td><td>${r.status==='Presente'?r.attitude:'—'}</td><td>${r.status==='Presente'?r.effort:'—'}</td><td>${r.status==='Presente'?r.behavior:'—'}</td><td>${esc((r.tags||[]).join(', '))}</td></tr>`).join('')}</tbody></table>`;
 const w=window.open('','_blank');w.document.write(printDoc('Ficha de Evolução',esc(a.name),`${esc(a.group)} · ${tr.icon} ${tr.label}`,'',body));w.document.close()
}

function gameDate(id){return state.games.find(g=>g.id===id)?.date||''}
function games(){
 const gg=[...state.games].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 return `<div class="section"><h3>Histórico de jogos</h3></div><div class="list">${gg.map(g=>{const cs=state.callups.filter(c=>c.gameId===g.id&&c.status==='Convocado');return `<div class="card game-card"><div><strong>${fmt(g.date)}</strong><div class="muted">${esc(g.group||'')} · ${esc(g.equipment||'')}</div></div><div class="grow"><b>vs ${esc(g.opponent)}</b><div class="muted">${cs.length} convocados</div></div></div>`}).join('')||'<div class="card empty">Ainda sem jogos guardados.</div>'}</div>`;
}

function users(){if(!admin())return '<div class="admin-note">Acesso exclusivo ao Administrador.</div>';return `<div class="section"><h3>Utilizadores</h3><button class="btn btn-primary" onclick="userForm()">+ Adicionar</button></div><div class="list">${state.users.map(u=>`<div class="card athlete"><div class="avatar">${u.role==='admin'?'A':'T'}</div><div class="grow"><strong>${esc(u.name)}</strong><div class="muted">@${esc(u.username)} · ${u.role} · ${u.active?'Ativo':'Inativo'}</div></div><div class="actions"><button class="btn btn-small btn-ghost" onclick="userForm('${u.id}')">Editar</button><button class="btn btn-small btn-danger" onclick="toggleUser('${u.id}',${!u.active})">${u.active?'Desativar':'Ativar'}</button></div></div>`).join('')}</div>`}
function userForm(id=''){const u=id?state.users.find(x=>x.id===id):null;view='userForm';$('app').innerHTML=shell(`<div class="section"><h3>${u?'Editar':'Novo'} utilizador</h3></div><div class="card"><div class="field"><label>Nome</label><input id="un" value="${esc(u?.name||'')}"></div><div class="field"><label>Utilizador</label><input id="uu" value="${esc(u?.username||'')}"></div><div class="field"><label>PIN ${u?'(deixa vazio para manter)':''}</label><input id="up" type="password" inputmode="numeric"></div><div class="field"><label>Perfil</label><select id="ur"><option value="treinador" ${u?.role==='treinador'?'selected':''}>Treinador</option><option value="admin" ${u?.role==='admin'?'selected':''}>Administrador</option></select></div><button class="btn btn-primary btn-block" onclick="saveUser('${id}')">Guardar</button></div>`)}
async function saveUser(id){try{await api('saveUser',{target:{id,name:$('un').value.trim(),username:$('uu').value.trim(),pin:$('up').value,role:$('ur').value}});await refresh();view='users';render();toast('Utilizador guardado')}catch(e){toast(e.message)}}
async function toggleUser(id,active){try{await api('toggleUser',{id,active});await refresh();render()}catch(e){toast(e.message)}}

function render(){
 if(!user||!token){$('app').innerHTML=loginScreen();return}
 let b='';
 if(view==='home')b=home();
 else if(view==='athletes')b=athletes();
 else if(view==='athleteProfile')b=athleteProfile();
 else if(view==='training')b=training();
 else if(view==='dashboard')b=dashboard();
 else if(view==='callup')b=callup();
 else if(view==='games')b=games();
 else if(view==='users')b=users();
 else return;
 $('app').innerHTML=shell(b)
}
(async()=>{if(user&&token){$('app').innerHTML='<div class="loading">A carregar GDR Formação 360…</div>';try{await refresh()}catch(e){logout();return}}render()})();
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
