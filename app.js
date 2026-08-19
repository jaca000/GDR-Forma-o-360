const C=window.GDR_CONFIG;
const KEY='gdr360-data-v2';
const SESSION_KEY='gdr360-session-v1';
const seed={
  users:[
    {id:'u1',username:'admin',pin:'1234',name:'Administrador GDR',role:'admin',active:true},
    {id:'u2',username:'treinador',pin:'2468',name:'Treinador Demo',role:'treinador',active:true}
  ],
  athletes:[
    {id:'a1',name:'Vasco Almanso',group:'Benjamins',active:true},
    {id:'a2',name:'António Medinas',group:'Benjamins',active:true},
    {id:'a3',name:'Bernardo Dimas',group:'Benjamins',active:true},
    {id:'a4',name:'Santiago Quebra',group:'Benjamins',active:true},
    {id:'a5',name:'Luís Galaio',group:'Traquinas',active:true},
    {id:'a6',name:'Mateus Machado',group:'Traquinas',active:true},
    {id:'a7',name:'Simão Candeias',group:'Traquinas',active:true},
    {id:'a8',name:'Vicente Tavares',group:'Traquinas/Benjamins',active:true}
  ],
  trainings:[],records:[],games:[],callups:[]
};
let db=load(), session=loadSession(), view='home', trainingDraft=null;

function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d){if(!d.users)d.users=structuredClone(seed.users);return d}return structuredClone(seed)}catch{return structuredClone(seed)}}
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function loadSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY))}catch{return null}}
function saveSession(s){session=s;if(s)localStorage.setItem(SESSION_KEY,JSON.stringify(s));else localStorage.removeItem(SESSION_KEY)}
function el(id){return document.getElementById(id)}
function initials(n){return n.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function today(){return new Date().toISOString().slice(0,10)}
function fmt(d){return new Date(d+'T12:00:00').toLocaleDateString('pt-PT')}
function uid(p){return p+Math.random().toString(36).slice(2,8)+Date.now().toString(36)}
function toast(t){const x=document.createElement('div');x.className='toast';x.textContent=t;document.body.appendChild(x);setTimeout(()=>x.remove(),1800)}
function isAdmin(){return session?.role==='admin'}
function currentUser(){return db.users.find(u=>u.id===session?.userId)||null}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function loginScreen(){
 return `<div class="login-page"><div class="login-card">
 <img class="login-logo" src="logo-formacao-gdr.png" alt="Formação GDR Faro do Alentejo">
 <h1>GDR Formação 360</h1><p class="subtitle">Área reservada à equipa técnica</p>
 <div id="loginError" class="login-error">Utilizador ou PIN incorreto.</div>
 <div class="field"><label>Utilizador</label><input id="loginUser" autocomplete="username" placeholder="Utilizador"></div>
 <div class="field"><label>PIN</label><input id="loginPin" class="pin-input" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password" placeholder="••••"></div>
 <button class="btn btn-primary btn-block" onclick="login()">Entrar</button>
 ${C.DEMO_MODE?'<p class="login-note">Demo: admin / 1234 &nbsp;·&nbsp; treinador / 2468</p>':''}
 </div></div>`;
}
function login(){
 const username=(el('loginUser').value||'').trim().toLowerCase(),pin=(el('loginPin').value||'').trim();
 const u=db.users.find(x=>x.active&&x.username.toLowerCase()===username&&x.pin===pin);
 if(!u){el('loginError').classList.add('show');return}
 saveSession({userId:u.id,role:u.role,name:u.name});view='home';render();
}
function logout(){saveSession(null);view='home';trainingDraft=null;render()}
function nav(){return `<nav class="nav">${[['home','⌂','Início'],['training','⚽','Treino'],['athletes','👥','Atletas'],['callup','📋','Convocar'],['dashboard','📊','Dashboard']].map(([v,i,t])=>`<button class="${view===v?'active':''}" onclick="go('${v}')"><span class="ico">${i}</span>${t}</button>`).join('')}</nav>`}
function shell(body){const u=currentUser();return `<div class="app"><header class="topbar"><div class="brand">
<img class="brand-logo" src="logo-formacao-gdr.png" alt="GDR Formação">
<div class="brand-copy"><h1>${C.APP_NAME}</h1><small>${esc(u?.name||'')}</small></div>
<div class="userbox"><span class="role-badge">${isAdmin()?'Administrador':'Treinador'}</span><button class="logout" onclick="logout()">Sair</button></div>
</div></header><main class="content">${body}</main>${nav()}</div>`}
function go(v){view=v;trainingDraft=null;render()}
function render(){if(!session){el('app').innerHTML=loginScreen();return}const u=currentUser();if(!u||!u.active){logout();return}session.role=u.role;let b='';if(view==='home')b=home();if(view==='athletes')b=athletes();if(view==='training')b=training();if(view==='dashboard')b=dashboard();if(view==='callup')b=callup();if(view==='users')b=users();el('app').innerHTML=shell(b)}
function attendancePct(aid){const r=db.records.filter(x=>x.athleteId===aid);if(!r.length)return 0;return Math.round(r.filter(x=>x.status==='Presente').length/r.length*100)}
function avg(aid,k){const r=db.records.filter(x=>x.athleteId===aid&&x.status==='Presente'&&x[k]);return r.length?(r.reduce((s,x)=>s+Number(x[k]),0)/r.length):0}

function home(){const active=db.athletes.filter(a=>a.active),all=db.records,pres=all.filter(r=>r.status==='Presente').length,ap=all.length?Math.round(pres/all.length*100):0;
 return `<section class="hero"><h2>Olá, ${esc(currentUser()?.name||'equipa técnica')} 👋</h2><p>Regista o treino em segundos e acompanha a evolução da formação.</p></section>
 ${isAdmin()?'<div class="admin-strip"><span>🔐</span><strong>Modo Administrador</strong><button class="btn btn-small btn-secondary" onclick="go(\'users\')">Utilizadores</button></div>':''}
 <div class="grid"><div class="card kpi"><span>Atletas ativos</span><strong>${active.length}</strong></div><div class="card kpi"><span>Treinos</span><strong>${db.trainings.length}</strong></div><div class="card kpi"><span>Assiduidade</span><strong>${ap}%</strong></div><div class="card kpi"><span>Jogos</span><strong>${db.games.length}</strong></div></div>
 <div class="section-title"><h3>Ações rápidas</h3></div><div class="list">
 <button class="btn btn-primary btn-block" onclick="go('training')">⚽ Registar treino</button>
 <button class="btn btn-secondary btn-block" onclick="go('callup')">📋 Preparar convocatória</button>
 <button class="btn btn-secondary btn-block" onclick="go('athletes')">👥 ${isAdmin()?'Gerir':'Ver'} atletas</button>
 ${isAdmin()?'<button class="btn btn-secondary btn-block" onclick="go(\'users\')">🔐 Gerir utilizadores</button>':''}
 </div>`}

function athletes(){
 const list=db.athletes.filter(a=>a.active).map(a=>`<div class="card athlete"><div class="avatar">${initials(a.name)}</div><div class="grow"><strong>${esc(a.name)}</strong><div class="muted">${esc(a.group)} · ${attendancePct(a.id)}% presença</div></div><span class="pill red">${avg(a.id,'effort').toFixed(1)}</span>${isAdmin()?`<div class="actions"><button class="btn btn-small btn-ghost" onclick="editAthlete('${a.id}')">Editar</button><button class="btn btn-small btn-danger" onclick="deleteAthlete('${a.id}')">Eliminar</button></div>`:''}</div>`).join('');
 return `<div class="section-title"><h3>Atletas</h3>${isAdmin()?'<button class="btn btn-primary" onclick="addAthlete()">+ Adicionar</button>':''}</div>
 ${!isAdmin()?'<div class="restricted">🔒 O perfil Treinador pode consultar os atletas, mas apenas o Administrador pode adicionar, editar ou eliminar jogadores.</div>':''}
 <div class="list">${list||'<div class="empty">Ainda não existem atletas.</div>'}</div>`;
}
function addAthlete(){if(!isAdmin())return toast('Apenas o administrador pode adicionar atletas');const name=prompt('Nome do atleta:');if(!name)return;const group=prompt('Escalão: Traquinas, Benjamins ou Traquinas/Benjamins','Benjamins')||'Benjamins';db.athletes.push({id:uid('a'),name:name.trim(),group:group.trim(),active:true});save();render();toast('Atleta adicionado')}
function editAthlete(id){if(!isAdmin())return;const a=db.athletes.find(x=>x.id===id);if(!a)return;const name=prompt('Nome do atleta:',a.name);if(!name)return;const group=prompt('Escalão:',a.group);if(!group)return;a.name=name.trim();a.group=group.trim();save();render();toast('Atleta atualizado')}
function deleteAthlete(id){if(!isAdmin())return;const a=db.athletes.find(x=>x.id===id);if(!a)return;if(!confirm(`Eliminar ${a.name}? O histórico de treinos já registado será mantido.`))return;a.active=false;save();render();toast('Atleta removido da lista ativa')}

function training(){if(!trainingDraft){return `<div class="section-title"><h3>Novo treino</h3></div><div class="card"><div class="form-row"><div class="field"><label>Data</label><input id="tdate" type="date" value="${today()}"></div><div class="field"><label>Escalão</label><select id="tgroup"><option>Benjamins</option><option>Traquinas</option><option>Todos</option></select></div></div><div class="field"><label>Hora</label><input id="ttime" type="time" value="${C.DEFAULT_TRAINING_TIME}"></div><button class="btn btn-primary btn-block" onclick="startTraining()">Começar registo</button></div>`}
 const people=db.athletes.filter(a=>a.active&&(trainingDraft.group==='Todos'||a.group===trainingDraft.group||a.group==='Traquinas/Benjamins'));
 return `<div class="section-title"><h3>${trainingDraft.group} · ${fmt(trainingDraft.date)}</h3></div><div class="toolbar"><button class="btn btn-ghost" onclick="setAll('Presente')">Todos presentes</button><button class="btn btn-ghost" onclick="setBase4()">Avaliação base 4</button></div><div class="list" style="margin-top:10px">${people.map(cardTraining).join('')}</div><div style="height:12px"></div><button class="btn btn-primary btn-block" onclick="saveTraining()">Guardar treino</button>`}
function startTraining(){trainingDraft={id:uid('t'),date:el('tdate').value,time:el('ttime').value,group:el('tgroup').value,createdBy:session.userId,records:{}};render()}
function ensureRec(id){if(!trainingDraft.records[id])trainingDraft.records[id]={status:'Presente',attitude:4,effort:4,behavior:4,note:''};return trainingDraft.records[id]}
function cardTraining(a){const r=ensureRec(a.id);return `<div class="card"><div class="athlete"><div class="avatar">${initials(a.name)}</div><div class="grow"><strong>${esc(a.name)}</strong><div class="muted">${esc(a.group)}</div></div></div><div class="attendance">${['Presente','Falta','Justificada'].map(s=>`<button class="${r.status===s?'sel-'+(s==='Presente'?'present':s==='Falta'?'absent':'justified'):''}" onclick="setStatus('${a.id}','${s}')">${s==='Presente'?'✅':s==='Falta'?'❌':'🟡'} ${s}</button>`).join('')}</div>${r.status==='Presente'?['attitude|Atitude','effort|Empenho','behavior|Comportamento'].map(z=>{const[k,l]=z.split('|');return `<div class="metric"><div class="metric-head"><b>${l}</b><span>${r[k]}/5</span></div><div class="rating">${[1,2,3,4,5].map(n=>`<button class="${Number(r[k])===n?'active':''}" onclick="rate('${a.id}','${k}',${n})">${n}</button>`).join('')}</div></div>`}).join(''):''}<div class="field"><textarea rows="2" placeholder="Observação opcional" onchange="note('${a.id}',this.value)">${esc(r.note||'')}</textarea></div></div>`}
function setStatus(id,s){ensureRec(id).status=s;render()}function rate(id,k,n){ensureRec(id)[k]=n;render()}function note(id,v){ensureRec(id).note=v}function setAll(s){Object.keys(trainingDraft.records).forEach(id=>trainingDraft.records[id].status=s);render()}function setBase4(){Object.keys(trainingDraft.records).forEach(id=>Object.assign(trainingDraft.records[id],{attitude:4,effort:4,behavior:4}));render()}
function saveTraining(){db.trainings.push({id:trainingDraft.id,date:trainingDraft.date,time:trainingDraft.time,group:trainingDraft.group,createdBy:trainingDraft.createdBy});Object.entries(trainingDraft.records).forEach(([athleteId,r])=>db.records.push({id:uid('r'),trainingId:trainingDraft.id,athleteId,...r}));save();trainingDraft=null;view='dashboard';render();toast('Treino guardado')}

function scoreAthlete(a){const p=attendancePct(a.id),e=avg(a.id,'effort')*20,at=avg(a.id,'attitude')*20,b=avg(a.id,'behavior')*20;return Math.round(p*.35+e*.30+at*.20+b*.15)}
function dashboard(){const active=db.athletes.filter(a=>a.active),ranked=active.map(a=>({...a,score:scoreAthlete(a)})).sort((a,b)=>b.score-a.score),ass=active.length?Math.round(active.reduce((s,a)=>s+attendancePct(a.id),0)/active.length):0,emp=active.length?(active.reduce((s,a)=>s+avg(a.id,'effort'),0)/active.length).toFixed(1):'0.0';return `<div class="section-title"><h3>Dashboard técnico</h3></div><div class="grid"><div class="card kpi"><span>Assiduidade média</span><strong>${ass}%</strong></div><div class="card kpi"><span>Empenho médio</span><strong>${emp}</strong></div><div class="card kpi"><span>Treinos registados</span><strong>${db.trainings.length}</strong></div><div class="card kpi"><span>Atletas</span><strong>${active.length}</strong></div></div><div class="section-title"><h3>Índice de treino</h3></div><div class="list">${ranked.map((a,i)=>`<div class="card rank"><div class="rank-num">${i+1}</div><div class="grow"><strong>${esc(a.name)}</strong><div class="muted">${attendancePct(a.id)}% presença · Empenho ${avg(a.id,'effort').toFixed(1)}</div><div class="bar"><i style="width:${a.score}%"></i></div></div><div class="score">${a.score}</div></div>`).join('')}</div>`}

function callup(){return `<div class="section-title"><h3>Nova convocatória</h3></div><div class="card"><div class="form-row"><div class="field"><label>Adversário</label><input id="opp" placeholder="Ex.: CDR Salvadense"></div><div class="field"><label>Data</label><input id="gdate" type="date" value="${today()}"></div></div><div class="form-row"><div class="field"><label>Escalão</label><select id="ggroup"><option>Benjamins</option><option>Traquinas</option></select></div><div class="field"><label>N.º jogadores</label><input id="gnum" type="number" min="1" value="12"></div></div><button class="btn btn-primary btn-block" onclick="suggestCallup()">Gerar sugestão</button></div><div id="callupResult"></div>`}
function suggestCallup(){const group=el('ggroup').value,n=Number(el('gnum').value||12),opp=el('opp').value||'Adversário',date=el('gdate').value,eligible=db.athletes.filter(a=>a.active&&(a.group===group||a.group==='Traquinas/Benjamins')).map(a=>({...a,score:scoreAthlete(a)})).sort((a,b)=>b.score-a.score),selected=eligible.slice(0,n);el('callupResult').innerHTML=`<div class="section-title"><h3>Sugestão · ${esc(opp)}</h3><span class="pill">${fmt(date)}</span></div><div class="list">${eligible.map((a,i)=>`<div class="card athlete"><div class="avatar">${initials(a.name)}</div><div class="grow"><strong>${esc(a.name)}</strong><div class="muted">Índice ${a.score} · ${attendancePct(a.id)}% presença</div></div><span class="pill ${i<n?'green':''}">${i<n?'Convocar':'Reserva'}</span></div>`).join('')}</div><div style="height:12px"></div><button class="btn btn-primary btn-block" onclick='saveCallup(${JSON.stringify(JSON.stringify({opp,date,group,ids:selected.map(x=>x.id),createdBy:session.userId}))})'>Guardar convocatória</button>`}
function saveCallup(json){db.callups.push({id:uid('c'),...JSON.parse(json)});save();toast('Convocatória guardada')}

function users(){
 if(!isAdmin())return '<div class="restricted">Apenas o Administrador pode gerir utilizadores.</div>';
 const rows=db.users.map(u=>`<div class="card user-row"><div class="user-icon">${u.role==='admin'?'A':'T'}</div><div class="grow"><strong>${esc(u.name)}</strong><div class="muted">@${esc(u.username)} · ${u.role==='admin'?'Administrador':'Treinador'} · ${u.active?'Ativo':'Inativo'}</div></div><div class="actions"><button class="btn btn-small btn-ghost" onclick="editUser('${u.id}')">Editar</button>${u.id!==session.userId?`<button class="btn btn-small btn-danger" onclick="toggleUser('${u.id}')">${u.active?'Desativar':'Ativar'}</button>`:''}</div></div>`).join('');
 return `<div class="section-title"><h3>Utilizadores</h3><button class="btn btn-primary" onclick="addUser()">+ Adicionar</button></div><div class="restricted">🔐 Apenas o Administrador tem acesso a esta área. Os PIN serão transferidos para o backend Google Sheets/Apps Script na ligação definitiva.</div><div class="list">${rows}</div>`;
}
function addUser(){if(!isAdmin())return;const name=prompt('Nome do utilizador:');if(!name)return;const username=prompt('Utilizador para login:');if(!username)return;const pin=prompt('PIN (mínimo 4 dígitos):');if(!pin||pin.length<4)return toast('PIN inválido');const role=(prompt('Perfil: admin ou treinador','treinador')||'treinador').toLowerCase()==='admin'?'admin':'treinador';if(db.users.some(u=>u.username.toLowerCase()===username.toLowerCase()))return toast('Esse utilizador já existe');db.users.push({id:uid('u'),name:name.trim(),username:username.trim(),pin:pin.trim(),role,active:true});save();render();toast('Utilizador criado')}
function editUser(id){if(!isAdmin())return;const u=db.users.find(x=>x.id===id);if(!u)return;const name=prompt('Nome:',u.name);if(!name)return;const username=prompt('Utilizador:',u.username);if(!username)return;const pin=prompt('Novo PIN (deixa igual para manter):',u.pin);if(!pin||pin.length<4)return toast('PIN inválido');const role=(prompt('Perfil: admin ou treinador',u.role)||u.role).toLowerCase()==='admin'?'admin':'treinador';u.name=name.trim();u.username=username.trim();u.pin=pin.trim();u.role=role;save();if(id===session.userId){session.role=role;session.name=u.name;saveSession(session)}render();toast('Utilizador atualizado')}
function toggleUser(id){if(!isAdmin())return;const u=db.users.find(x=>x.id===id);if(!u)return;u.active=!u.active;save();render();toast(u.active?'Utilizador ativado':'Utilizador desativado')}

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
render();
