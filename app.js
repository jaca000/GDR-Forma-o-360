const C = window.GDR_CONFIG;
let token = localStorage.getItem("gdr360_token") || "",
  user = JSON.parse(localStorage.getItem("gdr360_user") || "null");
let state = {
  athletes: [],
  trainings: [],
  records: [],
  games: [],
  callups: [],
  users: [],
  monthlyFees: [],
  events: [],
  lineups: [],
  plannedAbsences: [],
  gameAvailability: [],
  settings: { feeAmount: 10 },
};
let view = "home",
  draft = null,
  callupDraft = null,
  selectedAthleteId = null,
  feeDraft = null,
  lineupDraft = null;
let availabilityDraft = null;

const $ = (id) => document.getElementById(id);
const esc = (s = "") =>
  String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
const uid = (p) =>
  p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const fmt = (d) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-PT") : "";
const admin = () => user?.role === "admin";
const sortName = (arr) =>
  [...arr].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-PT", { sensitivity: "base" }),
  );
const monthKey = (d) => String(d || "").slice(0, 7);

function toast(t) {
  const x = document.createElement("div");
  x.className = "toast";
  x.textContent = t;
  document.body.appendChild(x);
  setTimeout(() => x.remove(), 2200);
}
async function api(action, payload = {}) {
  if (!C.API_URL) throw new Error("API_URL ainda não configurado em config.js");
  const r = await fetch(C.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, token, ...payload }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Erro na API");
  return j;
}
function groupClass(g) {
  return g === "Benjamins"
    ? "benjamins"
    : g === "Traquinas"
      ? "traquinas"
      : "misto";
}
function groupBadge(g) {
  return `<span class="group-badge ${groupClass(g)}">${esc(g)}</span>`;
}
function avatar(a, cls = "") {
  return `<div class="avatar ${cls}">${
    a.photoUrl
      ? `<img src="${esc(a.photoUrl)}" alt="">`
      : esc(
          a.name
            .split(" ")
            .slice(0, 2)
            .map((x) => x[0])
            .join("")
            .toUpperCase(),
        )
  }</div>`;
}
function shirtNumber(a, equipment) {
  return equipment === "Branco" ? a.whiteNumber || "—" : a.redNumber || "—";
}

function loginScreen(err = "") {
  return `<div class="login-page"><div class="login-card"><img class="login-logo" src="logo-formacao-gdr.png"><h1>GDR Formação 360</h1><p>Área reservada à equipa técnica</p>${err ? `<div class="error">${esc(err)}</div>` : ""}<div class="field"><label>Utilizador</label><input id="lu" autocomplete="username"></div><div class="field"><label>PIN</label><input id="lp" class="pin" type="password" inputmode="numeric" maxlength="8"></div><button class="btn btn-primary btn-block" onclick="login()">Entrar</button></div></div>`;
}
async function login() {
  try {
    const j = await api("login", {
      username: $("lu").value,
      pin: $("lp").value,
    });
    token = j.token;
    user = j.user;
    localStorage.setItem("gdr360_token", token);
    localStorage.setItem("gdr360_user", JSON.stringify(user));
    await refresh();
    view = "home";
    render();
  } catch (e) {
    $("app").innerHTML = loginScreen(e.message);
  }
}
function logout() {
  token = "";
  user = null;
  localStorage.removeItem("gdr360_token");
  localStorage.removeItem("gdr360_user");
  render();
}
async function refresh() {
  const j = await api("getData");
  state = j.data;
}

function nav() {
  return `<nav class="nav">${[
    ["home", "⌂", "Início"],
    ["training", "⚽", "Treino"],
    ["fees", "€", "Mensalidades"],
    ["calendar", "📅", "Calendário"],
    ["weekly", "📊", "Semana"],
  ]
    .map(
      ([v, i, t]) =>
        `<button class="${view === v ? "active" : ""}" onclick="go('${v}')"><span class="ico">${i}</span>${t}</button>`,
    )
    .join("")}</nav>`;
}
function shell(body) {
  return `<div class="app"><header class="topbar"><div class="brand">${view !== "home" ? '<button class="back-btn" onclick="goBack()" aria-label="Voltar">←</button>' : ""}<img class="brand-logo" src="logo-formacao-gdr.png"><div class="brand-copy"><h1>${C.APP_NAME}</h1><small>${esc(user.name)}</small></div><span class="role">${admin() ? "Administrador" : "Treinador"}</span><button class="logout" onclick="logout()">Sair</button></div></header><main class="content">${body}</main>${nav()}</div>`;
}
function go(v) {
  view = v;
  draft = null;
  callupDraft = null;
  selectedAthleteId = null;
  render();
}
function goBack() {
  if (view === "athleteForm") {
    view = "athletes";
    render();
    return;
  }
  if (view === "userForm") {
    view = "users";
    render();
    return;
  }
  if (view === "athleteProfile") {
    view = "athletes";
    selectedAthleteId = null;
    render();
    return;
  }
  if (view === "games") {
    view = "home";
    render();
    return;
  }
  if (view === "training" && draft) {
    draft = null;
    render();
    return;
  }
  if (view === "callup" && callupDraft) {
    callupDraft = null;
    render();
    return;
  }
  if (view === "feeForm") {
    view = "fees";
    feeDraft = null;
    render();
    return;
  }
  if (view === "eventForm") {
    view = "calendar";
    render();
    return;
  }
  if (view === "lineup") {
    lineupDraft = null;
    view = "games";
    render();
    return;
  }
  if (view === "absences") {
    view = "home";
    render();
    return;
  }
  if (view === "availability") {
    availabilityDraft = null;
    view = "games";
    render();
    return;
  }
  if (view === "weekly") {
    view = "home";
    render();
    return;
  }
  view = "home";
  draft = null;
  callupDraft = null;
  selectedAthleteId = null;
  render();
}

function athleteRecords(id) {
  return state.records.filter((x) => x.athleteId === id);
}
function attendancePct(id) {
  const r = athleteRecords(id);
  return r.length
    ? Math.round(
        (r.filter((x) => x.status === "Presente").length / r.length) * 100,
      )
    : 0;
}
function avg(id, k) {
  const r = athleteRecords(id).filter(
    (x) => x.status === "Presente" && Number(x[k]),
  );
  return r.length ? r.reduce((s, x) => s + Number(x[k]), 0) / r.length : 0;
}
function score(a) {
  return Math.round(
    attendancePct(a.id) * 0.35 +
      avg(a.id, "effort") * 20 * 0.3 +
      avg(a.id, "attitude") * 20 * 0.2 +
      avg(a.id, "behavior") * 20 * 0.15,
  );
}
function athleteCallups(id) {
  return state.callups.filter(
    (c) => c.athleteId === id && c.status === "Convocado",
  );
}
function recentRecords(id, n = 5) {
  return athleteRecords(id)
    .slice()
    .sort((a, b) =>
      trainingDate(b.trainingId).localeCompare(trainingDate(a.trainingId)),
    )
    .slice(0, n);
}
function trainingDate(id) {
  return state.trainings.find((t) => t.id === id)?.date || "";
}
function trend(id, key) {
  const r = recentRecords(id, 6)
    .filter((x) => x.status === "Presente" && Number(x[key]))
    .reverse();
  if (r.length < 4) return { label: "Sem tendência", cls: "neutral", delta: 0 };
  const half = Math.floor(r.length / 2),
    a = r.slice(0, half),
    b = r.slice(half);
  const av = (x) => x.reduce((s, v) => s + Number(v[key]), 0) / x.length;
  const d = av(b) - av(a);
  return d > 0.35
    ? { label: "Em evolução", cls: "up", delta: d }
    : d < -0.35
      ? { label: "Em quebra", cls: "down", delta: d }
      : { label: "Estável", cls: "neutral", delta: d };
}
function athleteTrend(id) {
  const keys = ["attitude", "effort", "behavior"];
  const d = keys.reduce((s, k) => s + trend(id, k).delta, 0) / keys.length;
  return d > 0.25
    ? { label: "Em evolução", icon: "📈", cls: "up" }
    : d < -0.25
      ? { label: "Em quebra", icon: "📉", cls: "down" }
      : { label: "Estável", icon: "➡️", cls: "neutral" };
}
function tagsCount(id) {
  const map = {};
  athleteRecords(id).forEach((r) =>
    (r.tags || []).forEach((t) => (map[t] = (map[t] || 0) + 1)),
  );
  return map;
}

function home() {
  const today = new Date().toISOString().slice(0, 10),
    active = state.athletes.filter((a) => a.active),
    events = allEvents(),
    todayEvents = events.filter((e) => e.date === today),
    nextEvent = events.find((e) => e.date > today),
    planned = (state.plannedAbsences || []).filter(
      (x) => x.active && x.date >= today,
    ),
    todayAbsences = planned.filter((x) => x.date === today),
    lights = active.map((a) => ({ a, light: trafficLight(a.id) })),
    green = lights.filter((x) => x.light.cls === "green").length,
    yellow = lights.filter((x) => x.light.cls === "yellow").length,
    red = lights.filter((x) => x.light.cls === "red").length,
    attention = lights.filter((x) => x.light.cls !== "green").slice(0, 4),
    lastTraining = [...state.trainings].sort((a, b) =>
      String(b.date).localeCompare(String(a.date)),
    )[0],
    lastRecords = lastTraining
      ? state.records.filter((r) => r.trainingId === lastTraining.id)
      : [],
    lastPresent = lastRecords.filter((r) => r.status === "Presente").length,
    missingPhotos = active.filter((a) => !a.photoUrl).length,
    missingNumbers = active.filter(
      (a) => !a.redNumber || !a.whiteNumber,
    ).length,
    upcomingGames = state.games.filter((g) => g.date >= today),
    gamesWithoutLineup = upcomingGames.filter(
      (g) => !state.lineups.some((l) => l.gameId === g.id),
    ).length,
    currentMonth = today.slice(0, 7),
    feesStarted = currentMonth >= (state.settings?.feeStartMonth || "2026-10"),
    feeRows = active.map((a) => ({
      a,
      f: feeFor(a.id, currentMonth, seasonNow()),
    })),
    feesPaid = feeRows.filter((x) => x.f?.status === "Pago").length,
    feesMissing = feesStarted
      ? feeRows.filter((x) => feeStatus(x.f, currentMonth) === "Em falta")
          .length
      : 0;
  const tasks = [
    todayAbsences.length
      ? {
          icon: "📆",
          text: `${todayAbsences.length} falta(s) antecipada(s) hoje`,
          action: "go('absences')",
        }
      : null,
    red + yellow
      ? {
          icon: "🚦",
          text: `${red + yellow} atleta(s) a acompanhar`,
          action: "go('dashboard')",
        }
      : null,
    gamesWithoutLineup
      ? {
          icon: "🗺️",
          text: `${gamesWithoutLineup} jogo(s) futuro(s) sem sete inicial`,
          action: "view='games';render()",
        }
      : null,
    admin() && feesMissing
      ? {
          icon: "💶",
          text: `${feesMissing} mensalidade(s) em falta`,
          action: "go('fees')",
        }
      : null,
    admin() && missingPhotos
      ? {
          icon: "📷",
          text: `${missingPhotos} atleta(s) sem fotografia`,
          action: "go('athletes')",
        }
      : null,
    admin() && missingNumbers
      ? {
          icon: "👕",
          text: `${missingNumbers} atleta(s) com números de equipamento em falta`,
          action: "go('athletes')",
        }
      : null,
  ].filter(Boolean);
  return `<section class="dashboard-hero"><div><span class="eyebrow">${new Date(today + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}</span><h2>Olá, ${esc(user.name)}</h2><p>${todayEvents.length ? `${todayEvents.length} evento(s) marcado(s) para hoje.` : nextEvent ? `Próximo: ${esc(nextEvent.title)} em ${fmt(nextEvent.date)}.` : "Sem eventos futuros marcados."}</p></div><button class="btn btn-primary" onclick="go('training')">⚡ Registar treino</button></section>
  <div class="home-layout"><section><div class="section"><h3>Hoje e a seguir</h3><button class="btn btn-small btn-ghost" onclick="go('calendar')">Calendário</button></div><div class="list">${todayEvents.length ? todayEvents.map(eventCard).join("") : nextEvent ? eventCard(nextEvent) : '<div class="card empty">Sem eventos agendados.</div>'}</div>
  <div class="section"><h3>Estado da formação</h3></div><div class="status-grid"><button class="card status-card green" onclick="go('athletes')"><span>🟢 Normal</span><strong>${green}</strong></button><button class="card status-card yellow" onclick="go('dashboard')"><span>🟡 A acompanhar</span><strong>${yellow}</strong></button><button class="card status-card red" onclick="go('dashboard')"><span>🔴 Atenção</span><strong>${red}</strong></button></div>
  ${attention.length ? `<div class="attention-list">${attention.map(({ a, light }) => `<button onclick="openAthlete('${a.id}')">${avatar(a)}<span><b>${esc(a.name)}</b><small>${esc(light.reasons[0] || light.label)}</small></span><i>${light.icon}</i></button>`).join("")}</div>` : ""}
  <div class="section"><h3>Último treino</h3></div>${lastTraining ? `<div class="card last-training"><div><b>${fmt(lastTraining.date)}</b><span>${esc(lastTraining.group)}</span></div><div><strong>${lastPresent}/${lastRecords.length}</strong><span>presentes</span></div><div><strong>${lastRecords.length ? Math.round((lastPresent / lastRecords.length) * 100) : 0}%</strong><span>assiduidade</span></div></div>` : '<div class="card empty">Ainda sem treinos registados.</div>'}</section>
  <aside><div class="section"><h3>Tarefas pendentes</h3><span class="task-count">${tasks.length}</span></div><div class="task-list">${tasks.map((t) => `<button class="card" onclick="${t.action}"><span>${t.icon}</span><b>${esc(t.text)}</b><i>›</i></button>`).join("") || '<div class="card all-good">✓ Não existem tarefas urgentes.</div>'}</div>
  <div class="section"><h3>Faltas comunicadas</h3><button class="btn btn-small btn-ghost" onclick="go('absences')">Gerir</button></div><div class="card mini-summary"><strong>${planned.length}</strong><span>próximas</span><b>${todayAbsences.length} hoje</b></div>
  <div class="section"><h3>Mensalidades</h3><button class="btn btn-small btn-ghost" onclick="go('fees')">Abrir</button></div>${feesStarted ? `<div class="card mini-summary"><strong>${feesPaid}/${active.length}</strong><span>pagas este mês</span><b class="${feesMissing ? "danger-text" : ""}">${feesMissing} em falta</b></div>` : '<div class="card mini-summary future"><strong>Outubro 2026</strong><span>início das mensalidades</span></div>'}</aside></div>
  <div class="section"><h3>Ações rápidas</h3></div><div class="quick-grid compact"><button class="btn btn-secondary" onclick="go('weekly')">📊 Resumo semanal</button><button class="btn btn-secondary" onclick="go('absences')">📆 Falta antecipada</button><button class="btn btn-secondary" onclick="view='games';render()">⚽ Jogos e disponibilidade</button><button class="btn btn-secondary" onclick="go('callup')">📋 Novo jogo</button><button class="btn btn-secondary" onclick="go('athletes')">👥 Atletas</button>${admin() ? '<button class="btn btn-secondary" onclick="view=\'users\';render()">🔐 Utilizadores</button>' : ""}</div>`;
}

function absences() {
  const today = new Date().toISOString().slice(0, 10),
    upcoming = (state.plannedAbsences || [])
      .filter((x) => x.active && x.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date)),
    groupOf = (absence) =>
      state.athletes.find((a) => a.id === absence.athleteId)?.group || "",
    traquinas = upcoming.filter((x) => groupOf(x) === "Traquinas").length,
    benjamins = upcoming.filter((x) => groupOf(x) === "Benjamins").length,
    mixed = upcoming.filter((x) => groupOf(x) === "Traquinas/Benjamins").length;
  return `<div class="section"><div><h3>Faltas antecipadas</h3><div class="muted">Para ausências comunicadas pelos pais antes do treino.</div></div></div><div class="card"><div class="field"><label>Atleta</label><select id="paa">${sortName(
    state.athletes.filter((a) => a.active),
  )
    .map(
      (a) =>
        `<option value="${a.id}">${esc(a.name)} · ${esc(a.group)}</option>`,
    )
    .join(
      "",
    )}</select></div><div class="form2"><div class="field"><label>Data da falta</label><input id="pad" type="date" min="${today}" value="${today}"></div><div class="field"><label>Motivo</label><select id="par"><option>Doença</option><option>Escola</option><option>Família</option><option>Outro</option></select></div></div><div class="field"><label>Observação opcional</label><textarea id="pan" placeholder="Informação comunicada pelos pais"></textarea></div><button class="btn btn-primary btn-block" onclick="savePlannedAbsence()">Registar falta antecipada</button></div><div class="section"><h3>Resumo das próximas faltas</h3></div><div class="absence-summary"><div class="card total"><span>Total</span><strong>${upcoming.length}</strong></div><div class="card traquinas"><span>Traquinas</span><strong>${traquinas}</strong></div><div class="card benjamins"><span>Benjamins</span><strong>${benjamins}</strong></div>${mixed ? `<div class="card mixed"><span>Misto</span><strong>${mixed}</strong></div>` : ""}</div><div class="section"><h3>Próximas faltas comunicadas</h3></div><div class="list">${
    upcoming
      .map((x) => {
        const a = state.athletes.find((p) => p.id === x.athleteId);
        return `<div class="card absence-row">${a ? avatar(a) : ""}<div class="grow"><div class="absence-name"><strong>${esc(a?.name || "Atleta")}</strong>${a ? groupBadge(a.group) : ""}</div><div>${fmt(x.date)} · ${esc(x.reason)}</div>${x.note ? `<div class="muted">${esc(x.note)}</div>` : ""}</div><button class="btn btn-small btn-danger" onclick="deletePlannedAbsence('${x.id}')">Cancelar</button></div>`;
      })
      .join("") ||
    '<div class="card empty">Não existem faltas antecipadas registadas.</div>'
  }</div>`;
}
async function savePlannedAbsence() {
  try {
    await api("savePlannedAbsence", {
      absence: {
        athleteId: $("paa").value,
        date: $("pad").value,
        reason: $("par").value,
        note: $("pan").value.trim(),
      },
    });
    await refresh();
    render();
    toast("Falta antecipada registada");
  } catch (e) {
    toast(e.message);
  }
}
async function deletePlannedAbsence(id) {
  if (!confirm("Cancelar esta falta antecipada?")) return;
  try {
    await api("deletePlannedAbsence", { id });
    await refresh();
    render();
    toast("Falta antecipada cancelada");
  } catch (e) {
    toast(e.message);
  }
}

function athletes() {
  const aa = sortName(state.athletes.filter((a) => a.active));
  return `<div class="section"><h3>Atletas</h3>${admin() ? '<button class="btn btn-primary" onclick="athleteForm()">+ Adicionar</button>' : ""}</div>
 ${!admin() ? '<div class="admin-note">🔒 O treinador pode consultar os atletas. Adicionar, editar e eliminar é exclusivo do Administrador.</div>' : ""}
 <div class="list">${aa
   .map((a) => {
     const l = trafficLight(a.id);
     return `<div class="card athlete clickable" onclick="openAthlete('${a.id}')">${avatar(a)}<div class="grow"><strong>${esc(a.name)}</strong><div class="athlete-meta">${groupBadge(a.group)}<span class="shirt-mini redshirt">🔴 ${esc(a.redNumber || "—")}</span><span class="shirt-mini whiteshirt">⚪ ${esc(a.whiteNumber || "—")}</span></div><div class="muted">${attendancePct(a.id)}% presença · ${athleteTrend(a.id).icon} ${athleteTrend(a.id).label}</div></div><span class="traffic ${l.cls}" title="${esc(l.reasons.join(" · "))}">${l.icon}</span>${admin() ? `<div class="actions" onclick="event.stopPropagation()"><button class="btn btn-small btn-ghost" onclick="athleteForm('${a.id}')">Editar</button><button class="btn btn-small btn-danger" onclick="deleteAthlete('${a.id}')">Eliminar</button></div>` : '<span class="chev">›</span>'}</div>`;
   })
   .join("")}</div>`;
}
function openAthlete(id) {
  selectedAthleteId = id;
  view = "athleteProfile";
  render();
}
function athleteForm(id = "") {
  if (!admin()) return;
  const a = id ? state.athletes.find((x) => x.id === id) : null;
  view = "athleteForm";
  $("app").innerHTML = shell(
    `<div class="section"><h3>${a ? "Editar" : "Novo"} atleta</h3></div><div class="card"><div class="photo-preview" id="photoPreview">${a?.photoUrl ? `<img src="${esc(a.photoUrl)}">` : "Sem foto"}</div><div class="field"><label>Fotografia</label><input id="aphoto" type="file" accept="image/*" capture="environment" onchange="previewPhoto(this)"><div class="muted">A imagem será reduzida automaticamente antes do envio.</div></div><div class="field"><label>Nome</label><input id="aname" value="${esc(a?.name || "")}"></div><div class="field"><label>Escalão</label><select id="agroup"><option ${a?.group === "Benjamins" ? "selected" : ""}>Benjamins</option><option ${a?.group === "Traquinas" ? "selected" : ""}>Traquinas</option><option ${a?.group === "Traquinas/Benjamins" ? "selected" : ""}>Traquinas/Benjamins</option></select></div><div class="form2"><div class="field"><label>N.º equipamento vermelho</label><input id="ared" inputmode="numeric" value="${esc(a?.redNumber || "")}" placeholder="Ex.: 7"></div><div class="field"><label>N.º equipamento branco</label><input id="awhite" inputmode="numeric" value="${esc(a?.whiteNumber || "")}" placeholder="Ex.: 12"></div></div><button class="btn btn-primary btn-block" onclick="saveAthlete('${id}')">Guardar atleta</button></div>`,
  );
}
function previewPhoto(inp) {
  const f = inp.files[0];
  if (!f) return;
  const u = URL.createObjectURL(f);
  $("photoPreview").innerHTML = `<img src="${u}">`;
}
async function resizePhoto(file) {
  return new Promise((res, rej) => {
    const img = new Image(),
      u = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width,
        h = img.height,
        max = 520;
      if (w > h && w > max) {
        h = Math.round((h * max) / w);
        w = max;
      } else if (h >= w && h > max) {
        w = Math.round((w * max) / h);
        h = max;
      }
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(u);
      res(c.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = rej;
    img.src = u;
  });
}
async function saveAthlete(id) {
  try {
    const file = $("aphoto").files[0];
    let photoBase64 = "";
    if (file) photoBase64 = await resizePhoto(file);
    await api("saveAthlete", {
      athlete: {
        id,
        name: $("aname").value.trim(),
        group: $("agroup").value,
        redNumber: $("ared").value.trim(),
        whiteNumber: $("awhite").value.trim(),
      },
      photoBase64,
    });
    await refresh();
    view = "athletes";
    render();
    toast("Atleta guardado");
  } catch (e) {
    toast(e.message);
  }
}
async function deleteAthlete(id) {
  if (!confirm("Remover este atleta da lista ativa?")) return;
  try {
    await api("deleteAthlete", { id });
    await refresh();
    render();
    toast("Atleta removido");
  } catch (e) {
    toast(e.message);
  }
}

function athleteProfile() {
  const a = state.athletes.find((x) => x.id === selectedAthleteId);
  if (!a) return '<div class="empty">Atleta não encontrado.</div>';
  const r = athleteRecords(a.id)
    .slice()
    .sort((x, y) =>
      trainingDate(y.trainingId).localeCompare(trainingDate(x.trainingId)),
    );
  const tr = athleteTrend(a.id),
    calls = athleteCallups(a.id),
    tc = tagsCount(a.id),
    light = trafficLight(a.id);
  return `<div class="profile-head card">${avatar(a, "avatar-xl")}<div class="grow"><h2>${esc(a.name)}</h2><div class="athlete-meta">${groupBadge(a.group)}<span class="shirt-mini redshirt">🔴 #${esc(a.redNumber || "—")}</span><span class="shirt-mini whiteshirt">⚪ #${esc(a.whiteNumber || "—")}</span></div><div class="trend ${tr.cls}">${tr.icon} ${tr.label}</div></div><button class="btn btn-small btn-secondary" onclick="printAthleteReport('${a.id}')">📄 PDF</button></div>
 <div class="card traffic-detail ${light.cls}"><strong>${light.icon} ${light.label}</strong><div>${light.reasons.map(esc).join(" · ")}</div></div><div class="grid profile-kpis"><div class="card kpi"><span>Assiduidade</span><strong>${attendancePct(a.id)}%</strong></div><div class="card kpi"><span>Empenho</span><strong>${avg(a.id, "effort").toFixed(1)}</strong></div><div class="card kpi"><span>Atitude</span><strong>${avg(a.id, "attitude").toFixed(1)}</strong></div><div class="card kpi"><span>Comportamento</span><strong>${avg(a.id, "behavior").toFixed(1)}</strong></div><div class="card kpi"><span>Treinos</span><strong>${r.length}</strong></div><div class="card kpi"><span>Convocatórias</span><strong>${calls.length}</strong></div></div>
 <div class="section"><h3>Evolução recente</h3></div>${evolutionBars(a.id)}
 ${
   Object.keys(tc).length
     ? `<div class="section"><h3>Tags registadas</h3></div><div class="tag-cloud">${Object.entries(
         tc,
       )
         .sort((a, b) => b[1] - a[1])
         .map(([t, n]) => `<span>${esc(t)} <b>${n}</b></span>`)
         .join("")}</div>`
     : ""
 }
 <div class="section"><h3>Histórico de treinos</h3></div><div class="list">${
   r
     .slice(0, 20)
     .map(
       (x) =>
         `<div class="card history-row"><div><strong>${fmt(trainingDate(x.trainingId))}</strong><div class="muted">${esc(x.status)}${x.absenceReason ? ` · ${esc(x.absenceReason)}` : ""}</div></div><div class="grow"></div>${x.status === "Presente" ? `<div class="mini-score">A ${x.attitude} · E ${x.effort} · C ${x.behavior}</div>` : ""}${x.tags?.length ? `<div class="history-tags">${x.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}</div>`,
     )
     .join("") || '<div class="empty">Ainda sem registos.</div>'
 }</div>
 <div class="section"><h3>Convocatórias</h3></div><div class="list">${
   calls
     .slice()
     .sort((a, b) => gameDate(b.gameId).localeCompare(gameDate(a.gameId)))
     .map((c) => {
       const g = state.games.find((x) => x.id === c.gameId);
       return `<div class="card history-row"><strong>${fmt(g?.date)}</strong><div class="grow"><div>${esc(g?.opponent || "Jogo")}</div><div class="muted">${esc(g?.equipment || "")} · #${esc(shirtNumber(a, g?.equipment || "Vermelho"))}</div></div></div>`;
     })
     .join("") || '<div class="empty">Ainda sem convocatórias.</div>'
 }</div>`;
}
function evolutionBars(id) {
  const rs = recentRecords(id, 8)
    .reverse()
    .filter((r) => r.status === "Presente");
  if (!rs.length) return '<div class="card empty">Sem dados suficientes.</div>';
  return `<div class="card evolution-chart">${rs
    .map((r) => {
      const d = fmt(trainingDate(r.trainingId));
      const m =
        (Number(r.attitude) + Number(r.effort) + Number(r.behavior)) / 3;
      return `<div class="evo-col"><div class="evo-value">${m.toFixed(1)}</div><div class="evo-bar"><i style="height:${(m / 5) * 100}%"></i></div><small>${d.slice(0, 5)}</small></div>`;
    })
    .join("")}</div>`;
}

function training() {
  if (!draft)
    return `<div class="section"><h3>Registo Express</h3><span class="pill red">⚡ Rápido</span></div><div class="card"><div class="field"><label>Escalão</label><select id="tg"><option>Benjamins</option><option>Traquinas</option><option>Todos</option></select></div><div class="muted" style="margin-bottom:11px">Todos começam como <b>Presentes · 4/4/4</b>. Altera só as exceções.</div><button class="btn btn-primary btn-block" onclick="startTraining()">⚡ Iniciar treino</button></div>`;
  const people = trainingPeople(),
    planned = plannedAbsencesForTraining(),
    c = counts(people);
  return `<div class="section"><div><h3>Treino · ${draft.group}</h3><div class="muted">${fmt(draft.date)} · ${draft.time}</div></div><span class="pill red">⚡ Express</span></div><div class="express-summary"><div class="express-stat"><strong>${c.p}</strong><span>Presentes</span></div><div class="express-stat"><strong>${c.f}</strong><span>Faltas</span></div><div class="express-stat"><strong>${c.j}</strong><span>Justificadas</span></div><div class="express-stat"><strong>${planned.length}</strong><span>Antecipadas</span></div></div>${
    planned.length
      ? `<div class="planned-note"><strong>📆 Fora do registo por falta antecipada:</strong>${planned
          .map((x) => {
            const a = state.athletes.find((p) => p.id === x.athleteId);
            return `<span>${esc(a?.name || "Atleta")} · ${esc(x.reason)}</span>`;
          })
          .join("")}</div>`
      : ""
  }<div class="list">${people.map(trainingCard).join("")}</div><div class="sticky-save"><button class="btn btn-primary btn-block" onclick="saveTraining()">Guardar treino · ${c.p} presentes</button></div>`;
}
function startTraining() {
  const n = new Date();
  draft = {
    id: uid("t"),
    date: n.toISOString().slice(0, 10),
    time:
      String(n.getHours()).padStart(2, "0") +
      ":" +
      String(n.getMinutes()).padStart(2, "0"),
    group: $("tg").value,
    records: {},
  };
  trainingPeople().forEach((a) => rec(a.id));
  render();
}
function trainingPeople() {
  const excluded = new Set(
    plannedAbsencesForTraining().map((x) => x.athleteId),
  );
  return sortName(
    state.athletes.filter(
      (a) =>
        a.active &&
        !excluded.has(a.id) &&
        (draft.group === "Todos" ||
          a.group === draft.group ||
          a.group === "Traquinas/Benjamins"),
    ),
  );
}
function plannedAbsencesForTraining() {
  if (!draft) return [];
  return (state.plannedAbsences || []).filter((x) => {
    const a = state.athletes.find((p) => p.id === x.athleteId);
    return (
      x.active &&
      x.date === draft.date &&
      a?.active &&
      (draft.group === "Todos" ||
        a.group === draft.group ||
        a.group === "Traquinas/Benjamins")
    );
  });
}
function rec(id) {
  if (!draft.records[id])
    draft.records[id] = {
      status: "Presente",
      attitude: 4,
      effort: 4,
      behavior: 4,
      note: "",
      absenceReason: "",
      tags: [],
    };
  return draft.records[id];
}
function counts(pp) {
  let p = 0,
    f = 0,
    j = 0,
    c = 0;
  pp.forEach((a) => {
    const r = rec(a.id);
    r.status === "Presente" ? p++ : r.status === "Falta" ? f++ : j++;
    if (
      r.status === "Presente" &&
      (r.attitude !== 4 || r.effort !== 4 || r.behavior !== 4 || r.tags.length)
    )
      c++;
  });
  return { p, f, j, c };
}
const QUICK_TAGS = [
  "⭐ Destaque",
  "📈 Evolução",
  "🎯 Concentração",
  "🤝 Espírito de equipa",
  "⚠️ Disciplina",
  "💪 Empenho",
];
function trainingCard(a) {
  const r = rec(a.id),
    ch =
      r.status !== "Presente" ||
      r.attitude !== 4 ||
      r.effort !== 4 ||
      r.behavior !== 4 ||
      r.tags.length;
  return `<div class="card express-athlete ${ch ? "changed" : ""}"><div class="athlete">${avatar(a)}<div class="grow"><strong>${esc(a.name)}</strong><div class="athlete-meta">${groupBadge(a.group)}</div></div></div>
 <div class="attendance">${["Presente", "Falta", "Justificada"].map((s) => `<button class="${r.status === s ? (s === "Presente" ? "present" : s === "Falta" ? "absent" : "justified") : ""}" onclick="status('${a.id}','${s}')">${s === "Presente" ? "✅" : s === "Falta" ? "❌" : "🟡"} ${s}</button>`).join("")}</div>
 ${r.status === "Justificada" ? `<div class="field compact"><label>Motivo</label><select onchange="rec('${a.id}').absenceReason=this.value"><option value="">Selecionar...</option>${["Doença", "Escola", "Família", "Outro"].map((x) => `<option ${r.absenceReason === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>` : ""}
 ${
   r.status === "Presente"
     ? `<div class="presets"><button class="${r.attitude === 5 && r.effort === 5 && r.behavior === 5 ? "on" : ""}" onclick="preset('${a.id}',5)">🔥<span>Excelente</span></button><button class="${r.attitude === 4 && r.effort === 4 && r.behavior === 4 ? "on" : ""}" onclick="preset('${a.id}',4)">👍<span>Bom</span></button><button class="${r.attitude === 3 && r.effort === 3 && r.behavior === 3 ? "on" : ""}" onclick="preset('${a.id}',3)">⚠️<span>Atenção</span></button><button class="${r.behavior === 2 ? "on" : ""}" onclick="behavior('${a.id}')">🚨<span>Comport.</span></button></div><div class="quick-tags">${QUICK_TAGS.map((t) => `<button class="${r.tags.includes(t) ? "on" : ""}" onclick="toggleTag('${a.id}','${t.replace(/'/g, "\\'")}')">${t}</button>`).join("")}</div><button class="details-toggle" onclick="$('d-${a.id}').classList.toggle('open')">Ajustar individualmente ▾</button><div class="details" id="d-${a.id}">${[
         ["attitude", "Atitude"],
         ["effort", "Empenho"],
         ["behavior", "Comportamento"],
       ]
         .map(
           ([k, l]) =>
             `<div class="metric"><div class="metric-head"><b>${l}</b><span>${r[k]}/5</span></div><div class="rating">${[1, 2, 3, 4, 5].map((n) => `<button class="${r[k] === n ? "on" : ""}" onclick="rate('${a.id}','${k}',${n})">${n}</button>`).join("")}</div></div>`,
         )
         .join(
           "",
         )}<div class="field"><textarea placeholder="Observação opcional" onchange="rec('${a.id}').note=this.value">${esc(r.note)}</textarea></div></div>`
     : ""
 }</div>`;
}
function status(id, s) {
  rec(id).status = s;
  if (s !== "Justificada") rec(id).absenceReason = "";
  render();
}
function preset(id, n) {
  Object.assign(rec(id), {
    status: "Presente",
    attitude: n,
    effort: n,
    behavior: n,
  });
  render();
}
function behavior(id) {
  rec(id).status = "Presente";
  rec(id).behavior = 2;
  render();
}
function rate(id, k, n) {
  rec(id)[k] = n;
  render();
}
function toggleTag(id, t) {
  const r = rec(id),
    i = r.tags.indexOf(t);
  i >= 0 ? r.tags.splice(i, 1) : r.tags.push(t);
  render();
}
async function saveTraining() {
  try {
    await api("saveTraining", {
      training: {
        id: draft.id,
        date: draft.date,
        time: draft.time,
        group: draft.group,
      },
      records: trainingPeople().map((a) => ({
        id: uid("r"),
        athleteId: a.id,
        ...rec(a.id),
      })),
    });
    draft = null;
    await refresh();
    view = "dashboard";
    render();
    toast("Treino guardado");
  } catch (e) {
    toast(e.message);
  }
}

function buildAlerts() {
  const alerts = [];
  state.athletes
    .filter((a) => a.active)
    .forEach((a) => {
      const rs = recentRecords(a.id, 5),
        att = attendancePct(a.id),
        tr = athleteTrend(a.id);
      const last3 = rs.slice(0, 3);
      const abs = last3.filter((r) => r.status !== "Presente").length;
      if (abs >= 2)
        alerts.push({
          level: "warn",
          icon: "⚠️",
          title: a.name,
          text: `${abs} ausências nos últimos ${last3.length} treinos.`,
        });
      if (tr.cls === "down")
        alerts.push({
          level: "danger",
          icon: "📉",
          title: a.name,
          text: "Tendência recente de quebra na avaliação.",
        });
      if (tr.cls === "up")
        alerts.push({
          level: "good",
          icon: "📈",
          title: a.name,
          text: "Evolução positiva nos treinos recentes.",
        });
      if (att > 0 && att < 70)
        alerts.push({
          level: "warn",
          icon: "🗓️",
          title: a.name,
          text: `Assiduidade atual de ${att}%.`,
        });
    });
  return alerts.slice(0, 12);
}
function dashboard() {
  const aa = state.athletes.filter((a) => a.active),
    rank = aa
      .map((a) => ({ ...a, score: score(a) }))
      .sort((a, b) => b.score - a.score),
    alerts = buildAlerts(),
    hi = monthlyHighlights();
  return `<div class="section"><h3>Dashboard técnico</h3></div><div class="grid"><div class="card kpi"><span>Atletas</span><strong>${aa.length}</strong></div><div class="card kpi"><span>Treinos</span><strong>${state.trainings.length}</strong></div><div class="card kpi"><span>Assiduidade média</span><strong>${aa.length ? Math.round(aa.reduce((s, a) => s + attendancePct(a.id), 0) / aa.length) : 0}%</strong></div><div class="card kpi"><span>Empenho médio</span><strong>${aa.length ? (aa.reduce((s, a) => s + avg(a.id, "effort"), 0) / aa.length).toFixed(1) : "0.0"}</strong></div></div>
 <div class="section"><h3>Destaques do mês</h3></div>${hi}
 <div class="section"><h3>Alertas e tendências</h3></div><div class="list">${alerts.map((a) => `<div class="card insight ${a.level}"><strong>${a.icon} ${esc(a.title)}</strong><div class="muted">${esc(a.text)}</div></div>`).join("") || '<div class="card empty">Sem alertas relevantes.</div>'}</div>
 <div class="section"><h3>Índice de treino</h3></div><div class="list">${rank.map((a, i) => `<div class="card rank clickable" onclick="openAthlete('${a.id}')"><div class="rankno">${i + 1}</div>${avatar(a)}<div class="grow"><strong>${esc(a.name)}</strong><div class="muted">${attendancePct(a.id)}% presença · Empenho ${avg(a.id, "effort").toFixed(1)}</div><div class="bar"><i style="width:${a.score}%"></i></div></div><div class="score">${a.score}</div></div>`).join("")}</div>`;
}
function monthlyHighlights() {
  const now = new Date(),
    mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const tids = new Set(
    state.trainings.filter((t) => monthKey(t.date) === mk).map((t) => t.id),
  );
  const rr = state.records.filter(
    (r) => tids.has(r.trainingId) && r.status === "Presente",
  );
  if (!rr.length)
    return '<div class="card empty">Ainda sem dados suficientes neste mês.</div>';
  const aa = state.athletes.filter((a) => a.active);
  const metric = (id, k) => {
    const x = rr.filter((r) => r.athleteId === id && Number(r[k]));
    return x.length ? x.reduce((s, r) => s + Number(r[k]), 0) / x.length : 0;
  };
  const best = (k) =>
    aa.map((a) => ({ a, v: metric(a.id, k) })).sort((x, y) => y.v - x.v)[0]?.a;
  const pres = aa
    .map((a) => ({ a, v: rr.filter((r) => r.athleteId === a.id).length }))
    .sort((x, y) => y.v - x.v)[0]?.a;
  const evol = aa
    .map((a) => ({
      a,
      d: athleteTrend(a.id).cls === "up" ? 1 : 0,
      score: score(a),
    }))
    .sort((x, y) => y.d - x.d || y.score - x.score)[0]?.a;
  return `<div class="highlights-grid">${[
    ["⭐", "Maior evolução", evol],
    ["🔥", "Maior empenho", best("effort")],
    ["🤝", "Melhor comportamento", best("behavior")],
    ["💪", "Mais presenças", pres],
  ]
    .map(
      ([i, l, a]) =>
        `<div class="card highlight">${i}<span>${l}</span><strong>${esc(a?.name || "—")}</strong></div>`,
    )
    .join("")}</div>`;
}

function mondayOf(date = new Date()) {
  const d = new Date(date),
    day = d.getDay() || 7;
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}
function addDays(date, days) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function weeklyData(start) {
  const end = addDays(start, 6),
    trainings = state.trainings.filter((t) => t.date >= start && t.date <= end),
    ids = new Set(trainings.map((t) => t.id)),
    records = state.records.filter((r) => ids.has(r.trainingId)),
    games = state.games.filter((g) => g.date >= start && g.date <= end),
    active = state.athletes.filter((a) => a.active);
  const groupData = ["Traquinas", "Benjamins"].map((group) => {
    const athleteIds = new Set(
        active
          .filter((a) => a.group === group || a.group === "Traquinas/Benjamins")
          .map((a) => a.id),
      ),
      rr = records.filter((r) => athleteIds.has(r.athleteId)),
      present = rr.filter((r) => r.status === "Presente"),
      average = (key) =>
        present.length
          ? (
              present.reduce((sum, r) => sum + Number(r[key] || 0), 0) /
              present.length
            ).toFixed(1)
          : "—";
    return {
      group,
      athletes: athleteIds.size,
      records: rr.length,
      present: present.length,
      absences: rr.length - present.length,
      attendance: rr.length
        ? Math.round((present.length / rr.length) * 100)
        : 0,
      effort: average("effort"),
      behavior: average("behavior"),
    };
  });
  const present = records.filter((r) => r.status === "Presente"),
    planned = (state.plannedAbsences || []).filter(
      (a) => a.active && a.date >= start && a.date <= end,
    ),
    nextEvents = allEvents()
      .filter((e) => e.date > end && e.date <= addDays(end, 7))
      .slice(0, 6),
    tags = {};
  records.forEach((r) =>
    (r.tags || []).forEach((t) => (tags[t] = (tags[t] || 0) + 1)),
  );
  return {
    start,
    end,
    trainings,
    records,
    games,
    groupData,
    attendance: records.length
      ? Math.round((present.length / records.length) * 100)
      : 0,
    planned,
    nextEvents,
    topTags: Object.entries(tags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4),
  };
}
function weekly() {
  const start = $("weeklyStart")?.value || mondayOf(),
    data = weeklyData(start),
    nextGame = availabilityCalendarEvents().find((e) => e.date > data.end),
    nextGroup = nextGame
      ? nextGame.group === "Todos"
        ? "Traquinas"
        : nextGame.group
      : "",
    av = nextGame ? availabilityCounts(nextGame.id, nextGroup) : null;
  return `<div class="section"><div><h3>Resumo semanal</h3><div class="muted">Uma leitura rápida da semana da formação.</div></div><button class="btn btn-secondary" onclick="printWeeklySummary()">🖨️ PDF / Imprimir</button></div>${admin() ? `<div class="card weekly-email"><div class="field"><label>Envio automático à segunda-feira</label><div class="inline-field"><input id="weeklyEmail" type="email" value="${esc(state.settings?.weeklySummaryEmail || "")}" placeholder="nome@exemplo.pt"><button class="btn btn-primary" onclick="saveWeeklySettings()">Guardar email</button><button class="btn btn-secondary" onclick="sendWeeklyNow()">Enviar agora</button></div><div class="muted">O resumo da semana anterior é enviado automaticamente todas as segundas-feiras de manhã.</div></div></div>` : ""}<div class="card week-picker"><button class="btn btn-ghost" onclick="changeWeek(-7)">← Semana anterior</button><div><label>Semana com início em</label><input id="weeklyStart" type="date" value="${start}" onchange="render()"></div><button class="btn btn-ghost" onclick="changeWeek(7)">Semana seguinte →</button></div><div class="weekly-hero"><div><span>${fmt(data.start)} — ${fmt(data.end)}</span><strong>${data.attendance}%</strong><b>Assiduidade global</b></div><div><strong>${data.trainings.length}</strong><b>Treinos</b></div><div><strong>${data.games.length}</strong><b>Jogos</b></div><div><strong>${data.planned.length}</strong><b>Faltas antecipadas</b></div></div><div class="section"><h3>Resumo por escalão</h3></div><div class="weekly-groups">${data.groupData.map((g) => `<div class="card weekly-group ${g.group.toLowerCase()}"><div class="weekly-group-head"><h3>${esc(g.group)}</h3><strong>${g.attendance}%</strong></div><div class="weekly-metrics"><span><b>${g.athletes}</b> atletas</span><span><b>${g.present}</b> presenças</span><span><b>${g.absences}</b> faltas</span><span><b>${g.effort}</b> empenho</span><span><b>${g.behavior}</b> comportamento</span></div></div>`).join("")}</div><div class="weekly-columns"><div><div class="section"><h3>Atividade da semana</h3></div><div class="list">${data.trainings.map((t) => `<div class="card compact-row"><b>⚽ ${fmt(t.date)}</b><span>${esc(t.group)} · ${esc(t.time || "")}</span></div>`).join("")}${data.games.map((g) => `<div class="card compact-row"><b>🏟️ ${fmt(g.date)}</b><span>GDR × ${esc(g.opponent)} · ${esc(g.group)}</span></div>`).join("") || '<div class="card empty">Sem atividade registada nesta semana.</div>'}</div></div><div><div class="section"><h3>Destaques e próxima semana</h3></div><div class="card weekly-tags">${data.topTags.length ? data.topTags.map(([tag, n]) => `<span>${esc(tag)} <b>${n}</b></span>`).join("") : '<div class="empty">Sem destaques registados.</div>'}</div><div class="list next-week">${data.nextEvents.map(eventCard).join("") || '<div class="card empty">Sem eventos na próxima semana.</div>'}</div>${nextGame ? `<div class="card next-game-availability"><b>Disponibilidade · próximo evento</b><span>${esc(nextGame.title)} · ${fmt(nextGame.date)} · ${esc(nextGroup)}</span><div><i class="available">✅ ${av.available}</i><i class="unavailable">❌ ${av.unavailable}</i><i class="no-answer">❔ ${av.noAnswer}</i></div><button class="btn btn-small btn-secondary" onclick="openAvailability('${nextGame.id}','${nextGroup}')">Atualizar disponibilidade</button></div>` : ""}</div></div>`;
}
function changeWeek(days) {
  const current = $("weeklyStart")?.value || mondayOf();
  const target = addDays(current, days);
  view = "weekly";
  render();
  setTimeout(() => {
    if ($("weeklyStart")) {
      $("weeklyStart").value = target;
      render();
    }
  }, 0);
}
async function saveWeeklySettings() {
  try {
    await api("saveWeeklySettings", { email: $("weeklyEmail").value.trim() });
    await refresh();
    render();
    toast("Email do resumo semanal guardado");
  } catch (e) {
    toast(e.message);
  }
}
async function sendWeeklyNow() {
  try {
    const start = $("weeklyStart").value,
      end = addDays(start, 6);
    await api("sendWeeklySummary", { start, end });
    toast("Resumo semanal enviado por email");
  } catch (e) {
    toast(e.message);
  }
}
function weeklyPrintBody(data) {
  return `<div class="report-grid"><div class="report-kpi">Treinos<b>${data.trainings.length}</b></div><div class="report-kpi">Jogos<b>${data.games.length}</b></div><div class="report-kpi">Assiduidade<b>${data.attendance}%</b></div><div class="report-kpi">Faltas antecipadas<b>${data.planned.length}</b></div></div><table class="report-table"><thead><tr><th>Escalão</th><th>Atletas</th><th>Assiduidade</th><th>Presenças</th><th>Faltas</th><th>Empenho</th><th>Comport.</th></tr></thead><tbody>${data.groupData.map((g) => `<tr><td><b>${g.group}</b></td><td>${g.athletes}</td><td>${g.attendance}%</td><td>${g.present}</td><td>${g.absences}</td><td>${g.effort}</td><td>${g.behavior}</td></tr>`).join("")}</tbody></table><h3>Atividade</h3>${data.trainings.map((t) => `<p>⚽ ${fmt(t.date)} · Treino ${esc(t.group)}</p>`).join("")}${data.games.map((g) => `<p>🏟️ ${fmt(g.date)} · GDR × ${esc(g.opponent)} · ${esc(g.group)}</p>`).join("")}<h3>Próxima semana</h3>${data.nextEvents.map((e) => `<p>${fmt(e.date)} · ${esc(e.title)}</p>`).join("") || "<p>Sem eventos registados.</p>"}`;
}
function printWeeklySummary() {
  const start = $("weeklyStart")?.value || mondayOf(),
    data = weeklyData(start),
    w = window.open("", "_blank");
  w.document.write(
    printDoc(
      "Resumo semanal da formação",
      `${fmt(data.start)} a ${fmt(data.end)}`,
      "GDR Faro do Alentejo",
      "",
      weeklyPrintBody(data),
    ),
  );
  w.document.close();
}

function trafficLight(id) {
  const rr = recentRecords(id, 6),
    present = rr.filter((r) => r.status === "Presente"),
    recentAttendance = rr.length ? (present.length / rr.length) * 100 : 100;
  const av = (k) =>
    present.length
      ? present.reduce((s, r) => s + Number(r[k] || 0), 0) / present.length
      : 5;
  const evolution = athleteTrend(id),
    reasons = [];
  let points = 0;
  if (recentAttendance < 60) {
    points += 3;
    reasons.push(`Assiduidade recente ${Math.round(recentAttendance)}%`);
  } else if (recentAttendance < 80) {
    points += 1;
    reasons.push(`Assiduidade recente ${Math.round(recentAttendance)}%`);
  } else reasons.push(`Assiduidade recente ${Math.round(recentAttendance)}%`);
  if (av("behavior") < 3) {
    points += 3;
    reasons.push(`Comportamento ${av("behavior").toFixed(1)}/5`);
  } else if (av("behavior") < 3.7) {
    points += 1;
    reasons.push(`Comportamento ${av("behavior").toFixed(1)}/5`);
  }
  if (av("effort") < 3) {
    points += 2;
    reasons.push(`Empenho ${av("effort").toFixed(1)}/5`);
  } else if (av("effort") < 3.7) {
    points += 1;
    reasons.push(`Empenho ${av("effort").toFixed(1)}/5`);
  }
  if (evolution.cls === "down") {
    points += 2;
    reasons.push("Evolução recente em quebra");
  } else reasons.push(`Evolução ${evolution.label.toLowerCase()}`);
  return points >= 4
    ? { icon: "🔴", label: "Atenção", cls: "red", reasons }
    : points >= 2
      ? { icon: "🟡", label: "A acompanhar", cls: "yellow", reasons }
      : { icon: "🟢", label: "Normal", cls: "green", reasons };
}

function seasonNow() {
  const d = new Date(),
    y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}/${String(y + 1).slice(-2)}`;
}
function feeFor(aid, month, season) {
  return state.monthlyFees.find(
    (f) => f.athleteId === aid && f.month === month && f.season === season,
  );
}
function feeStatus(f, month) {
  if (
    f?.status === "Pago" ||
    f?.status === "Isento" ||
    f?.status === "Em falta"
  )
    return f.status;
  const today = new Date(),
    current = today.toISOString().slice(0, 7);
  return month < current || (month === current && today.getDate() > 8)
    ? "Em falta"
    : "Pendente";
}
function fees() {
  const startMonth = state.settings?.feeStartMonth || "2026-10",
    month =
      $("feeMonth")?.value ||
      (new Date().toISOString().slice(0, 7) < startMonth
        ? startMonth
        : new Date().toISOString().slice(0, 7)),
    season = $("feeSeason")?.value || seasonNow(),
    filter = $("feeFilter")?.value || "Todos";
  const rows = sortName(state.athletes.filter((a) => a.active))
    .map((a) => ({ a, f: feeFor(a.id, month, season) }))
    .filter((x) => filter === "Todos" || feeStatus(x.f, month) === filter);
  const paid = rows.filter((x) => x.f?.status === "Pago"),
    missing = rows.filter((x) => feeStatus(x.f, month) === "Em falta"),
    exempt = rows.filter((x) => x.f?.status === "Isento");
  return `<div class="section"><div><h3>Mensalidades</h3><div class="muted">10€ / mês · desde outubro de 2026 · pagamento entre os dias 1 e 8</div></div>${!admin() ? '<span class="pill">Só leitura</span>' : ""}</div>${admin() ? `<div class="card alert-settings"><div class="field"><label>Email para alertas de pagamentos em falta</label><div class="inline-field"><input id="feeAlertEmail" type="email" value="${esc(state.settings?.alertEmail || "")}" placeholder="nome@exemplo.pt"><button class="btn btn-primary" onclick="saveFeeSettings()">Guardar</button></div><div class="muted">Aviso no dia 6, no dia 9 e semanalmente enquanto existirem pagamentos em falta.</div></div></div>` : ""}<div class="card fee-filters"><div class="form2"><div class="field"><label>Época</label><input id="feeSeason" value="${season}" onchange="render()" pattern="\\d{4}/\\d{2}"></div><div class="field"><label>Mês</label><input id="feeMonth" type="month" min="${startMonth}" value="${month}" onchange="render()"></div></div><div class="field"><label>Estado</label><select id="feeFilter" onchange="render()">${["Todos", "Pago", "Em falta", "Isento", "Pendente"].map((x) => `<option ${x === filter ? "selected" : ""}>${x}</option>`).join("")}</select></div></div><div class="grid fee-kpis"><div class="card kpi"><span>Atletas</span><strong>${rows.length}</strong></div><div class="card kpi"><span>Pagos</span><strong>${paid.length}</strong></div><div class="card kpi"><span>Recebido</span><strong>${paid.length * 10}€</strong></div><div class="card kpi"><span>Por receber</span><strong>${missing.length * 10}€</strong></div></div><div class="list fees-list">${
    rows
      .map(({ a, f }) => {
        const status = feeStatus(f, month);
        return `<div class="card fee-row">${avatar(a)}<div class="grow"><strong>${esc(a.name)}</strong><div class="athlete-meta">${groupBadge(a.group)}<span class="fee-status s-${status.replace(" ", "-").toLowerCase()}">${esc(status)}</span></div><div class="muted">${f?.status === "Pago" ? `10€ · ${esc(f.method)} · ${fmt(f.paymentDate)} · ${esc(f.paymentNumber || "")}` : f?.status === "Isento" ? "Isento neste mês" : status === "Em falta" ? "Prazo terminado no dia 8 · 10€ por regularizar" : "Prazo de pagamento: dias 1 a 8"}</div></div>${f?.status === "Pago" ? `<button class="btn btn-small btn-secondary" onclick="printPaymentProof('${f.id}')">Comprovativo</button>` : ""}${admin() ? `<button class="btn btn-small btn-primary" onclick="openFee('${a.id}','${month}','${season}')">Gerir</button>` : ""}</div>`;
      })
      .join("") ||
    '<div class="card empty">Sem resultados para este filtro.</div>'
  }</div>`;
}
async function saveFeeSettings() {
  try {
    await api("saveFeeSettings", {
      alertEmail: $("feeAlertEmail").value.trim(),
    });
    await refresh();
    render();
    toast("Email de alertas guardado");
  } catch (e) {
    toast(e.message);
  }
}
function openFee(aid, month, season) {
  if (!admin()) return;
  feeDraft = feeFor(aid, month, season) || {
    athleteId: aid,
    month,
    season,
    status: "Pendente",
    amount: 10,
    method: "Numerário",
    paymentDate: new Date().toISOString().slice(0, 10),
    note: "",
    paymentNumber: "",
  };
  view = "feeForm";
  render();
}
function feeForm() {
  const f = feeDraft,
    a = state.athletes.find((x) => x.id === f.athleteId);
  return `<div class="section"><h3>Gerir mensalidade</h3></div><div class="card"><div class="athlete">${avatar(a)}<div><strong>${esc(a.name)}</strong><div class="muted">${esc(f.month)} · ${esc(f.season)} · 10€ · prazo dias 1 a 8</div></div></div><div class="field"><label>Estado</label><select id="fs">${["Pago", "Em falta", "Isento", "Pendente"].map((x) => `<option ${x === f.status ? "selected" : ""}>${x}</option>`).join("")}</select></div><div class="form2"><div class="field"><label>Método de pagamento</label><select id="fm"><option ${f.method === "Numerário" ? "selected" : ""}>Numerário</option><option ${f.method === "MB Way" ? "selected" : ""}>MB Way</option></select></div><div class="field"><label>Data de pagamento</label><input id="fd" type="date" value="${esc(f.paymentDate || "")}"></div></div>${f.paymentNumber ? `<div class="admin-note"><b>Número de pagamento:</b> ${esc(f.paymentNumber)}</div>` : '<div class="admin-note">O número de pagamento é criado automaticamente quando guardares como Pago.</div>'}<div class="field"><label>Observação</label><textarea id="fn">${esc(f.note || "")}</textarea></div><button class="btn btn-primary btn-block" onclick="saveFee()">Guardar mensalidade</button></div>`;
}
async function saveFee() {
  try {
    const fee = {
      ...feeDraft,
      status: $("fs").value,
      method: $("fm").value,
      paymentDate: $("fd").value,
      note: $("fn").value.trim(),
      amount: 10,
    };
    await api("saveMonthlyFee", { fee });
    await refresh();
    view = "fees";
    feeDraft = null;
    render();
    toast("Mensalidade guardada");
  } catch (e) {
    toast(e.message);
  }
}
function printPaymentProof(id) {
  const f = state.monthlyFees.find((x) => x.id === id),
    a = state.athletes.find((x) => x.id === f?.athleteId);
  if (!f || !a) return;
  const number = f.paymentNumber || f.reference,
    body = `<div class="receipt"><h2>Comprovativo interno de pagamento</h2><p>Confirma-se o registo interno do pagamento de <b>10,00 €</b> por <b>${esc(a.name)}</b>, referente à mensalidade de <b>${new Date(f.month + "-01T12:00:00").toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}</b>, época <b>${esc(f.season)}</b>.</p><table class="report-table"><tr><th>Número de pagamento</th><td>${esc(number)}</td></tr><tr><th>Atleta</th><td>${esc(a.name)}</td></tr><tr><th>Escalão</th><td>${esc(a.group)}</td></tr><tr><th>Valor</th><td>10,00 €</td></tr><tr><th>Método</th><td>${esc(f.method)}</td></tr><tr><th>Data</th><td>${fmt(f.paymentDate)}</td></tr></table><div class="signature">Validação GDR<br><br>________________________________</div><p class="meta"><b>Documento interno, sem valor fiscal.</b> Não constitui fatura nem documento fiscal.</p></div>`;
  const w = window.open("", "_blank");
  w.document.write(
    printDoc(
      "Comprovativo interno de pagamento",
      "GDR Faro do Alentejo",
      `Pagamento ${esc(number)}`,
      "",
      body,
    ),
  );
  w.document.close();
}

function allEvents() {
  const manual = state.events || [],
    trainings = state.trainings.map((t) => ({
      id: "t_" + t.id,
      type: "Treino",
      title: `Treino ${t.group}`,
      date: t.date,
      time: t.time,
      group: t.group,
      source: "training",
      sourceId: t.id,
    })),
    games = state.games
      .filter((g) => !String(g.id).startsWith("cal_"))
      .map((g) => ({
        id: "g_" + g.id,
        type: "Jogo",
        title: `GDR × ${g.opponent}`,
        date: g.date,
        time: g.time,
        group: g.group,
        location: g.location,
        source: "game",
        sourceId: g.id,
      }));
  return [...manual, ...trainings, ...games].sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time),
  );
}
function availabilityCalendarEvents() {
  const today = new Date().toISOString().slice(0, 10);
  return allEvents().filter(
    (e) => e.date >= today && (e.type === "Jogo" || e.type === "Torneio"),
  );
}
function nextEventsHome() {
  const today = new Date().toISOString().slice(0, 10),
    ee = allEvents()
      .filter((e) => e.date >= today)
      .slice(0, 4);
  return `<div class="section"><h3>Próximos eventos</h3><button class="btn btn-small btn-ghost" onclick="go('calendar')">Ver calendário</button></div><div class="list next-events">${ee.map(eventCard).join("") || '<div class="card empty">Sem próximos eventos.</div>'}</div>`;
}
function eventCard(e) {
  const icons = { Treino: "⚽", Jogo: "🏟️", Torneio: "🏆", Outro: "📌" };
  const groups = e.group === "Todos" ? ["Traquinas", "Benjamins"] : [e.group];
  const gameActions =
    e.type === "Jogo" || e.type === "Torneio"
      ? `<div class="calendar-event-actions">${groups
          .filter(Boolean)
          .map(
            (group) =>
              `<button class="btn btn-small btn-secondary" onclick="openAvailability('${e.id}','${group}')">${esc(group)} · disponibilidade</button>`,
          )
          .join("")}</div>`
      : "";
  return `<div class="card event-row"><div class="event-date"><b>${new Date(e.date + "T12:00:00").getDate()}</b><span>${new Date(e.date + "T12:00:00").toLocaleDateString("pt-PT", { month: "short" }).toUpperCase()}</span></div><div class="grow"><strong>${icons[e.type] || "📌"} ${esc(e.title)}</strong><div class="muted">${esc(e.time || "Hora por definir")}${e.group ? ` · ${esc(e.group)}` : ""}${e.location ? ` · ${esc(e.location)}` : ""}</div>${gameActions}</div>${admin() && e.source === "manual" ? `<button class="btn btn-small btn-danger" onclick="deleteEvent('${e.id}')">Eliminar</button>` : ""}</div>`;
}
function calendar() {
  const filter = $("eventFilter")?.value || "Todos",
    ee = allEvents().filter((e) => filter === "Todos" || e.type === filter);
  return `<div class="section"><h3>Calendário da formação</h3>${admin() ? '<button class="btn btn-primary" onclick="eventForm()">+ Evento</button>' : ""}</div><div class="card"><div class="field"><label>Mostrar</label><select id="eventFilter" onchange="render()">${["Todos", "Treino", "Jogo", "Torneio", "Outro"].map((x) => `<option ${x === filter ? "selected" : ""}>${x}</option>`).join("")}</select></div></div><div class="list calendar-list">${ee.map(eventCard).join("") || '<div class="card empty">Sem eventos.</div>'}</div>`;
}
function eventForm() {
  if (!admin()) return;
  view = "eventForm";
  render();
}
function eventFormView() {
  return `<div class="section"><h3>Novo evento</h3></div><div class="card"><div class="field"><label>Tipo</label><select id="et"><option>Torneio</option><option>Outro</option><option>Treino</option><option>Jogo</option></select></div><div class="field"><label>Título</label><input id="en"></div><div class="form2"><div class="field"><label>Data</label><input id="ed" type="date"></div><div class="field"><label>Hora</label><input id="eh" type="time"></div></div><div class="form2"><div class="field"><label>Escalão</label><select id="eg"><option>Todos</option><option>Benjamins</option><option>Traquinas</option></select></div><div class="field"><label>Local</label><input id="el"></div></div><div class="field"><label>Observação</label><textarea id="eo"></textarea></div><button class="btn btn-primary btn-block" onclick="saveEvent()">Guardar evento</button></div>`;
}
async function saveEvent() {
  try {
    await api("saveEvent", {
      event: {
        type: $("et").value,
        title: $("en").value.trim(),
        date: $("ed").value,
        time: $("eh").value,
        group: $("eg").value,
        location: $("el").value.trim(),
        note: $("eo").value.trim(),
      },
    });
    await refresh();
    view = "calendar";
    render();
    toast("Evento guardado");
  } catch (e) {
    toast(e.message);
  }
}
async function deleteEvent(id) {
  if (!confirm("Eliminar este evento?")) return;
  try {
    await api("deleteEvent", { id });
    await refresh();
    render();
  } catch (e) {
    toast(e.message);
  }
}

function callup() {
  if (!callupDraft) {
    const events = availabilityCalendarEvents();
    return `<div class="section"><div><h3>Preparar convocatória</h3><div class="muted">Escolhe um jogo ou torneio já existente no Calendário.</div></div><button class="btn btn-secondary" onclick="go('calendar')">📅 Abrir calendário</button></div><div class="admin-note">A convocatória usa a disponibilidade registada no evento e no respetivo escalão.</div><div class="list">${
      events
        .map((e) => {
          const groups =
            e.group === "Todos" ? ["Traquinas", "Benjamins"] : [e.group];
          return `<div class="card calendar-callup-card"><div><strong>${esc(e.title)}</strong><span>${fmt(e.date)} · ${esc(e.time || "Hora por definir")} · ${esc(e.type)}</span></div>${groups
            .map((g) => {
              const c = availabilityCounts(e.id, g);
              return `<div class="calendar-callup-group"><b>${esc(g)}</b><span>✅ ${c.available} · ❌ ${c.unavailable} · ❔ ${c.noAnswer}</span><button class="btn btn-small btn-secondary" onclick="openAvailability('${e.id}','${g}')">Disponibilidade</button><button class="btn btn-small btn-primary" onclick="prepareCallupForEvent('${e.id}','${g}')">Convocar</button></div>`;
            })
            .join("")}</div>`;
        })
        .join("") ||
      '<div class="card empty">Não existem jogos ou torneios futuros no Calendário. Cria primeiro o evento no Calendário.</div>'
    }</div>`;
  }
  return callupEditor();
}
function rotationBoost(a) {
  const recentGames = state.games
    .slice()
    .sort((x, y) => String(y.date).localeCompare(String(x.date)))
    .slice(0, 3);
  let missed = 0;
  recentGames.forEach((g) => {
    if (
      !state.callups.some(
        (c) =>
          c.gameId === g.id && c.athleteId === a.id && c.status === "Convocado",
      )
    )
      missed++;
  });
  return missed * 4;
}
function prepareCallup() {
  const group = $("gg").value,
    n = Number($("gn").value || 12),
    equipment = $("ge").value;
  const eligible = sortName(
    state.athletes.filter(
      (a) =>
        a.active && (a.group === group || a.group === "Traquinas/Benjamins"),
    ),
  ).map((a) => ({
    ...a,
    score: score(a),
    rotation: rotationBoost(a),
    availability: "Sem resposta",
  }));
  const recommended = [...eligible]
    .sort((a, b) => b.score + b.rotation - (a.score + a.rotation))
    .slice(0, n)
    .map((a) => a.id);
  callupDraft = {
    id: uid("g"),
    opponent: $("opp").value.trim() || "Adversário",
    date: $("gd").value,
    time: $("gh").value,
    group,
    equipment,
    limit: n,
    eligible,
    selected: new Set(recommended),
  };
  render();
}
function prepareCallupForEvent(eventId, group) {
  const event = allEvents().find((x) => x.id === eventId);
  if (!event) return;
  const sourceGame =
      event.source === "game"
        ? state.games.find((x) => x.id === event.sourceId)
        : null,
    effectiveGroup =
      group || (event.group === "Todos" ? "Traquinas" : event.group),
    gameId =
      sourceGame?.id ||
      `cal_${String(event.id).replace(/[^a-zA-Z0-9_-]/g, "_")}_${effectiveGroup.toLowerCase()}`,
    limit = Number(sourceGame?.callupLimit || 12),
    eligible = sortName(
      state.athletes.filter(
        (a) =>
          a.active &&
          (a.group === effectiveGroup || a.group === "Traquinas/Benjamins"),
      ),
    ).map((a) => {
      const av = state.gameAvailability.find(
        (x) =>
          (x.eventId === event.id ||
            (sourceGame && x.gameId === sourceGame.id)) &&
          (!x.group || x.group === effectiveGroup) &&
          x.athleteId === a.id,
      );
      return {
        ...a,
        score: score(a),
        rotation: rotationBoost(a),
        availability: av?.status || "Sem resposta",
      };
    }),
    selectable = eligible.filter((a) => a.availability !== "Indisponível"),
    recommended = [...selectable]
      .sort(
        (a, b) =>
          (a.availability === "Disponível" ? -1 : 1) -
            (b.availability === "Disponível" ? -1 : 1) ||
          b.score + b.rotation - (a.score + a.rotation),
      )
      .slice(0, limit)
      .map((a) => a.id);
  callupDraft = {
    id: gameId,
    calendarEventId: event.id,
    opponent:
      sourceGame?.opponent || event.title.replace(/^GDR\s*[×x-]\s*/i, ""),
    date: event.date,
    time: event.time,
    group: effectiveGroup,
    equipment: sourceGame?.equipment || "Vermelho",
    limit,
    eligible,
    selected: new Set(recommended),
  };
  availabilityDraft = null;
  view = "callup";
  render();
}
function toggleCallup(id) {
  const athlete = callupDraft.eligible.find((a) => a.id === id);
  if (!callupDraft.selected.has(id) && athlete?.availability === "Indisponível")
    return toast("Este atleta está marcado como indisponível para o jogo.");
  if (callupDraft.selected.has(id)) callupDraft.selected.delete(id);
  else {
    if (callupDraft.selected.size >= callupDraft.limit)
      return toast(`Máximo de ${callupDraft.limit} convocados`);
    callupDraft.selected.add(id);
  }
  render();
}
function callupEditor() {
  const selected = callupDraft.eligible.filter((a) =>
    callupDraft.selected.has(a.id),
  );
  return `<div class="section"><div><h3>${esc(callupDraft.opponent)}</h3><div class="muted">${fmt(callupDraft.date)} · ${esc(callupDraft.time || "Hora por definir")}</div></div><span class="equipment-badge ${callupDraft.equipment === "Vermelho" ? "equip-red" : "equip-white"}">${callupDraft.equipment === "Vermelho" ? "🔴" : "⚪"} ${callupDraft.equipment}</span></div><div class="callup-counter"><strong>${selected.length}</strong> / ${callupDraft.limit} convocados</div><div class="football-pitch">${pitchPlayers(selected)}</div><div class="section"><h3>Selecionar jogadores</h3></div><div class="list">${[
    ...callupDraft.eligible,
  ]
    .sort((a, b) => b.score + b.rotation - (a.score + a.rotation))
    .map(
      (a) =>
        `<button class="card callup-row availability-${a.availability.replace(" ", "-").toLowerCase()} ${callupDraft.selected.has(a.id) ? "selected" : ""}" onclick="toggleCallup('${a.id}')">${avatar(a)}<div class="grow"><strong>${esc(a.name)}</strong><div class="athlete-meta">${groupBadge(a.group)}<span class="number-badge">#${esc(shirtNumber(a, callupDraft.equipment))}</span><span class="availability-badge">${availabilityIcon(a.availability)} ${esc(a.availability)}</span></div><div class="muted">Índice ${score(a)}${a.rotation ? ` · 🔄 rotação +${a.rotation}` : ""}</div></div><span class="checkmark">${callupDraft.selected.has(a.id) ? "✓" : ""}</span></button>`,
    )
    .join(
      "",
    )}</div><div class="callup-actions"><button class="btn btn-secondary" onclick="callupDraft=null;render()">Voltar</button><button class="btn btn-secondary" onclick="printCallup()">🖨️ PDF / Imprimir</button><button class="btn btn-primary" onclick="saveCallup()">Guardar convocatória</button></div>`;
}
function pitchPlayers(players) {
  if (!players.length)
    return '<div class="pitch-empty">Seleciona jogadores para os veres no campo</div>';
  return `<div class="pitch-grid">${players.map((a, i) => `<div class="pitch-player p${i}"><div class="pitch-avatar">${a.photoUrl ? `<img src="${esc(a.photoUrl)}">` : `<span>${esc(a.name.split(" ")[0][0])}</span>`}</div><div class="pitch-number ${callupDraft.equipment === "Vermelho" ? "red" : "white"}">#${esc(shirtNumber(a, callupDraft.equipment))}</div><b>${esc(a.name.split(" ")[0])}</b></div>`).join("")}</div>`;
}
async function saveCallup() {
  try {
    const selected = callupDraft.eligible.filter((a) =>
      callupDraft.selected.has(a.id),
    );
    if (!selected.length) return toast("Seleciona pelo menos um jogador");
    if (selected.some((a) => a.availability === "Indisponível"))
      return toast("Retira da convocatória os atletas indisponíveis.");
    await api("saveCallup", {
      game: {
        id: callupDraft.id,
        opponent: callupDraft.opponent,
        date: callupDraft.date,
        time: callupDraft.time,
        group: callupDraft.group,
        equipment: callupDraft.equipment,
        callupLimit: callupDraft.limit,
      },
      callups: selected.map((a) => ({
        id: uid("c"),
        athleteId: a.id,
        status: "Convocado",
        score: score(a),
      })),
    });
    await refresh();
    toast("Convocatória guardada");
    view = "games";
    callupDraft = null;
    render();
  } catch (e) {
    toast(e.message);
  }
}
function printCallup() {
  const selected = callupDraft.eligible.filter((a) =>
    callupDraft.selected.has(a.id),
  );
  if (!selected.length) return toast("Seleciona jogadores");
  const missing = selected.filter(
    (a) => shirtNumber(a, callupDraft.equipment) === "—",
  );
  if (missing.length)
    return toast(
      `Falta o número ${callupDraft.equipment.toLowerCase()} em ${missing.length} atleta(s).`,
    );
  const equipment = callupDraft.equipment,
    cards = selected
      .map(
        (a) =>
          `<div class="pcard"><div class="pimg">${
            a.photoUrl
              ? `<img src="${esc(a.photoUrl)}">`
              : `<span>${esc(
                  a.name
                    .split(" ")
                    .slice(0, 2)
                    .map((x) => x[0])
                    .join(""),
                )}</span>`
          }</div><div><b>${esc(a.name)}</b><div>${esc(a.group)}</div></div><strong class="pnum ${equipment === "Vermelho" ? "r" : "w"}">#${esc(shirtNumber(a, equipment))}</strong></div>`,
      )
      .join("");
  const pitch = `<div class="ppitch"><div class="ppitch-grid">${selected.map((a, i) => `<div class="pp p${i}"><div class="ppi">${a.photoUrl ? `<img src="${esc(a.photoUrl)}">` : esc(a.name[0])}</div><div class="ppn ${equipment === "Vermelho" ? "r" : "w"}">#${esc(shirtNumber(a, equipment))}</div><b>${esc(a.name.split(" ")[0])}</b></div>`).join("")}</div></div>`;
  const w = window.open("", "_blank");
  w.document.write(
    printDoc(
      "Convocatória",
      `GDR Faro do Alentejo vs ${esc(callupDraft.opponent)}`,
      `${fmt(callupDraft.date)} ${esc(callupDraft.time || "")} · ${esc(callupDraft.group)} · ${selected.length} convocados`,
      equipment,
      pitch + `<div class="plist">${cards}</div>`,
    ),
  );
  w.document.close();
}
function printDoc(title, subtitle, meta, equipment, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#171717;margin:0}.head{display:flex;align-items:center;border-bottom:3px solid #b5121b;padding-bottom:8px;margin-bottom:12px}.head img{width:105px;height:70px;object-fit:contain}.head div{flex:1}.head h1{margin:0;font-size:22px}.meta{font-size:12px;color:#555}.equip{font-weight:bold;padding:7px 10px;border-radius:10px;background:${equipment === "Vermelho" ? "#b5121b" : "#f5f5f5"};color:${equipment === "Vermelho" ? "#fff" : "#111"};border:1px solid #ddd}.ppitch{height:335px;background:#2f914d;border:3px solid #fff;outline:1px solid #18723a;position:relative;margin:12px 0 15px;overflow:hidden}.ppitch:before,.print-lineup:before{content:'';position:absolute;left:50%;top:0;bottom:0;border-left:2px solid rgba(255,255,255,.8)}.ppitch:after,.print-lineup:after{content:'';position:absolute;width:90px;height:90px;border:2px solid rgba(255,255,255,.8);border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%)}.ppitch-grid{height:100%;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:1fr;align-items:center;justify-items:center;position:relative;z-index:2}.pp{text-align:center;font-size:9px;color:#fff;text-shadow:0 1px 2px #000}.ppi{width:36px;height:36px;border-radius:50%;overflow:hidden;background:#fff;color:#111;display:grid;place-items:center;margin:auto;border:2px solid #fff;text-shadow:none}.ppi img{width:100%;height:100%;object-fit:cover}.ppn{display:inline-block;min-width:24px;padding:3px 6px;margin-top:-7px;border-radius:999px;font-size:10px;font-weight:bold;text-shadow:none}.ppn.r,.pnum.r{background:#b5121b;color:#fff}.ppn.w,.pnum.w{background:#fff;color:#111;border:1px solid #bbb}.plist{display:grid;grid-template-columns:1fr 1fr;gap:6px}.pcard{display:flex;align-items:center;gap:8px;border:1px solid #ddd;border-radius:9px;padding:6px;font-size:10px}.pimg{width:34px;height:34px;border-radius:50%;overflow:hidden;background:#eee;display:grid;place-items:center;font-weight:bold}.pimg img{width:100%;height:100%;object-fit:cover}.pcard>div:nth-child(2){flex:1}.pnum{min-width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:15px}.report-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.report-kpi{border:1px solid #ddd;border-radius:10px;padding:9px;text-align:center}.report-kpi b{display:block;font-size:18px}.report-table{width:100%;border-collapse:collapse;font-size:10px}.report-table th,.report-table td{border-bottom:1px solid #ddd;padding:6px;text-align:left}.receipt{border:2px solid #b5121b;border-radius:14px;padding:24px}.receipt p{line-height:1.6}.signature{text-align:right;margin-top:55px}.print-lineup{height:600px;background:#2f914d;border:3px solid #fff;outline:1px solid #18723a;position:relative;overflow:hidden}.print-lineup-player{position:absolute;transform:translate(-50%,-50%);text-align:center;color:#fff;font-size:10px;z-index:2}.print-lineup-player b{display:block;text-shadow:0 1px 2px #000}@media print{button{display:none}}</style></head><body><div class="head"><img src="${location.origin + location.pathname.replace(/[^/]*$/, "")}logo-formacao-gdr.png"><div><h1>${title}</h1><b>${subtitle}</b><div class="meta">${meta}</div></div>${equipment ? `<div class="equip">${equipment}</div>` : ""}</div>${body}<script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script></body></html>`;
}
function printAthleteReport(id) {
  const a = state.athletes.find((x) => x.id === id),
    rr = athleteRecords(id)
      .slice()
      .sort((x, y) =>
        trainingDate(y.trainingId).localeCompare(trainingDate(x.trainingId)),
      )
      .slice(0, 12),
    tr = athleteTrend(id);
  const body = `<div class="report-grid"><div class="report-kpi">Assiduidade<b>${attendancePct(id)}%</b></div><div class="report-kpi">Empenho<b>${avg(id, "effort").toFixed(1)}</b></div><div class="report-kpi">Atitude<b>${avg(id, "attitude").toFixed(1)}</b></div><div class="report-kpi">Comportamento<b>${avg(id, "behavior").toFixed(1)}</b></div></div><p><b>Evolução:</b> ${tr.icon} ${tr.label} · <b>Convocatórias:</b> ${athleteCallups(id).length}</p><table class="report-table"><thead><tr><th>Data</th><th>Presença</th><th>Atitude</th><th>Empenho</th><th>Comport.</th><th>Tags</th></tr></thead><tbody>${rr.map((r) => `<tr><td>${fmt(trainingDate(r.trainingId))}</td><td>${esc(r.status)}${r.absenceReason ? ` (${esc(r.absenceReason)})` : ""}</td><td>${r.status === "Presente" ? r.attitude : "—"}</td><td>${r.status === "Presente" ? r.effort : "—"}</td><td>${r.status === "Presente" ? r.behavior : "—"}</td><td>${esc((r.tags || []).join(", "))}</td></tr>`).join("")}</tbody></table>`;
  const w = window.open("", "_blank");
  w.document.write(
    printDoc(
      "Ficha de Evolução",
      esc(a.name),
      `${esc(a.group)} · ${tr.icon} ${tr.label}`,
      "",
      body,
    ),
  );
  w.document.close();
}

function gameDate(id) {
  return state.games.find((g) => g.id === id)?.date || "";
}
function games() {
  const gg = [...state.games].sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
  return `<div class="section"><h3>Histórico de jogos e equipa</h3><button class="btn btn-primary" onclick="go('calendar')">📅 Calendário</button></div><div class="list">${
    gg
      .map((g) => {
        const cs = state.callups.filter(
          (c) => c.gameId === g.id && c.status === "Convocado",
        );
        const eventId = `g_${g.id}`,
          av = availabilityCounts(eventId, g.group);
        return `<div class="card game-card"><div><strong>${fmt(g.date)}</strong><div class="muted">${esc(g.group || "")} · ${esc(g.equipment || "")}</div></div><div class="grow"><b>vs ${esc(g.opponent)}</b><div class="game-availability-mini"><span class="available">✓ ${av.available}</span><span class="unavailable">× ${av.unavailable}</span><span class="no-answer">? ${av.noAnswer}</span><span>${cs.length} convocados</span></div></div><div class="game-actions"><button class="btn btn-small btn-secondary" onclick="openAvailability('${eventId}','${g.group}')">Disponibilidade</button><button class="btn btn-small btn-primary" onclick="prepareCallupForEvent('${eventId}','${g.group}')">Convocar</button><button class="btn btn-small btn-ghost" onclick="openLineup('${g.id}')">🗺️ Sete</button></div></div>`;
      })
      .join("") || '<div class="card empty">Ainda sem jogos guardados.</div>'
  }</div>`;
}

function availabilityIcon(status) {
  return status === "Disponível"
    ? "✅"
    : status === "Indisponível"
      ? "❌"
      : "❔";
}
function gameAthletes(group) {
  return sortName(
    state.athletes.filter(
      (a) =>
        a.active && (a.group === group || a.group === "Traquinas/Benjamins"),
    ),
  );
}
function availabilityRows(event, group) {
  return state.gameAvailability.filter(
    (x) =>
      (x.eventId === event.id ||
        (event.source === "game" && x.gameId === event.sourceId)) &&
      (!x.group || x.group === group),
  );
}
function availabilityCounts(eventId, group) {
  const event = allEvents().find((x) => x.id === eventId),
    effectiveGroup =
      group || (event?.group === "Todos" ? "Traquinas" : event?.group),
    athletes = gameAthletes(effectiveGroup),
    rows = event ? availabilityRows(event, effectiveGroup) : [];
  return {
    available: athletes.filter(
      (a) => rows.find((x) => x.athleteId === a.id)?.status === "Disponível",
    ).length,
    unavailable: athletes.filter(
      (a) => rows.find((x) => x.athleteId === a.id)?.status === "Indisponível",
    ).length,
    noAnswer: athletes.filter(
      (a) =>
        !rows.find((x) => x.athleteId === a.id) ||
        rows.find((x) => x.athleteId === a.id)?.status === "Sem resposta",
    ).length,
    total: athletes.length,
  };
}
function openAvailability(eventId, group) {
  const event = allEvents().find((x) => x.id === eventId);
  if (!event || (event.type !== "Jogo" && event.type !== "Torneio")) return;
  const effectiveGroup =
      group || (event.group === "Todos" ? "Traquinas" : event.group),
    savedRows = availabilityRows(event, effectiveGroup);
  const rows = {};
  gameAthletes(effectiveGroup).forEach((a) => {
    const saved = savedRows.find((x) => x.athleteId === a.id);
    rows[a.id] = {
      status: saved?.status || "Sem resposta",
      note: saved?.note || "",
    };
  });
  availabilityDraft = { event, group: effectiveGroup, rows };
  view = "availability";
  render();
}
function setAvailability(athleteId, status) {
  availabilityDraft.rows[athleteId].status = status;
  render();
}
function availability() {
  const event = availabilityDraft.event,
    group = availabilityDraft.group,
    athletes = gameAthletes(group),
    values = Object.values(availabilityDraft.rows),
    available = values.filter((x) => x.status === "Disponível").length,
    unavailable = values.filter((x) => x.status === "Indisponível").length,
    noAnswer = values.filter((x) => x.status === "Sem resposta").length;
  return `<div class="section"><div><h3>Disponibilidade</h3><div class="muted">${esc(event.title)} · ${fmt(event.date)} · ${esc(group)}</div></div>${event.group === "Todos" ? `<select onchange="openAvailability('${event.id}',this.value)"><option ${group === "Traquinas" ? "selected" : ""}>Traquinas</option><option ${group === "Benjamins" ? "selected" : ""}>Benjamins</option></select>` : ""}</div><div class="availability-summary"><div class="card available"><span>Disponíveis</span><strong>${available}</strong></div><div class="card unavailable"><span>Indisponíveis</span><strong>${unavailable}</strong></div><div class="card no-answer"><span>Sem resposta</span><strong>${noAnswer}</strong></div><div class="card total"><span>Total</span><strong>${athletes.length}</strong></div></div><div class="availability-toolbar"><button class="btn btn-small btn-secondary" onclick="setAllAvailability('Disponível')">Todos disponíveis</button><button class="btn btn-small btn-ghost" onclick="setAllAvailability('Sem resposta')">Limpar respostas</button></div><div class="list">${athletes
    .map((a) => {
      const row = availabilityDraft.rows[a.id];
      return `<div class="card availability-row ${row.status.replace(" ", "-").toLowerCase()}">${avatar(a)}<div class="grow"><div class="absence-name"><strong>${esc(a.name)}</strong>${groupBadge(a.group)}</div><div class="availability-buttons">${["Disponível", "Indisponível", "Sem resposta"].map((s) => `<button class="${row.status === s ? "active" : ""}" onclick="setAvailability('${a.id}','${s}')">${availabilityIcon(s)} ${s}</button>`).join("")}</div><input class="availability-note" value="${esc(row.note)}" placeholder="Observação opcional" onchange="availabilityDraft.rows['${a.id}'].note=this.value"></div></div>`;
    })
    .join(
      "",
    )}</div><div class="sticky-save availability-save"><button class="btn btn-secondary" onclick="saveAvailability()">Guardar disponibilidade</button><button class="btn btn-primary" onclick="saveAvailability(true)">Guardar e preparar convocatória</button></div>`;
}
function setAllAvailability(status) {
  Object.values(availabilityDraft.rows).forEach((x) => (x.status = status));
  render();
}
async function saveAvailability(prepare = false) {
  try {
    const event = availabilityDraft.event,
      group = availabilityDraft.group,
      gameId = event.source === "game" ? event.sourceId : "",
      availability = Object.entries(availabilityDraft.rows).map(
        ([athleteId, row]) => ({ athleteId, ...row }),
      );
    await api("saveGameAvailability", {
      eventId: event.id,
      gameId,
      group,
      eventDate: event.date,
      availability,
    });
    await refresh();
    toast("Disponibilidade guardada");
    if (prepare) prepareCallupForEvent(event.id, group);
    else {
      view = "calendar";
      availabilityDraft = null;
      render();
    }
  } catch (e) {
    toast(e.message);
  }
}

function openLineup(gameId) {
  const g = state.games.find((x) => x.id === gameId),
    ids = state.callups
      .filter((c) => c.gameId === gameId && c.status === "Convocado")
      .map((c) => c.athleteId),
    saved = state.lineups.filter((x) => x.gameId === gameId);
  let players = saved
    .map((x) => ({
      ...x,
      athlete: state.athletes.find((a) => a.id === x.athleteId),
    }))
    .filter((x) => x.athlete);
  if (!players.length)
    players = ids
      .slice(0, 7)
      .map((id, i) => ({
        athleteId: id,
        athlete: state.athletes.find((a) => a.id === id),
        x: [50, 25, 75, 18, 50, 82, 50][i],
        y: [88, 68, 68, 45, 45, 45, 18][i],
        equipment: g.equipment,
        number: shirtNumber(
          state.athletes.find((a) => a.id === id),
          g.equipment,
        ),
      }))
      .filter((x) => x.athlete);
  lineupDraft = { game: g, players };
  view = "lineup";
  render();
  setTimeout(enableLineupDrag, 0);
}
function lineup() {
  const g = lineupDraft.game;
  return `<div class="section"><div><h3>Sete inicial</h3><div class="muted">GDR × ${esc(g.opponent)} · arrasta os jogadores</div></div><select id="lineupEquip" onchange="changeLineupEquip(this.value)"><option ${g.equipment === "Vermelho" ? "selected" : ""}>Vermelho</option><option ${g.equipment === "Branco" ? "selected" : ""}>Branco</option></select></div><div class="lineup-pitch" id="lineupPitch">${lineupDraft.players.map((p, i) => `<div class="lineup-player" data-i="${i}" style="left:${p.x}%;top:${p.y}%"><div class="pitch-avatar">${p.athlete.photoUrl ? `<img src="${esc(p.athlete.photoUrl)}">` : esc(p.athlete.name[0])}</div><span class="pitch-number ${p.equipment === "Branco" ? "white" : "red"}">#${esc(p.number)}</span><b>${esc(p.athlete.name.split(" ")[0])}</b></div>`).join("")}</div><div class="admin-note">Mantém premido e arrasta cada jogador para a posição pretendida. O sete fica associado ao jogo.</div><div class="form2"><button class="btn btn-secondary" onclick="printLineup()">🖨️ PDF / Imprimir</button><button class="btn btn-primary" onclick="saveLineup()">Guardar sete inicial</button></div>`;
}
function changeLineupEquip(eq) {
  lineupDraft.game.equipment = eq;
  lineupDraft.players.forEach((p) => {
    p.equipment = eq;
    p.number = shirtNumber(p.athlete, eq);
  });
  render();
  setTimeout(enableLineupDrag, 0);
}
function enableLineupDrag() {
  const pitch = $("lineupPitch");
  if (!pitch) return;
  pitch.querySelectorAll(".lineup-player").forEach((el) => {
    el.onpointerdown = (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.onpointermove = (m) => {
        const r = pitch.getBoundingClientRect(),
          i = Number(el.dataset.i),
          x = Math.max(5, Math.min(95, ((m.clientX - r.left) / r.width) * 100)),
          y = Math.max(7, Math.min(93, ((m.clientY - r.top) / r.height) * 100));
        Object.assign(lineupDraft.players[i], {
          x: Math.round(x),
          y: Math.round(y),
        });
        el.style.left = x + "%";
        el.style.top = y + "%";
      };
      el.onpointerup = () => {
        el.onpointermove = null;
      };
    };
  });
}
async function saveLineup() {
  try {
    await api("saveLineup", {
      gameId: lineupDraft.game.id,
      lineup: lineupDraft.players.map((p) => ({
        athleteId: p.athleteId,
        x: p.x,
        y: p.y,
        equipment: p.equipment,
        number: p.number,
      })),
    });
    await refresh();
    toast("Sete inicial guardado");
  } catch (e) {
    toast(e.message);
  }
}
function printLineup() {
  const g = lineupDraft.game,
    players = lineupDraft.players,
    body = `<div class="print-lineup">${players.map((p) => `<div class="print-lineup-player" style="left:${p.x}%;top:${p.y}%"><div class="ppi">${p.athlete.photoUrl ? `<img src="${esc(p.athlete.photoUrl)}">` : esc(p.athlete.name[0])}</div><span class="ppn ${p.equipment === "Branco" ? "w" : "r"}">#${esc(p.number)}</span><b>${esc(p.athlete.name.split(" ")[0])}</b></div>`).join("")}</div>`;
  const w = window.open("", "_blank");
  w.document.write(
    printDoc(
      "Sete inicial",
      `GDR Faro do Alentejo × ${esc(g.opponent)}`,
      `${fmt(g.date)} · ${esc(g.group)} · Equipamento ${esc(g.equipment)}`,
      g.equipment,
      body,
    ),
  );
  w.document.close();
}

function users() {
  if (!admin())
    return '<div class="admin-note">Acesso exclusivo ao Administrador.</div>';
  return `<div class="section"><h3>Utilizadores</h3><button class="btn btn-primary" onclick="userForm()">+ Adicionar</button></div><div class="list">${state.users.map((u) => `<div class="card athlete"><div class="avatar">${u.role === "admin" ? "A" : "T"}</div><div class="grow"><strong>${esc(u.name)}</strong><div class="muted">@${esc(u.username)} · ${u.role} · ${u.active ? "Ativo" : "Inativo"}</div></div><div class="actions"><button class="btn btn-small btn-ghost" onclick="userForm('${u.id}')">Editar</button><button class="btn btn-small btn-danger" onclick="toggleUser('${u.id}',${!u.active})">${u.active ? "Desativar" : "Ativar"}</button></div></div>`).join("")}</div>`;
}
function userForm(id = "") {
  const u = id ? state.users.find((x) => x.id === id) : null;
  view = "userForm";
  $("app").innerHTML = shell(
    `<div class="section"><h3>${u ? "Editar" : "Novo"} utilizador</h3></div><div class="card"><div class="field"><label>Nome</label><input id="un" value="${esc(u?.name || "")}"></div><div class="field"><label>Utilizador</label><input id="uu" value="${esc(u?.username || "")}"></div><div class="field"><label>PIN ${u ? "(deixa vazio para manter)" : ""}</label><input id="up" type="password" inputmode="numeric"></div><div class="field"><label>Perfil</label><select id="ur"><option value="treinador" ${u?.role === "treinador" ? "selected" : ""}>Treinador</option><option value="admin" ${u?.role === "admin" ? "selected" : ""}>Administrador</option></select></div><button class="btn btn-primary btn-block" onclick="saveUser('${id}')">Guardar</button></div>`,
  );
}
async function saveUser(id) {
  try {
    await api("saveUser", {
      target: {
        id,
        name: $("un").value.trim(),
        username: $("uu").value.trim(),
        pin: $("up").value,
        role: $("ur").value,
      },
    });
    await refresh();
    view = "users";
    render();
    toast("Utilizador guardado");
  } catch (e) {
    toast(e.message);
  }
}
async function toggleUser(id, active) {
  try {
    await api("toggleUser", { id, active });
    await refresh();
    render();
  } catch (e) {
    toast(e.message);
  }
}

function render() {
  if (!user || !token) {
    $("app").innerHTML = loginScreen();
    return;
  }
  let b = "";
  if (view === "home") b = home();
  else if (view === "athletes") b = athletes();
  else if (view === "athleteProfile") b = athleteProfile();
  else if (view === "training") b = training();
  else if (view === "dashboard") b = dashboard();
  else if (view === "callup") b = callup();
  else if (view === "fees") b = fees();
  else if (view === "feeForm") b = feeForm();
  else if (view === "calendar") b = calendar();
  else if (view === "eventForm") b = eventFormView();
  else if (view === "lineup") b = lineup();
  else if (view === "absences") b = absences();
  else if (view === "availability") b = availability();
  else if (view === "weekly") b = weekly();
  else if (view === "games") b = games();
  else if (view === "users") b = users();
  else return;
  $("app").innerHTML = shell(b);
}
(async () => {
  if (user && token) {
    $("app").innerHTML =
      '<div class="loading">A carregar GDR Formação 360…</div>';
    try {
      await refresh();
    } catch (e) {
      logout();
      return;
    }
  }
  render();
})();
if ("serviceWorker" in navigator)
  addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {}),
  );
