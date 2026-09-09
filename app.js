const C = window.GDR_CONFIG;
function storedJson(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    if (!value || value === "undefined" || value === "null") return fallback;
    return JSON.parse(value);
  } catch (_) {
    localStorage.removeItem(key);
    return fallback;
  }
}
let token = localStorage.getItem("gdr360_token") || "",
  user = storedJson("gdr360_user");
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
  availabilityRequests: [],
  monthlySummaries: [],
  trainingSummaries: [],
  safetyProfiles: [],
  announcements: [],
  notificationReads: [],
  birthdaysToday: [],
  settings: { feeAmount: 10 },
};
let view = "home",
  draft = null,
  callupDraft = null,
  selectedAthleteId = null,
  selectedTrainingId = null,
  feeDraft = null,
  lineupDraft = null,
  eventDraft = null,
  selectedAnnouncementId = null;
let availabilityDraft = null;
let availabilityShareMessage = "";
let selectedParentAthleteId = null;
let savingTraining = false;
let hasLoadedRemoteData = false;
let dataLoading = false;
let remoteRevision = "";
let sessionEpoch = 0;
let dashboardGroup = "Benjamins";
const narrativeGenerationQueue = new Set();

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
const availabilityOwner = () =>
  String(user?.username || "").toLowerCase() === "josealmanso";
const sortName = (arr) =>
  [...arr].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-PT", { sensitivity: "base" }),
  );
const monthKey = (d) => String(d || "").slice(0, 7);
const ageFromBirthDate = (date) => {
  if (!date) return null;
  const today = new Date(),
    birth = new Date(date + "T12:00:00");
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  )
    age--;
  return age;
};

function toast(t) {
  const x = document.createElement("div");
  x.className = "toast";
  x.textContent = t;
  document.body.appendChild(x);
  setTimeout(() => x.remove(), 2200);
}
async function api(action, payload = {}) {
  if (!C.API_URL) throw new Error("API_URL ainda não configurado em config.js");
  const attempts = action === "login" ? 2 : 1,
    waitLimit = action === "login" ? 12000 : 25000;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), waitLimit);
    try {
      const r = await fetch(C.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action, token, ...payload }),
          signal: controller.signal,
        }),
        j = await r.json().catch(() => null);
      if (!j) throw new Error("O servidor devolveu uma resposta inválida. Tenta novamente.");
      if (!j.ok) throw new Error(j.error || "Erro na API");
      return j;
    } catch (error) {
      if (error.name === "AbortError" && attempt + 1 < attempts) continue;
      if (error.name === "AbortError")
        throw new Error("A ligação demorou demasiado. Tenta novamente.");
      if (error.message && error.message !== "Failed to fetch") throw error;
      throw new Error("Não foi possível ligar ao GDR. Verifica a internet e tenta novamente.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
function dataCacheKey() {
  return user?.id ? `gdr360_data_${user.id}` : "";
}
function restoreCachedData() {
  try {
    const key = dataCacheKey(), cached = key && localStorage.getItem(key);
    if (!cached) return false;
    state = { ...state, ...JSON.parse(cached) };
    hasLoadedRemoteData = true;
    return true;
  } catch (_) {
    return false;
  }
}
function rememberData() {
  try {
    const key = dataCacheKey();
    if (key) localStorage.setItem(key, JSON.stringify(state));
  } catch (_) {}
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
  const parentPortal =
    new URLSearchParams(location.search).get("portal") === "pais";
  return `<div class="login-page"><div class="login-card"><img class="login-logo" src="logo-formacao-gdr.png"><h1>GDR Formação 360</h1><p>${parentPortal ? "Portal dos Pais" : "Área reservada"}</p>${err ? `<div class="error">${esc(err)}</div>` : ""}<div class="field"><label>Utilizador</label><input id="lu" autocomplete="username"></div><div class="field"><label>PIN</label><input id="lp" class="pin" type="password" inputmode="numeric" maxlength="8"></div><button class="btn btn-primary btn-block" onclick="login()">Entrar</button></div></div>`;
}
function loadingScreen(stage = "A preparar a tua área") {
  return `<div class="app-loading"><div class="loading-brand"><div class="loading-logo-ring"><img src="logo-formacao-gdr.png" alt="GDR Formação 360"></div><h1>GDR Formação 360</h1><p id="loadingStage">${esc(stage)}</p><div class="loading-progress"><i></i></div><div class="loading-steps"><span class="active">Ligação segura</span><span>A carregar dados</span><span>A preparar o portal</span></div><small>Estamos a sincronizar a informação mais recente.</small></div></div>`;
}
async function login() {
  try {
    const username = $("lu").value,
      pin = $("lp").value;
    $("app").innerHTML = loadingScreen("A validar o acesso");
    const j = await api("login", {
      username,
      pin,
    });
    token = j.token;
    user = j.user;
    sessionEpoch++;
    localStorage.setItem("gdr360_token", token);
    localStorage.setItem("gdr360_user", JSON.stringify(user));
    view = user.role === "parent" ? "parentHome" : "home";
    restoreCachedData();
    dataLoading = true;
    render();
    loadData(sessionEpoch)
      .then(() => render())
      .catch((e) => toast(e.message))
      .finally(() => {
        dataLoading = false;
        render();
      });
  } catch (e) {
    $("app").innerHTML = loginScreen(e.message);
  }
}
function logout() {
  const oldDataKey = dataCacheKey();
  sessionEpoch++;
  token = "";
  user = null;
  state = {
    athletes: [], trainings: [], records: [], games: [], callups: [], users: [],
    monthlyFees: [], events: [], lineups: [], plannedAbsences: [],
    gameAvailability: [], availabilityRequests: [], monthlySummaries: [],
    trainingSummaries: [], safetyProfiles: [], announcements: [],
    notificationReads: [], birthdaysToday: [], settings: { feeAmount: 10 },
  };
  hasLoadedRemoteData = false;
  dataLoading = false;
  remoteRevision = "";
  refreshInFlight = null;
  clearTimeout(refreshTimer);
  localStorage.removeItem("gdr360_token");
  localStorage.removeItem("gdr360_user");
  if (oldDataKey) localStorage.removeItem(oldDataKey);
  render();
}
let refreshInFlight = null,
  refreshTimer = null;
async function loadData(epoch = sessionEpoch) {
  const j = await api("getData");
  if (epoch !== sessionEpoch) return false;
  if (hasLoadedRemoteData) notifyDataChanges(state, j.data);
  state = j.data;
  remoteRevision = String(j.data.revision || "");
  hasLoadedRemoteData = true;
  rememberData();
  return true;
}
async function checkForUpdates() {
  if (!user || !token || refreshInFlight || document.hidden) return;
  try {
    const status = await api("syncStatus");
    if (String(status.revision || "") === remoteRevision) return;
    refreshInFlight = loadData(sessionEpoch)
      .then(() => render())
      .catch(() => {})
      .finally(() => (refreshInFlight = null));
  } catch (_) {}
}
function refresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (refreshInFlight || !user || !token) return;
    refreshInFlight = loadData()
      .then(() => render())
      .catch((e) => toast(e.message))
      .finally(() => (refreshInFlight = null));
  }, 12000);
  return Promise.resolve();
}

function nav() {
  if (user?.role === "parent")
    return `<nav class="nav parent-nav"><button class="${view === "parentHome" ? "active" : ""}" onclick="go('parentHome')"><span class="ico">⌂</span>Início</button><button class="${view === "matchDay" ? "active" : ""}" onclick="go('matchDay')"><span class="ico">⚽</span>Dia de jogo</button><button class="${view === "absences" ? "active" : ""}" onclick="go('absences')"><span class="ico">📆</span>Faltas</button><button class="${view === "calendar" ? "active" : ""}" onclick="go('calendar')"><span class="ico">📅</span>Calendário</button></nav>`;
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
  const rootView = user?.role === "parent" ? "parentHome" : "home";
  const unread = notificationItems().filter((n) => !n.read).length;
  return `<div class="app"><header class="topbar"><div class="brand">${view !== rootView ? '<button class="back-btn" onclick="goBack()" aria-label="Voltar">←</button>' : ""}<img class="brand-logo" src="logo-formacao-gdr.png"><div class="brand-copy"><h1>${C.APP_NAME}</h1><small>${esc(user.name)}</small></div><button class="notification-bell" onclick="openNotifications()" aria-label="Notificações">🔔${unread ? `<b>${unread}</b>` : ""}</button><span class="role">${admin() ? "Administrador" : user?.role === "parent" ? "Família" : "Treinador"}</span><button class="logout" onclick="logout()">Sair</button></div></header>${dataLoading ? '<div class="sync-strip"><i></i><span>A atualizar informação…</span></div>' : ""}<main class="content">${body}</main>${nav()}</div>`;
}
function go(v) {
  view = v;
  draft = null;
  callupDraft = null;
  selectedAthleteId = null;
  selectedTrainingId = null;
  eventDraft = null;
  selectedAnnouncementId = null;
  render();
}
function goBack() {
  if (user?.role === "parent") {
    availabilityDraft = null;
    view = "parentHome";
    render();
    return;
  }
  if (view === "safety") {
    view = "athleteProfile";
    render();
    return;
  }
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
  if (view === "trainingSummary") {
    view = "calendar";
    selectedTrainingId = null;
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
    view = eventDraft?.returnView || "calendar";
    eventDraft = null;
    render();
    return;
  }
  if (view === "announcementDetail") {
    selectedAnnouncementId = null;
    view = user?.role === "parent" ? "parentHome" : "home";
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

function activeAnnouncements(group = "") {
  const today = new Date().toISOString().slice(0, 10),
    rank = { Urgente: 0, Importante: 1, Normal: 2 };
  return (state.announcements || [])
    .filter(
      (a) =>
        a.active &&
        (!a.startDate || a.startDate <= today) &&
        (!a.endDate || a.endDate >= today) &&
        (!group || a.group === "Todos" || a.group === group),
    )
    .sort(
      (a, b) =>
        (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) ||
        String(b.createdAt).localeCompare(String(a.createdAt)),
    );
}
function announcementAudience(a) {
  return a.group === "Todos" ? "Toda a família GDR" : `Famílias · ${a.group}`;
}
function noticeBoard(limit = 3, group = "") {
  const notices = activeAnnouncements(group).slice(0, limit);
  if (!notices.length && !availabilityOwner()) return "";
  return `<div class="section notice-title"><div><span class="section-kicker">Informação do clube</span><h3>Mural GDR</h3></div><button class="btn btn-small btn-ghost" onclick="go('announcements')">${availabilityOwner() ? "Gerir mural" : "Ver todos os avisos"}</button></div><div class="notice-board notice-preview">${notices
    .map(
      (a) =>
        `<article class="card club-notice notice-compact ${a.priority.toLowerCase()}"><div class="notice-icon">${a.priority === "Urgente" ? "!" : a.priority === "Importante" ? "📣" : "GDR"}</div><div class="grow"><div class="notice-badges">${a.priority !== "Normal" ? `<span class="priority-${a.priority.toLowerCase()}">${esc(a.priority)}</span>` : ""}<span>${esc(announcementAudience(a))}</span>${a.endDate ? `<span>Até ${fmt(a.endDate)}</span>` : ""}</div><strong>${esc(a.title)}</strong><p>${esc(a.message)}</p><button class="notice-read" onclick="openAnnouncement('${a.id}')">Ler aviso completo <i>→</i></button></div></article>`,
    )
    .join(
      "",
    )}${!notices.length ? '<div class="card empty">Ainda não existem avisos publicados.</div>' : ""}</div>`;
}
function birthdayBanner() {
  const birthdays = state.birthdaysToday || [];
  if (!birthdays.length) return "";
  return `<section class="birthday-celebration"><div class="birthday-confetti">🎈 🎉 ⚽ 🎂</div>${birthdays
    .map(
      (birthday) =>
        `<div class="birthday-person">${birthday.photoUrl ? `<img src="${esc(birthday.photoUrl)}" alt="">` : '<span class="birthday-cake">🎂</span>'}<div><span>Hoje estamos em festa!</span><h2>Parabéns, ${esc(birthday.name)}!</h2><p>${esc(birthday.message)}</p><small>${esc(birthday.group)} · ${birthday.age} anos</small></div></div>`,
    )
    .join("")}</section>`;
}
function notificationItems() {
  if (!user) return [];
  const today = new Date().toISOString().slice(0, 10),
    reads = new Set(state.notificationReads || []),
    group =
      user.role === "parent"
        ? state.athletes.find((a) => a.id === selectedParentAthleteId)?.group ||
          state.athletes[0]?.group
        : "",
    items = activeAnnouncements(group).map((a) => ({
      key: `announcement:${a.id}`,
      icon: a.priority === "Urgente" ? "🚨" : "📣",
      title: a.title,
      text: a.message,
      action: "announcementDetail",
      announcementId: a.id,
    }));
  if (user.role === "parent") {
    const childIds = new Set(state.athletes.map((a) => a.id));
    (state.availabilityRequests || [])
      .filter(
        (r) =>
          r.status === "Aberto" &&
          !state.gameAvailability.some(
            (x) =>
              x.eventId === r.eventId &&
              childIds.has(x.athleteId) &&
              x.group === r.group,
          ),
      )
      .forEach((r) =>
        items.push({
          key: `availability:${r.id}`,
          icon: "✅",
          title: "Disponibilidade por responder",
          text: `Resposta necessária até ${fmt(r.deadline)}.`,
          action: "parentHome",
        }),
      );
    state.callups
      .filter(
        (c) =>
          childIds.has(c.athleteId) &&
          c.status === "Convocado" &&
          state.games.some((g) => g.id === c.gameId && g.date >= today),
      )
      .forEach((c) => {
        const g = state.games.find((x) => x.id === c.gameId);
        items.push({
          key: `callup:${c.id}`,
          icon: "⚽",
          title: "Nova convocatória",
          text: `GDR × ${g.opponent} · ${fmt(g.date)}.`,
          action: "matchDay",
        });
      });
  }
  (state.birthdaysToday || []).forEach((birthday) =>
    items.push({
      key: `birthday:${birthday.athleteId}:${today}`,
      icon: "🎂",
      title: `Parabéns, ${birthday.name}!`,
      text: birthday.message,
      action: user.role === "parent" ? "parentHome" : "home",
    }),
  );
  return items.map((item) => ({ ...item, read: reads.has(item.key) }));
}
async function openNotifications() {
  const items = notificationItems(),
    unread = items.filter((n) => !n.read).map((n) => n.key);
  view = "notifications";
  render();
  if (unread.length)
    try {
      await api("markNotificationsRead", { keys: unread });
      state.notificationReads = [...(state.notificationReads || []), ...unread];
    } catch (_) {}
}
function notificationsView() {
  const items = notificationItems();
  const enabled =
    "Notification" in window &&
    localStorage.getItem("gdr360_phone_alerts") === "on" &&
    Notification.permission === "granted";
  return `<div class="section"><div><h3>Notificações</h3><div class="muted">Avisos e ações importantes num só lugar.</div></div></div><div class="card phone-alert-card"><div><strong>📲 Alertas no telemóvel</strong><p>${enabled ? "Os alertas estão ativos neste dispositivo." : "Ativa para receber avisos quando a app estiver aberta ou ativa em segundo plano."}</p></div><button class="btn ${enabled ? "btn-secondary" : "btn-primary"}" onclick="enablePhoneAlerts()">${enabled ? "Alertas ativos" : "Ativar alertas"}</button></div><div class="list notifications-list">${
    items
      .map(
        (n) =>
          `<button class="card notification-row ${n.read ? "" : "unread"}" onclick="${n.announcementId ? `openAnnouncement('${n.announcementId}')` : `go('${n.action}')`}"><span>${n.icon}</span><div class="grow"><strong>${esc(n.title)}</strong><small>${esc(n.text)}</small></div><i>›</i></button>`,
      )
      .join("") ||
    '<div class="card empty">Não existem notificações neste momento.</div>'
  }</div>`;
}
async function enablePhoneAlerts() {
  if (!("Notification" in window))
    return toast("Este dispositivo não suporta notificações.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    return toast("É necessário autorizar as notificações nas definições do telemóvel.");
  localStorage.setItem("gdr360_phone_alerts", "on");
  await showPhoneAlert(
    "Alertas GDR ativados",
    "Passarás a receber atualizações relevantes da formação.",
  );
  render();
}
async function showPhoneAlert(title, body) {
  if (
    localStorage.getItem("gdr360_phone_alerts") !== "on" ||
    Notification.permission !== "granted"
  )
    return;
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        tag: "gdr360-" + title,
      });
    } else new Notification(title, { body, icon: "./icon-192.png" });
  } catch (_) {}
}
function notifyDataChanges(previous, next) {
  if (
    !("Notification" in window) ||
    localStorage.getItem("gdr360_phone_alerts") !== "on" ||
    Notification.permission !== "granted"
  )
    return;
  const sections = [
    ["announcements", "Novo aviso do GDR", "Foi publicado ou atualizado um aviso no mural."],
    ["availabilityRequests", "Disponibilidade atualizada", "Existe uma atualização relativa à disponibilidade para jogos."],
    ["callups", "Convocatória atualizada", "Foi registada uma alteração numa convocatória."],
    ["trainings", "Treino atualizado", "Foi registado ou atualizado um treino."],
    ["records", "Registo de treino atualizado", "Existem novos dados de acompanhamento do atleta."],
    ["monthlyFees", "Situação atualizada", "Foi atualizada informação na área de mensalidades."],
    ["events", "Calendário atualizado", "Foi registada uma alteração no calendário da formação."],
    ["games", "Jogo atualizado", "Foram atualizadas informações de um jogo."],
    ["safetyProfiles", "Ficha de segurança atualizada", "A informação de segurança do atleta foi atualizada."],
    ["birthdaysToday", "Aniversário na família GDR", "Hoje temos um jovem atleta de parabéns!"],
  ];
  sections.forEach(([key, title, message]) => {
    if (
      JSON.stringify(previous?.[key] || []) !==
      JSON.stringify(next?.[key] || [])
    )
      showPhoneAlert(title, message);
  });
}
function announcementsView() {
  const list = availabilityOwner()
    ? state.announcements || []
    : activeAnnouncements(
        user.role === "parent"
          ? state.athletes.find((a) => a.id === selectedParentAthleteId)
              ?.group || state.athletes[0]?.group
          : "",
      );
  return `<div class="section"><div><h3>Mural de avisos do clube</h3><div class="muted">Informações importantes para atletas, famílias e equipa técnica.</div></div>${availabilityOwner() ? '<button class="btn btn-primary" onclick="announcementForm()">+ Novo aviso</button>' : ""}</div><div class="notice-board full">${
    list
      .map(
        (a) =>
          `<article class="card club-notice notice-full ${a.priority.toLowerCase()}"><div class="notice-icon">${a.priority === "Urgente" ? "!" : a.priority === "Importante" ? "📣" : "GDR"}</div><div class="grow"><div class="notice-badges">${a.priority !== "Normal" ? `<span class="priority-${a.priority.toLowerCase()}">${esc(a.priority)}</span>` : ""}<span>${esc(announcementAudience(a))}</span>${a.endDate ? `<span>Até ${fmt(a.endDate)}</span>` : ""}</div><strong>${esc(a.title)}</strong><p>${esc(a.message).replace(/\n/g, "<br>")}</p></div>${availabilityOwner() ? `<button class="btn btn-small btn-danger" onclick="deleteAnnouncement('${a.id}')">Eliminar</button>` : ""}</article>`,
      )
      .join("") ||
    '<div class="card empty">Ainda não existem avisos publicados.</div>'
  }</div>`;
}
function openAnnouncement(id) {
  const group =
      user?.role === "parent"
        ? state.athletes.find((a) => a.id === selectedParentAthleteId)?.group ||
          state.athletes[0]?.group ||
          ""
        : "",
    allowed = availabilityOwner()
      ? state.announcements || []
      : activeAnnouncements(group);
  if (!allowed.some((a) => a.id === id))
    return toast("Este aviso já não está disponível.");
  selectedAnnouncementId = id;
  view = "announcementDetail";
  render();
}
function announcementDetailView() {
  const group =
      user?.role === "parent"
        ? state.athletes.find((a) => a.id === selectedParentAthleteId)?.group ||
          state.athletes[0]?.group ||
          ""
        : "",
    allowed = availabilityOwner()
      ? state.announcements || []
      : activeAnnouncements(group),
    a = allowed.find((item) => item.id === selectedAnnouncementId);
  if (!a)
    return '<div class="card empty">Este aviso já não está disponível.</div>';
  return `<div class="announcement-detail-wrap"><article class="card club-notice notice-full announcement-detail ${a.priority.toLowerCase()}"><div class="notice-icon">${a.priority === "Urgente" ? "!" : a.priority === "Importante" ? "📣" : "GDR"}</div><div class="grow"><div class="notice-badges">${a.priority !== "Normal" ? `<span class="priority-${a.priority.toLowerCase()}">${esc(a.priority)}</span>` : ""}<span>${esc(announcementAudience(a))}</span>${a.endDate ? `<span>Disponível até ${fmt(a.endDate)}</span>` : ""}</div><h2>${esc(a.title)}</h2><div class="announcement-detail-message">${esc(a.message).replace(/\n/g, "<br>")}</div></div></article></div>`;
}
function announcementForm() {
  if (!availabilityOwner()) return;
  view = "announcementForm";
  render();
}
function announcementFormView() {
  const today = new Date().toISOString().slice(0, 10);
  return `<div class="section"><h3>Novo aviso</h3></div><div class="card"><div class="field"><label>Título</label><input id="ant"></div><div class="field"><label>Mensagem</label><textarea id="anm" rows="5"></textarea></div><div class="form2"><div class="field"><label>Destinatários</label><select id="ang"><option>Todos</option><option>Traquinas</option><option>Benjamins</option></select></div><div class="field"><label>Prioridade</label><select id="anp"><option>Normal</option><option>Importante</option><option>Urgente</option></select></div></div><div class="form2"><div class="field"><label>Publicar a partir de</label><input id="ans" type="date" value="${today}"></div><div class="field"><label>Mostrar até</label><input id="ane" type="date"></div></div><button class="btn btn-primary btn-block" onclick="saveAnnouncement()">Publicar aviso</button></div>`;
}
async function saveAnnouncement() {
  try {
    await api("saveAnnouncement", {
      announcement: {
        title: $("ant").value.trim(),
        message: $("anm").value.trim(),
        group: $("ang").value,
        priority: $("anp").value,
        startDate: $("ans").value,
        endDate: $("ane").value,
        active: true,
      },
    });
    await refresh();
    view = "announcements";
    render();
    toast("Aviso publicado");
  } catch (e) {
    toast(e.message);
  }
}
async function deleteAnnouncement(id) {
  if (!confirm("Eliminar este aviso?")) return;
  try {
    await api("deleteAnnouncement", { id });
    await refresh();
    render();
  } catch (e) {
    toast(e.message);
  }
}

function matchDay() {
  const today = new Date().toISOString().slice(0, 10),
    child =
      user.role === "parent"
        ? state.athletes.find((a) => a.id === selectedParentAthleteId) ||
          state.athletes[0]
        : null,
    event = allEvents().find(
      (e) =>
        e.date >= today &&
        (e.type === "Jogo" || e.type === "Torneio") &&
        (!child ||
          e.group === "Todos" ||
          e.group === child.group ||
          child.group === "Traquinas/Benjamins"),
    );
  if (!event)
    return '<div class="matchday-empty card"><span>⚽</span><h2>Modo Dia de Jogo</h2><p>Não existem jogos ou torneios futuros no calendário.</p><button class="btn btn-secondary" onclick="go(\'calendar\')">Abrir calendário</button></div>';
  const group =
      event.group === "Todos" ? child?.group || "Benjamins" : event.group,
    counts = availabilityCounts(event.id, group),
    game = state.games.find(
      (g) =>
        g.date === event.date && (g.group === group || g.group === event.group),
    ),
    request = state.availabilityRequests.find(
      (r) =>
        r.eventId === event.id && r.group === group && r.status === "Aberto",
    ),
    callup = child
      ? game &&
        state.callups.find(
          (c) =>
            c.athleteId === child.id &&
            c.status === "Convocado" &&
            c.gameId === game.id,
        )
      : null,
    answer = child
      ? state.gameAvailability.find(
          (a) =>
            a.eventId === event.id &&
            a.athleteId === child.id &&
            a.group === group,
        )
      : null,
    days = Math.max(
      0,
      Math.ceil(
        (new Date(event.date + "T12:00:00") - new Date(today + "T12:00:00")) /
          86400000,
      ),
    );
  return `<section class="matchday-hero"><span>Modo Dia de Jogo · ${esc(group)}</span><h2>${esc(event.title)}</h2><p>${days === 0 ? "É hoje!" : `Faltam ${days} dia${days === 1 ? "" : "s"}`}</p>${availabilityOwner() ? `<button class="btn matchday-edit-button" onclick="editMatchEvent('${event.id}')">✏️ Editar evento</button>` : ""}</section><div class="matchday-grid"><div class="card matchday-details"><div><span>📅 Data</span><strong>${fmt(event.date)}</strong></div><div><span>🕐 Hora</span><strong>${esc(event.time || "Por definir")}</strong></div><div><span>📍 Local</span><strong>${esc(event.location || "Por definir")}</strong></div><div><span>👕 Equipamento</span><strong>${esc(event.equipment || game?.equipment || "Por definir")}</strong></div></div>${child ? `<div class="card family-match-status"><div><span>Disponibilidade</span><strong>${availabilityIcon(answer?.status || (request ? "Sem resposta" : "Por abrir"))} ${esc(answer?.status || (request ? "Sem resposta" : "Por abrir"))}</strong></div><div><span>Convocatória</span><strong>${callup ? "✅ Convocado" : "⏳ Por definir"}</strong></div>${request ? `<button class="btn btn-primary" onclick="openAvailability('${event.id}','${group}')">${answer ? "Alterar disponibilidade" : "Responder disponibilidade"}</button>` : '<div class="muted">A resposta de disponibilidade ainda não foi aberta pelo clube.</div>'}</div>` : `<div class="card technical-match-status"><div><span>Disponíveis</span><strong>${counts.available}</strong></div><div><span>Indisponíveis</span><strong>${counts.unavailable}</strong></div><div><span>Sem resposta</span><strong>${counts.noAnswer}</strong></div><div class="matchday-actions"><button class="btn btn-secondary" onclick="openAvailability('${event.id}','${group}')">Disponibilidade</button><button class="btn btn-primary" onclick="prepareCallupForEvent('${event.id}','${group}')">Preparar convocatória</button>${game ? `<button class="btn btn-secondary" onclick="openLineup('${game.id}')">Sete inicial</button>` : ""}</div></div>`}</div>${event.location ? `<a class="btn btn-secondary btn-block map-button" target="_blank" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}">📍 Abrir localização</a>` : ""}`;
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
  return `<section class="dashboard-hero"><div><span class="eyebrow">${new Date(today + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}</span><h2>Olá, ${esc(user.name)}</h2><p>${todayEvents.length ? `${todayEvents.length} evento(s) marcado(s) para hoje.` : nextEvent ? `Próximo: ${esc(nextEvent.title)} em ${fmt(nextEvent.date)}.` : "Sem eventos futuros marcados."}</p></div><button class="btn btn-primary" onclick="go('training')">⚡ Registar treino</button></section>${birthdayBanner()}${noticeBoard(2)}
  <div class="home-layout"><section><div class="section"><h3>Hoje e a seguir</h3><button class="btn btn-small btn-ghost" onclick="go('calendar')">Calendário</button></div><div class="list">${todayEvents.length ? todayEvents.map(eventCard).join("") : nextEvent ? eventCard(nextEvent) : '<div class="card empty">Sem eventos agendados.</div>'}</div>
  <div class="section"><h3>Estado da formação</h3></div><div class="status-grid"><button class="card status-card green" onclick="go('athletes')"><span>🟢 Normal</span><strong>${green}</strong></button><button class="card status-card yellow" onclick="go('dashboard')"><span>🟡 A acompanhar</span><strong>${yellow}</strong></button><button class="card status-card red" onclick="go('dashboard')"><span>🔴 Atenção</span><strong>${red}</strong></button></div>
  ${attention.length ? `<div class="attention-list">${attention.map(({ a, light }) => `<button onclick="openAthlete('${a.id}')">${avatar(a)}<span><b>${esc(a.name)}</b><small>${esc(light.reasons[0] || light.label)}</small></span><i>${light.icon}</i></button>`).join("")}</div>` : ""}
  <div class="section"><h3>Último treino</h3></div>${lastTraining ? `<button class="card last-training last-training-button" onclick="openTrainingSummary('${lastTraining.id}')"><div><b>${fmt(lastTraining.date)}</b><span>${esc(lastTraining.group)}</span></div><div><strong>${lastPresent}/${lastRecords.length}</strong><span>presentes</span></div><div><strong>${lastRecords.length ? Math.round((lastPresent / lastRecords.length) * 100) : 0}%</strong><span>assiduidade</span></div><i>Ver resumo ›</i></button>` : '<div class="card empty">Ainda sem treinos registados.</div>'}</section>
  <aside><div class="section"><h3>Tarefas pendentes</h3><span class="task-count">${tasks.length}</span></div><div class="task-list">${tasks.map((t) => `<button class="card" onclick="${t.action}"><span>${t.icon}</span><b>${esc(t.text)}</b><i>›</i></button>`).join("") || '<div class="card all-good">✓ Não existem tarefas urgentes.</div>'}</div>
  <div class="section"><h3>Faltas comunicadas</h3><button class="btn btn-small btn-ghost" onclick="go('absences')">Gerir</button></div><div class="card mini-summary"><strong>${planned.length}</strong><span>próximas</span><b>${todayAbsences.length} hoje</b></div>
  <div class="section"><h3>Mensalidades</h3><button class="btn btn-small btn-ghost" onclick="go('fees')">Abrir</button></div>${feesStarted ? `<div class="card mini-summary"><strong>${feesPaid}/${active.length}</strong><span>pagas este mês</span><b class="${feesMissing ? "danger-text" : ""}">${feesMissing} em falta</b></div>` : '<div class="card mini-summary future"><strong>Outubro 2026</strong><span>início das mensalidades</span></div>'}</aside></div>
  <div class="section"><h3>Ações rápidas</h3></div><div class="quick-grid compact"><button class="btn btn-secondary" onclick="go('matchDay')">🏟️ Modo dia de jogo</button><button class="btn btn-secondary" onclick="go('announcements')">📣 Mural do clube</button><button class="btn btn-secondary" onclick="go('weekly')">📊 Resumo semanal</button><button class="btn btn-secondary" onclick="go('absences')">📆 Falta antecipada</button><button class="btn btn-secondary" onclick="view='games';render()">⚽ Jogos e disponibilidade</button><button class="btn btn-secondary" onclick="go('callup')">📋 Novo jogo</button><button class="btn btn-secondary" onclick="go('athletes')">👥 Atletas</button>${availabilityOwner() ? '<button class="btn btn-secondary" onclick="view=\'users\';render()">🔐 Utilizadores</button><button class="btn btn-secondary" onclick="generateMonthlySummaries()">✨ Gerar resumos IA</button>' : ""}</div>`;
}
async function generateMonthlySummaries() {
  const month = prompt(
    "Mês dos resumos (AAAA-MM):",
    new Date().toISOString().slice(0, 7),
  );
  if (!month) return;
  try {
    toast("A gerar os resumos mensais…");
    const result = await api("generateMonthlySummaries", { month });
    await refresh();
    render();
    toast(`${result.generated} resumo(s) gerado(s)`);
  } catch (e) {
    toast(e.message);
  }
}
function parentHome() {
  const children = sortName(state.athletes || []);
  if (!children.length)
    return '<div class="card empty">Esta conta ainda não tem nenhum atleta associado.</div>';
  if (!children.some((a) => a.id === selectedParentAthleteId))
    selectedParentAthleteId = children[0].id;
  const child = children.find((a) => a.id === selectedParentAthleteId),
    today = new Date().toISOString().slice(0, 10),
    records = athleteRecords(child.id)
      .slice()
      .sort((a, b) =>
        trainingDate(b.trainingId).localeCompare(trainingDate(a.trainingId)),
      ),
    present = records.filter((r) => r.status === "Presente"),
    attendance = records.length
      ? Math.round((present.length / records.length) * 100)
      : 0,
    month = today.slice(0, 7),
    monthRecords = records.filter(
      (r) => trainingDate(r.trainingId).slice(0, 7) === month,
    ),
    trend = athleteTrend(child.id),
    requests = (state.availabilityRequests || [])
      .filter(
        (r) =>
          r.status === "Aberto" &&
          r.deadline >= today &&
          (r.group === child.group || child.group === "Traquinas/Benjamins"),
      )
      .map((r) => ({
        ...r,
        event: allEvents().find((e) => e.id === r.eventId),
      }))
      .filter((r) => r.event),
    nextEvents = allEvents()
      .filter(
        (e) =>
          e.date >= today &&
          (e.group === "Todos" ||
            e.group === child.group ||
            child.group === "Traquinas/Benjamins"),
      )
      .slice(0, 5),
    summary = (state.monthlySummaries || [])
      .filter(
        (s) =>
          s.athleteId === child.id &&
          s.text &&
          !s.text.startsWith("Ainda não existem registos suficientes"),
      )
      .sort((a, b) => b.month.localeCompare(a.month))[0],
    avgValue = (key) =>
      present.length
        ? (
            present.reduce((sum, r) => sum + Number(r[key] || 0), 0) /
            present.length
          ).toFixed(1)
        : "—",
    currentEvolution = parentEvolutionMessage(
      child,
      records,
      attendance,
      Number(avgValue("effort")),
      Number(avgValue("behavior")),
    ),
    parentCallupsHtml = parentCallupsSection(child, today),
    parentFeesHtml = parentFeesSection(child, today),
    monthlyGoal = parentMonthlyGoal(child, records, today),
    achievements = parentAchievements(child, records, today);
  return `<section class="parent-athlete-hero">${avatar(child, "avatar-xl")}<div class="grow"><span>Portal dos Pais</span><h2>${esc(child.name)}</h2><div class="parent-athlete-meta">${groupBadge(child.group)}<b>${trend.icon} ${esc(trend.label)}</b></div></div>${children.length > 1 ? `<select onchange="selectedParentAthleteId=this.value;render()">${children.map((a) => `<option value="${a.id}" ${a.id === child.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : ""}</section>${birthdayBanner()}${noticeBoard(2, child.group)}<div class="parent-main-grid"><section><div class="section"><h3>Disponibilidades abertas</h3><span class="task-count">${requests.length}</span></div><div class="list">${
    requests
      .map((r) => {
        const answer = (state.gameAvailability || []).find(
            (x) =>
              x.eventId === r.eventId &&
              x.athleteId === child.id &&
              x.group === r.group,
          ),
          status = answer?.status || "Sem resposta";
        return `<div class="card parent-request ${status.replace(" ", "-").toLowerCase()}"><div class="grow"><strong>${esc(r.event.title)}</strong><div class="muted">${fmt(r.event.date)} · ${esc(r.event.time || "Hora por definir")} · ${esc(r.group)}</div><span>Prazo: ${fmt(r.deadline)}</span></div><b class="parent-answer">${availabilityIcon(status)} ${esc(status)}</b><button class="btn btn-primary" onclick="openAvailability('${r.eventId}','${r.group}')">${status === "Sem resposta" ? "Responder agora" : "Alterar resposta"}</button></div>`;
      })
      .join("") ||
    '<div class="card empty">Não existem disponibilidades abertas.</div>'
  }</div><div class="section"><h3>Evolução do atleta</h3></div><div class="card ai-parent-summary">${summary ? `<div class="ai-summary-head"><span>Balanço mensal</span><b>${new Date(summary.month + "-01T12:00:00").toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}</b></div><p>${esc(summary.text).replace(/\n/g, "<br>")}</p>` : `<div class="ai-summary-head"><span>Acompanhamento atual</span><b>${records.length} ${records.length === 1 ? "treino registado" : "treinos registados"}</b></div><p>${esc(currentEvolution)}</p>`}<small>Análise atualizada com base nos registos dos treinos.</small></div><div class="section"><h3>Treinos recentes</h3><span>${records.length} registos</span></div><div class="list parent-trainings">${
    records
      .slice(0, 6)
      .map((r) => {
        const training = state.trainings.find((t) => t.id === r.trainingId);
        return `<button class="card parent-training" onclick="openTrainingSummary('${r.trainingId}')"><div class="training-status ${(r.status || "").toLowerCase()}">${r.status === "Presente" ? "✓" : r.status === "Justificada" ? "J" : "×"}</div><div class="grow"><strong>${fmt(training?.date)}</strong><span>${esc(training?.group || child.group)} · ${esc(training?.time || "")}</span></div><b>${esc(r.status)}</b><i>›</i></button>`;
      })
      .join("") ||
    '<div class="card empty">Ainda não existem treinos registados.</div>'
  }</div>${parentCallupsHtml}${parentFeesHtml}</section><aside><div class="parent-kpis"><div class="card"><span>Assiduidade</span><strong>${attendance}%</strong><small>${present.length}/${records.length} presenças</small></div><div class="card"><span>Treinos este mês</span><strong>${monthRecords.length}</strong><small>${monthRecords.filter((r) => r.status === "Presente").length} presenças</small></div><div class="card"><span>Empenho</span><strong>${avgValue("effort")}</strong><small>média global</small></div><div class="card"><span>Comportamento</span><strong>${avgValue("behavior")}</strong><small>média global</small></div></div><div class="section"><h3>Objetivo do mês</h3></div><div class="card parent-goal"><div class="goal-icon">🎯</div><div class="grow"><strong>${esc(monthlyGoal.title)}</strong><p>${esc(monthlyGoal.message)}</p><div class="goal-track"><i style="width:${monthlyGoal.progress}%"></i></div><small>${monthlyGoal.progress}% do objetivo</small></div></div><div class="section"><h3>Conquistas do atleta</h3><span>${achievements.length}</span></div><div class="parent-achievements">${achievements.map((a) => `<div class="card achievement"><span>${a.icon}</span><div><strong>${esc(a.title)}</strong><small>${esc(a.text)}</small></div></div>`).join("")}</div><div class="section"><h3>Evolução recente</h3></div>${evolutionBars(child.id)}<div class="section"><h3>Próximos eventos</h3><button class="btn btn-small btn-ghost" onclick="go('calendar')">Ver calendário</button></div><div class="list parent-events">${nextEvents.map(eventCard).join("") || '<div class="card empty">Sem eventos futuros.</div>'}</div><div class="section"><h3>Ações</h3></div><div class="quick-grid"><button class="btn btn-secondary" onclick="openSafety('${child.id}')">🛡️ Segurança do atleta</button>${child.playerCardPhotoUrl ? `<a class="btn btn-secondary" href="${esc(child.playerCardPhotoUrl)}" target="_blank" rel="noopener">🪪 Cartão de jogador</a>` : ""}<button class="btn btn-secondary" onclick="go('calendar')">📅 Calendário</button><button class="btn btn-secondary" onclick="go('absences')">📆 Comunicar falta</button></div></aside></div>`;
}

function parentEvolutionMessage(child, records, attendance, effort, behavior) {
  if (!records.length)
    return `A época de ${child.name} será acompanhada nesta área assim que forem registados os primeiros treinos.`;
  const latest = records[0],
    presence =
      latest.status === "Presente"
        ? "esteve presente no treino mais recente"
        : latest.status === "Justificada"
          ? "teve a ausência do treino mais recente devidamente justificada"
          : "não esteve presente no treino mais recente",
    attendanceText =
      attendance >= 90
        ? `mantém uma assiduidade muito positiva de ${attendance}%`
        : attendance >= 70
          ? `mantém uma assiduidade regular de ${attendance}%`
          : `apresenta atualmente uma assiduidade de ${attendance}%`,
    qualities = [];
  if (Number.isFinite(effort))
    qualities.push(
      effort >= 4
        ? "um empenho muito positivo"
        : effort >= 3
          ? "um empenho consistente"
          : "margem para reforçar o empenho",
    );
  if (Number.isFinite(behavior))
    qualities.push(
      behavior >= 4
        ? "um comportamento muito positivo"
        : behavior >= 3
          ? "um comportamento consistente"
          : "margem para evoluir no comportamento",
    );
  return `${child.name} ${presence} e ${attendanceText}. ${qualities.length ? `Os registos indicam ${qualities.join(" e ")}. ` : ""}A evolução continuará a ser acompanhada nos próximos treinos.`;
}

function parentCallupsSection(child, today) {
  const rows = athleteCallups(child.id)
    .map((callup) => ({
      callup,
      game: state.games.find((game) => game.id === callup.gameId),
    }))
    .filter((row) => row.game)
    .sort((a, b) => b.game.date.localeCompare(a.game.date))
    .slice(0, 4);
  return `<div class="section"><h3>Convocatórias</h3><span>${rows.filter((r) => r.game.date >= today).length} próximas</span></div><div class="list parent-callups">${
    rows
      .map(
        ({ game }) =>
          `<div class="card parent-callup"><div class="callup-icon">${game.date >= today ? "⚽" : "✓"}</div><div class="grow"><strong>Convocado · GDR × ${esc(game.opponent)}</strong><span>${fmt(game.date)} · ${esc(game.time || "Hora por definir")}${game.location ? ` · ${esc(game.location)}` : ""}</span><small>${esc(game.group)}${game.equipment ? ` · Equipamento ${esc(game.equipment)}` : ""}</small></div><b class="callup-status">Convocado</b></div>`,
      )
      .join("") ||
    '<div class="card empty">Não existem convocatórias publicadas para este atleta.</div>'
  }</div>`;
}

function parentFeesSection(child, today) {
  const start = state.settings?.feeStartMonth || "2026-10",
    rows = (state.monthlyFees || [])
      .filter((fee) => fee.athleteId === child.id)
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 6),
    currentMonth = today.slice(0, 7),
    current = rows.find((fee) => fee.month === currentMonth),
    currentStatus = current
      ? feeStatus(current, currentMonth)
      : currentMonth < start
        ? "Ainda não iniciada"
        : feeStatus(null, currentMonth);
  return `<div class="section"><h3>Mensalidades</h3><span class="fee-parent-current ${groupClass(currentStatus)}">${esc(currentStatus)}</span></div><div class="card parent-fees"><div class="parent-fee-head"><div><span>Situação atual</span><strong>${esc(currentStatus)}</strong></div><b>${currentMonth < start ? "Início em outubro de 2026" : "10 € / mês"}</b></div>${
    rows.length
      ? `<div class="parent-fee-history">${rows
          .map(
            (fee) =>
              `<div><span>${new Date(fee.month + "-01T12:00:00").toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}</span><b>${esc(fee.status)}</b>${fee.status === "Pago" ? `<small>${fmt(fee.paymentDate)} · ${esc(fee.method)}</small>` : ""}</div>`,
          )
          .join("")}</div>`
      : `<p class="muted">${currentMonth < start ? "O histórico ficará disponível aqui a partir da primeira mensalidade." : "Ainda não existem mensalidades registadas."}</p>`
  }</div>${parentAgenda(child, today)}${parentHomeSupport(child)}`;
}

function parentMonthlyGoal(child, records, today) {
  const month = today.slice(0, 7),
    rr = records.filter(
      (record) => trainingDate(record.trainingId).slice(0, 7) === month,
    ),
    present = rr.filter((record) => record.status === "Presente"),
    average = (key) =>
      present.length
        ? present.reduce((sum, record) => sum + Number(record[key] || 0), 0) /
          present.length
        : 0;
  if (!rr.length)
    return {
      title: "Participar no primeiro treino do mês",
      message: `O primeiro objetivo de ${child.name} é iniciar o mês com presença e participação no treino.`,
      progress: 0,
    };
  const options = [
    {
      title: "Assiduidade consistente",
      message:
        "Objetivo: alcançar pelo menos 90% de presença nos treinos deste mês.",
      progress: Math.min(
        100,
        Math.round((present.length / rr.length / 0.9) * 100),
      ),
    },
    {
      title: "Empenho em cada treino",
      message:
        "Objetivo: manter um nível de empenho consistente ao longo do mês.",
      progress: Math.min(100, Math.round((average("effort") / 4) * 100)),
    },
    {
      title: "Atitude positiva",
      message:
        "Objetivo: manter uma atitude positiva e disponível em todos os treinos.",
      progress: Math.min(100, Math.round((average("attitude") / 4) * 100)),
    },
    {
      title: "Comportamento exemplar",
      message:
        "Objetivo: manter um comportamento muito positivo durante os treinos.",
      progress: Math.min(100, Math.round((average("behavior") / 4) * 100)),
    },
  ];
  return options.sort((a, b) => a.progress - b.progress)[0];
}

function parentAchievements(child, records, today) {
  if (!records.length)
    return [
      {
        icon: "🌱",
        title: "Primeira conquista a caminho",
        text: "Será desbloqueada com o primeiro treino registado.",
      },
    ];
  const present = records.filter((record) => record.status === "Presente"),
    average = (key) =>
      present.length
        ? present.reduce((sum, record) => sum + Number(record[key] || 0), 0) /
          present.length
        : 0,
    month = today.slice(0, 7),
    monthRecords = records.filter(
      (record) => trainingDate(record.trainingId).slice(0, 7) === month,
    ),
    streak = records.findIndex((record) => record.status !== "Presente"),
    currentStreak = streak < 0 ? records.length : streak,
    tags = present.flatMap((record) => record.tags || []),
    achievements = [
      {
        icon: "⭐",
        title: "Primeiro treino",
        text: "Primeiro registo da época concluído.",
      },
    ];
  if (!present.length)
    return [
      {
        icon: "🌱",
        title: "Primeira participação a caminho",
        text: "A conquista será desbloqueada na primeira presença registada.",
      },
    ];
  if (
    monthRecords.length >= 2 &&
    monthRecords.every((record) => record.status === "Presente")
  )
    achievements.push({
      icon: "🏅",
      title: "Assiduidade total",
      text: "Presença em todos os treinos registados este mês.",
    });
  if (currentStreak >= 3)
    achievements.push({
      icon: "🔥",
      title: `${currentStreak} presenças seguidas`,
      text: "Uma excelente sequência de participação.",
    });
  if (currentStreak >= 5)
    achievements.push({
      icon: "🏆",
      title: "Cinco presenças consecutivas",
      text: "Um marco de compromisso e continuidade com a equipa.",
    });
  if (present.length >= 10)
    achievements.push({
      icon: "🔟",
      title: "10 treinos realizados",
      text: "Dez sessões de aprendizagem e crescimento concluídas.",
    });
  if (present.length >= 3 && average("effort") >= 4)
    achievements.push({
      icon: "💪",
      title: "Grande empenho",
      text: "Empenho muito positivo nos treinos registados.",
    });
  if (present.length >= 3 && average("behavior") >= 4)
    achievements.push({
      icon: "🤝",
      title: "Atitude de equipa",
      text: "Comportamento muito positivo e consistente.",
    });
  if (athleteCallups(child.id).length)
    achievements.push({
      icon: "⚽",
      title: "Primeira convocatória",
      text: "Convocado para representar o GDR.",
    });
  if (tags.some((tag) => tag.includes("Evolução")))
    achievements.push({
      icon: "📈",
      title: "Evolução reconhecida",
      text: "A equipa técnica assinalou uma evolução positiva.",
    });
  if (
    tags.some((tag) =>
      ["Qualidade técnica", "Tomada de decisão", "Posicionamento", "Passe", "Finalização", "Transição"].some((key) => tag.includes(key)),
    )
  )
    achievements.push({
      icon: "🎯",
      title: "Destaque futebolístico",
      text: "Foi reconhecido um indicador técnico-tático positivo no treino.",
    });
  return achievements.slice(0, 8);
}

function parentAgenda(child, today) {
  const events = allEvents()
      .filter(
        (event) =>
          event.date >= today &&
          (event.group === "Todos" ||
            event.group === child.group ||
            child.group === "Traquinas/Benjamins"),
      )
      .slice(0, 7),
    recent = athleteRecords(child.id)
      .slice()
      .sort((a, b) =>
        trainingDate(b.trainingId).localeCompare(trainingDate(a.trainingId)),
      )
      .slice(0, 2);
  const eventRows = events.map((event) => {
    const request = (state.availabilityRequests || []).find(
        (item) => item.eventId === event.id && item.status === "Aberto",
      ),
      answer = request
        ? (state.gameAvailability || []).find(
            (item) =>
              item.eventId === event.id && item.athleteId === child.id,
          )
        : null,
      game = state.games.find(
        (item) =>
          item.date === event.date &&
          (item.group === child.group || item.group === event.group),
      ),
      called = game
        ? state.callups.some(
            (item) =>
              item.gameId === game.id &&
              item.athleteId === child.id &&
              item.status === "Convocado",
          )
        : false,
      absence = (state.plannedAbsences || []).some(
        (item) =>
          item.athleteId === child.id && item.date === event.date && item.active,
      ),
      status = absence
        ? "Falta comunicada"
        : called
          ? "Convocado"
          : request
            ? answer?.status || "Disponibilidade por responder"
            : "Agendado";
    return `<div class="family-agenda-row"><div class="agenda-date"><b>${new Date(event.date + "T12:00:00").getDate()}</b><span>${new Date(event.date + "T12:00:00").toLocaleDateString("pt-PT", { month: "short" }).toUpperCase()}</span></div><div class="grow"><strong>${esc(event.title)}</strong><small>${esc(event.type)} · ${esc(event.time || "Hora por definir")}${event.location ? ` · ${esc(event.location)}` : ""}</small></div><span class="agenda-status ${status.toLowerCase().replace(/\s/g, "-")}">${esc(status)}</span></div>`;
  });
  const recentRows = recent.map((record) => {
    const training = state.trainings.find((item) => item.id === record.trainingId);
    return `<button class="family-agenda-row completed" onclick="openTrainingSummary('${record.trainingId}')"><div class="agenda-date"><b>✓</b><span>FEITO</span></div><div class="grow"><strong>Treino de ${fmt(training?.date)}</strong><small>${esc(record.status)} · Consultar acompanhamento</small></div><i>›</i></button>`;
  });
  return `<div class="section"><div><h3>Agenda de ${esc(child.name)}</h3><div class="muted">Tudo o que diz respeito ao atleta, organizado num só local.</div></div></div><div class="card family-agenda">${eventRows.join("") || '<div class="empty">Sem próximos compromissos.</div>'}${recentRows.length ? `<div class="agenda-divider">Atividade recente</div>${recentRows.join("")}` : ""}</div>`;
}

function parentHomeSupport(child) {
  const age = ageFromBirthDate(child.birthDate),
    young = !age || age <= 7,
    dayNumber = Math.floor(Date.now() / 86400000),
    football = young
      ? [
          ["⚽", "Descobrir a bola", "Brincar dez minutos com a bola e experimentar os dois pés, sem corrigir cada movimento."],
          ["👀", "Olhar antes de jogar", "Num jogo simples, incentivar a criança a olhar em redor antes de passar a bola."],
          ["🎯", "Um pequeno desafio", "Criar dois alvos e tentar acertar com passes suaves. Celebrar as tentativas, não apenas os acertos."],
          ["🦶", "Os dois pés contam", "Fazer uma brincadeira curta alternando o pé direito e o esquerdo, sempre sem pressão."],
          ["🏃", "Mexer e sorrir", "Inventar um pequeno percurso com bola. O objetivo de hoje é movimentar-se e divertir-se."],
        ]
      : [
          ["⚽", "Domínio e passe", "Praticar dez minutos de domínio e passe contra uma parede, alternando os dois pés."],
          ["👀", "Ler o jogo", "Num momento com bola, desafiar a criança a levantar a cabeça antes de decidir para onde jogar."],
          ["🎯", "Precisão com propósito", "Escolher pequenos alvos e trabalhar a qualidade do passe, sem contar falhas como castigo."],
          ["🦶", "Confiança no pé menos usado", "Fazer uma sequência curta com o pé menos confortável e reconhecer cada melhoria."],
          ["🔄", "Decidir depressa", "Criar duas opções de passe e indicar uma delas no último momento, treinando atenção e decisão."],
        ],
    character = [
      ["🤝", "Ser um bom colega", "Conversar sobre uma forma concreta de ajudar um colega no próximo treino."],
      ["💬", "Aprender com o dia", "Perguntar: “O que aprendeste?” e ouvir até ao fim, sem transformar a conversa numa avaliação."],
      ["🌱", "Errar faz parte", "Recordar que um erro é uma oportunidade para tentar novamente e aprender algo novo."],
      ["❤️", "Respeito primeiro", "Reforçar que respeitar colegas, treinadores e adversários vale tanto como jogar bem."],
      ["🧠", "Resolver problemas", "Perante uma pequena dificuldade, dar tempo para a criança pensar numa solução antes de ajudar."],
      ["👏", "Valorizar o esforço", "Elogiar uma atitude concreta — persistência, coragem ou entreajuda — em vez de falar apenas do resultado."],
      ["😊", "Jogar com alegria", "Perguntar o que mais a fez sorrir no futebol esta semana e dar espaço para contar a história."],
    ],
    autonomy = [
      ["🎒", "Cuidar do equipamento", young ? "Preparar o saco em conjunto e deixar a criança identificar o que falta." : "Deixar a criança preparar o saco e fazer apenas uma confirmação final."],
      ["⏰", "Cumprir compromissos", "Envolver a criança na preparação da hora de saída, ensinando pontualidade de forma positiva."],
      ["🧹", "Responsabilidade diária", "Depois de usar a bola ou o equipamento, incentivar a criança a arrumar tudo no lugar."],
      ["🙋", "Pedir ajuda também é crescer", "Mostrar que reconhecer uma dificuldade e pedir ajuda é um sinal de coragem e maturidade."],
      ["✅", "Uma tarefa até ao fim", "Escolher uma pequena responsabilidade adequada à idade e deixá-la concluí-la com autonomia."],
    ],
    wellbeing = [
      ["💧", "Hidratar bem", "Incentivar água ao longo do dia e levar a garrafa preparada para o treino."],
      ["😴", "Dormir para crescer", "Uma rotina calma e uma boa noite de sono ajudam a aprender, recuperar e jogar com energia."],
      ["🍎", "Energia para brincar", "Escolher em conjunto um lanche simples e equilibrado antes ou depois da atividade."],
      ["🫶", "Dar nome às emoções", "Ajudar a criança a dizer se está feliz, nervosa ou frustrada, lembrando que todas as emoções são válidas."],
      ["🌤️", "Tempo para descansar", "Crescer também exige pausas. Hoje, equilibrar atividade, escola, brincadeira livre e descanso."],
    ],
    pick = (list, offset) => list[(dayNumber + offset) % list.length],
    tips = [pick(football, 0), pick(character, 2), pick(autonomy, 4), pick(wellbeing, 6)];
  return `<div class="section"><div><span class="section-kicker">Para a família · sugestões do dia</span><h3>Como pode apoiar o seu filho</h3><div class="muted">Ideias práticas para os pais aplicarem com crianças de ${age ? `${age} anos` : "6–10 anos"}, renovadas diariamente.</div></div></div><div class="home-support-grid">${tips.map((tip) => `<div class="card home-support"><span>${tip[0]}</span><strong>${esc(tip[1])}</strong><p>${esc(tip[2])}</p></div>`).join("")}</div><div class="family-support-note"><b>Não formamos apenas jogadores, formamos pessoas.</b> O papel da família é acompanhar, encorajar e ajudar a criança a gostar do jogo. As orientações técnicas continuam a pertencer à equipa técnica.</div>`;
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
  ensureExistingTrainingNarratives(
    athleteRecords(id).map((record) => record.trainingId),
  );
}
function safetyFor(id) {
  return (state.safetyProfiles || []).find((x) => x.athleteId === id) || null;
}
function safetyStale(profile) {
  if (!profile?.confirmedAt) return true;
  return Date.now() - new Date(profile.confirmedAt).getTime() > 365 * 86400000;
}
function openSafety(id) {
  selectedAthleteId = id;
  view = "safety";
  render();
  api("logSafetyAccess", { athleteId: id, accessAction: "Consulta", reason: "Abertura da ficha de segurança" }).catch(() => {});
}
function safetyView() {
  const a = state.athletes.find((x) => x.id === selectedAthleteId);
  if (!a) return '<div class="card empty">Atleta não encontrado.</div>';
  const p = safetyFor(a.id), editable = admin() || user?.role === "parent", stale = safetyStale(p);
  const phone = (n) => esc(String(n || "").replace(/[^+\d]/g, ""));
  if (!editable && !p) return `<div class="profile-head card">${avatar(a, "avatar-xl")}<div class="grow"><h2>${esc(a.name)}</h2>${groupBadge(a.group)}</div></div><div class="card empty">A ficha de segurança ainda não foi confirmada pela família.</div>`;
  return `<section class="safety-hero"><div class="safety-shield">🛡️</div><div class="grow"><span>Segurança do atleta</span><h2>${esc(a.name)}</h2><div>${groupBadge(a.group)} <b class="safety-status ${stale ? "warning" : "ok"}">${p ? (stale ? "Confirmação anual necessária" : "Informação confirmada") : "Por preencher"}</b></div></div>${p?.confirmedAt ? `<small>Confirmado em ${new Date(p.confirmedAt).toLocaleDateString("pt-PT")}</small>` : ""}</section>
  ${p?.criticalAlerts ? `<div class="safety-alert"><strong>⚠️ Alerta importante</strong><p>${esc(p.criticalAlerts)}</p></div>` : ""}
  ${p ? `<div class="safety-grid"><div class="card safety-contact"><span>Contacto principal</span><strong>${esc(p.contact1Name)}</strong><small>${esc(p.contact1Relation)}</small><a class="btn btn-primary" href="tel:${phone(p.contact1Phone)}">📞 ${esc(p.contact1Phone)}</a></div>${p.contact2Name ? `<div class="card safety-contact"><span>Segundo contacto</span><strong>${esc(p.contact2Name)}</strong><small>${esc(p.contact2Relation)}</small><a class="btn btn-secondary" href="tel:${phone(p.contact2Phone)}">📞 ${esc(p.contact2Phone)}</a></div>` : ""}</div><div class="safety-info-grid">${[["💊","Medicação de emergência",p.emergencyMedication],["🏃","Limitações temporárias",p.temporaryLimitations],["🚨","Instruções em emergência",p.emergencyInstructions],["👥","Pessoas autorizadas a recolher",p.authorizedPickup]].map(([i,t,v]) => `<div class="card safety-info"><span>${i}</span><div><strong>${t}</strong><p>${esc(v || "Nada indicado.")}</p></div></div>`).join("")}</div>` : ""}
  ${editable ? `<div class="section"><h3>${p ? "Atualizar e confirmar" : "Preencher ficha de segurança"}</h3></div><div class="card safety-form"><div class="privacy-note"><strong>🔒 Informação reservada</strong><p>Utilizada apenas para proteção do atleta e atuação em caso de necessidade. A família deve confirmar estes dados pelo menos uma vez por ano.</p></div><div class="form2"><div class="field"><label>Contacto principal *</label><input id="sc1n" value="${esc(p?.contact1Name || "")}" placeholder="Nome completo"></div><div class="field"><label>Relação</label><input id="sc1r" value="${esc(p?.contact1Relation || "")}" placeholder="Mãe, pai, tutor…"></div><div class="field"><label>Telefone principal *</label><input id="sc1p" inputmode="tel" value="${esc(p?.contact1Phone || "")}"></div><div class="field"><label>Segundo contacto</label><input id="sc2n" value="${esc(p?.contact2Name || "")}" placeholder="Nome completo"></div><div class="field"><label>Relação</label><input id="sc2r" value="${esc(p?.contact2Relation || "")}"></div><div class="field"><label>Segundo telefone</label><input id="sc2p" inputmode="tel" value="${esc(p?.contact2Phone || "")}"></div></div><div class="field"><label>Alertas críticos</label><textarea id="scalert" placeholder="Alergias graves, condições essenciais ou cuidados imediatos">${esc(p?.criticalAlerts || "")}</textarea></div><div class="field"><label>Medicação de emergência</label><textarea id="scmed" placeholder="Indicar apenas medicação indispensável e como deve ser utilizada">${esc(p?.emergencyMedication || "")}</textarea></div><div class="field"><label>Limitações temporárias</label><textarea id="sclimit" placeholder="Ex.: não realizar contacto físico até determinada data">${esc(p?.temporaryLimitations || "")}</textarea></div><div class="field"><label>Instruções em caso de emergência</label><textarea id="scinst">${esc(p?.emergencyInstructions || "")}</textarea></div><div class="field"><label>Pessoas autorizadas a recolher o atleta</label><textarea id="scpickup">${esc(p?.authorizedPickup || "")}</textarea></div><label class="consent-check"><input id="scconsent" type="checkbox"> Confirmo que os dados estão corretos e autorizo o seu tratamento exclusivo para segurança e emergência do atleta.</label><button class="btn btn-primary btn-block" onclick="saveSafety('${a.id}')">Guardar e confirmar ficha</button></div>` : '<div class="admin-note">🔒 Consulta reservada. Apenas o Administrador e a família associada podem alterar estes dados.</div>'}`;
}
async function saveSafety(athleteId) {
  try {
    const value = (id) => $(id)?.value.trim() || "";
    await api("saveSafetyProfile", { profile: { athleteId, contact1Name:value("sc1n"), contact1Relation:value("sc1r"), contact1Phone:value("sc1p"), contact2Name:value("sc2n"), contact2Relation:value("sc2r"), contact2Phone:value("sc2p"), criticalAlerts:value("scalert"), emergencyMedication:value("scmed"), temporaryLimitations:value("sclimit"), emergencyInstructions:value("scinst"), authorizedPickup:value("scpickup"), consent:!!$("scconsent")?.checked } });
    await refresh(); render(); toast("Ficha de segurança confirmada");
  } catch (e) { toast(e.message); }
}
function athleteForm(id = "") {
  if (!admin()) return;
  const a = id ? state.athletes.find((x) => x.id === id) : null;
  view = "athleteForm";
  $("app").innerHTML = shell(
    `<div class="section"><h3>${a ? "Editar" : "Novo"} atleta</h3></div><div class="card"><div class="photo-preview" id="photoPreview">${a?.photoUrl ? `<img src="${esc(a.photoUrl)}">` : "Sem foto"}</div><div class="field"><label>Fotografia de perfil</label><input id="aphoto" type="file" accept="image/*" capture="environment" onchange="previewPhoto(this)"><div class="muted">A imagem será reduzida automaticamente antes do envio.</div></div><div class="field"><label>Nome</label><input id="aname" value="${esc(a?.name || "")}"></div><div class="form2"><div class="field"><label>Escalão</label><select id="agroup"><option ${a?.group === "Benjamins" ? "selected" : ""}>Benjamins</option><option ${a?.group === "Traquinas" ? "selected" : ""}>Traquinas</option><option ${a?.group === "Traquinas/Benjamins" ? "selected" : ""}>Traquinas/Benjamins</option></select></div><div class="field"><label>Data de nascimento</label><input id="abirth" type="date" max="${new Date().toISOString().slice(0, 10)}" value="${esc(a?.birthDate || "")}"><small>Usada para calcular a idade e assinalar o aniversário na app.</small></div></div><div class="form2"><div class="field"><label>N.º equipamento vermelho</label><input id="ared" inputmode="numeric" value="${esc(a?.redNumber || "")}" placeholder="Ex.: 7"></div><div class="field"><label>N.º equipamento branco</label><input id="awhite" inputmode="numeric" value="${esc(a?.whiteNumber || "")}" placeholder="Ex.: 12"></div></div><div class="player-card-upload"><div class="section"><div><span class="section-kicker">Documento do atleta</span><h3>Cartão de jogador</h3></div></div><div class="player-card-preview" id="playerCardPreview">${a?.playerCardPhotoUrl ? `<img src="${esc(a.playerCardPhotoUrl)}" alt="Cartão de jogador">` : '<span>🪪</span><b>Ainda sem fotografia do cartão</b>'}</div>${availabilityOwner() ? '<div class="field"><label>Fotografia do cartão de jogador</label><input id="acardphoto" type="file" accept="image/*" capture="environment" onchange="previewPlayerCard(this)"><div class="muted">Fotografe o cartão completo, com boa luz e sem reflexos. Todos podem consultar; apenas o utilizador josealmanso pode carregar ou substituir.</div></div>' : '<div class="muted">Apenas o utilizador josealmanso pode carregar ou substituir esta fotografia.</div>'}</div><button class="btn btn-primary btn-block" onclick="saveAthlete('${id}')">Guardar atleta</button></div>`,
  );
}
function previewPhoto(inp) {
  const f = inp.files[0];
  if (!f) return;
  const u = URL.createObjectURL(f);
  $("photoPreview").innerHTML = `<img src="${u}">`;
}
function previewPlayerCard(inp) {
  const f = inp.files[0];
  if (!f) return;
  const u = URL.createObjectURL(f);
  $("playerCardPreview").innerHTML = `<img src="${u}" alt="Pré-visualização do cartão">`;
}
async function resizePhoto(file, maxSize = 520, quality = 0.78) {
  return new Promise((res, rej) => {
    const img = new Image(),
      u = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width,
        h = img.height,
        max = maxSize;
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
      res(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = rej;
    img.src = u;
  });
}
async function saveAthlete(id) {
  try {
    const file = $("aphoto").files[0],
      playerCardFile = $("acardphoto")?.files[0];
    let photoBase64 = "", playerCardPhotoBase64 = "";
    if (file) photoBase64 = await resizePhoto(file);
    if (playerCardFile)
      playerCardPhotoBase64 = await resizePhoto(playerCardFile, 1400, 0.86);
    await api("saveAthlete", {
      athlete: {
        id,
        name: $("aname").value.trim(),
        group: $("agroup").value,
        birthDate: $("abirth").value,
        redNumber: $("ared").value.trim(),
        whiteNumber: $("awhite").value.trim(),
      },
      photoBase64,
      playerCardPhotoBase64,
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
  return `<div class="profile-head card">${avatar(a, "avatar-xl")}<div class="grow"><h2>${esc(a.name)}</h2><div class="athlete-meta">${groupBadge(a.group)}${a.birthDate ? `<span class="birth-chip">🎂 ${fmt(a.birthDate)} · ${ageFromBirthDate(a.birthDate)} anos</span>` : ""}<span class="shirt-mini redshirt">🔴 #${esc(a.redNumber || "—")}</span><span class="shirt-mini whiteshirt">⚪ #${esc(a.whiteNumber || "—")}</span></div><div class="trend ${tr.cls}">${tr.icon} ${tr.label}</div></div>${a.playerCardPhotoUrl ? `<a class="btn btn-small btn-secondary" href="${esc(a.playerCardPhotoUrl)}" target="_blank" rel="noopener">🪪 Ver cartão</a>` : ""}<button class="btn btn-small btn-secondary" onclick="openSafety('${a.id}')">🛡️ Segurança</button><button class="btn btn-small btn-secondary" onclick="printAthleteReport('${a.id}')">📄 PDF</button></div>
 <div class="card traffic-detail ${light.cls}"><strong>${light.icon} ${light.label}</strong><div>${light.reasons.map(esc).join(" · ")}</div></div><div class="grid profile-kpis"><div class="card kpi"><span>Assiduidade</span><strong>${attendancePct(a.id)}%</strong></div><div class="card kpi"><span>Empenho</span><strong>${avg(a.id, "effort").toFixed(1)}</strong></div><div class="card kpi"><span>Atitude</span><strong>${avg(a.id, "attitude").toFixed(1)}</strong></div><div class="card kpi"><span>Comportamento</span><strong>${avg(a.id, "behavior").toFixed(1)}</strong></div><div class="card kpi"><span>Treinos</span><strong>${r.length}</strong></div><div class="card kpi"><span>Convocatórias</span><strong>${calls.length}</strong></div></div>
 ${athleteDevelopmentPanel(a, r)}
 <div class="section"><h3>Evolução treino a treino</h3></div>${evolutionBars(a.id)}
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
         `<div class="card history-row rich-history"><div class="history-date"><strong>${fmt(trainingDate(x.trainingId))}</strong><div class="muted">${esc(x.status)}${x.absenceReason ? ` · ${esc(x.absenceReason)}` : ""}</div></div><div class="grow"><p class="training-narrative">${esc(trainingNarrative(x))}</p>${x.note ? `<small class="coach-note"><b>Observação registada:</b> ${esc(x.note)}</small>` : ""}${x.tags?.length ? `<div class="history-tags">${x.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}</div>${x.status === "Presente" ? `<div class="mini-score">A ${x.attitude} · E ${x.effort} · C ${x.behavior}</div>` : ""}</div>`,
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
function athleteDevelopmentPanel(athlete, records) {
  const present = records.filter((r) => r.status === "Presente"),
    recent = present.slice(0, 4),
    previous = present.slice(4, 8),
    dimensions = [
      ["Atitude", "attitude", "Disponibilidade e resposta ao treino"],
      ["Empenho", "effort", "Entrega e intensidade demonstradas"],
      ["Comportamento", "behavior", "Respeito, foco e integração"],
    ],
    mean = (rows, key) =>
      rows.length
        ? rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) /
          rows.length
        : 0,
    metrics = dimensions.map(([label, key, help]) => {
      const current = mean(recent, key),
        before = mean(previous, key),
        delta = previous.length ? current - before : 0;
      return { label, key, help, current, delta };
    }),
    ordered = metrics.slice().sort((a, b) => b.current - a.current),
    strength = ordered[0],
    focus = ordered[ordered.length - 1],
    overall = recent.length
      ? metrics.reduce((sum, item) => sum + item.current, 0) / metrics.length
      : 0,
    values = recent.map(
      (r) =>
        (Number(r.attitude) + Number(r.effort) + Number(r.behavior)) / 3,
    ),
    variance = values.length
      ? values.reduce((sum, value) => sum + Math.pow(value - overall, 2), 0) /
        values.length
      : 0,
    consistency =
      values.length < 2
        ? "Em observação"
        : Math.sqrt(variance) <= 0.35
          ? "Muito consistente"
          : Math.sqrt(variance) <= 0.7
            ? "Consistente"
            : "Oscilante",
    recentAttendanceRows = records.slice(0, 5),
    recentAttendance = recentAttendanceRows.length
      ? Math.round(
          (recentAttendanceRows.filter((r) => r.status === "Presente").length /
            recentAttendanceRows.length) *
            100,
        )
      : 0,
    evolution =
      previous.length && metrics.some((m) => m.delta > 0.25)
        ? `Nos treinos mais recentes, ${athlete.name} apresenta progressos sobretudo em ${metrics.filter((m) => m.delta > 0.25).map((m) => m.label.toLowerCase()).join(" e ")}.`
        : previous.length && metrics.some((m) => m.delta < -0.25)
          ? `Os registos recentes aconselham acompanhamento mais próximo em ${metrics.filter((m) => m.delta < -0.25).map((m) => m.label.toLowerCase()).join(" e ")}.`
          : `${athlete.name} mantém uma evolução global estável nos registos mais recentes.`;
  if (!present.length)
    return '<div class="section"><h3>Análise de desenvolvimento</h3></div><div class="card empty">Ainda não existem presenças suficientes para construir a análise.</div>';
  return `<div class="section"><div><h3>Análise de desenvolvimento</h3><div class="muted">Últimos ${recent.length} treinos com presença, comparados com o período anterior</div></div></div><div class="development-overview"><div class="card development-story"><span>Leitura atual</span><h4>${esc(evolution)}</h4><p><b>Ponto forte:</b> ${esc(strength.label)} — ${esc(strength.help.toLowerCase())}.</p><p><b>Próximo foco:</b> continuar a desenvolver ${esc(focus.label.toLowerCase())}, mantendo uma abordagem positiva e progressiva.</p></div><div class="card development-facts"><div><span>Índice recente</span><strong>${overall.toFixed(1)}<small>/5</small></strong></div><div><span>Consistência</span><strong>${esc(consistency)}</strong></div><div><span>Assiduidade recente</span><strong>${recentAttendance}%</strong></div></div></div><div class="development-dimensions">${metrics.map((m) => `<div class="card development-dimension"><div><strong>${esc(m.label)}</strong><span class="dimension-trend ${m.delta > 0.2 ? "up" : m.delta < -0.2 ? "down" : "neutral"}">${m.delta > 0.2 ? "↑ Em evolução" : m.delta < -0.2 ? "↓ A acompanhar" : "→ Estável"}</span></div><div class="dimension-track"><i style="width:${Math.max(0, Math.min(100, (m.current / 5) * 100))}%"></i></div><small>${esc(m.help)} · ${m.current.toFixed(1)}/5${previous.length ? ` · ${m.delta >= 0 ? "+" : ""}${m.delta.toFixed(1)} face ao período anterior` : ""}</small></div>`).join("")}</div>`;
}
function evolutionBars(id) {
  const rs = recentRecords(id, 8)
    .reverse()
    .filter((r) => r.status === "Presente");
  if (!rs.length) return '<div class="card empty">Sem dados suficientes.</div>';
  const dimensions = [
      { key: "attitude", label: "Atitude", cls: "attitude" },
      { key: "effort", label: "Empenho", cls: "effort" },
      { key: "behavior", label: "Comportamento", cls: "behavior" },
    ],
    x = (index) =>
      rs.length === 1 ? 400 : 70 + index * (660 / (rs.length - 1)),
    y = (value) => 210 - ((Math.max(1, Math.min(5, value)) - 1) / 4) * 160,
    grid = [5, 4, 3, 2, 1]
      .map(
        (value) =>
          `<line x1="55" y1="${y(value)}" x2="745" y2="${y(value)}"></line><text x="32" y="${y(value) + 5}">${value}</text>`,
      )
      .join(""),
    lines = dimensions
      .map((dimension) => {
        const points = rs
          .map(
            (record, index) =>
              `${x(index)},${y(Number(record[dimension.key]) || 1)}`,
          )
          .join(" "),
          circles = rs
            .map(
              (record, index) =>
                `<circle cx="${x(index)}" cy="${y(Number(record[dimension.key]) || 1)}" r="6"><title>${dimension.label}: ${Number(record[dimension.key]).toFixed(1)} · ${fmt(trainingDate(record.trainingId))}</title></circle>`,
            )
            .join("");
        return `<g class="trend-series ${dimension.cls}"><polyline points="${points}"></polyline>${circles}</g>`;
      })
      .join(""),
    dates = rs
      .map(
        (record, index) =>
          `<text class="trend-date" x="${x(index)}" y="240">${fmt(trainingDate(record.trainingId)).slice(0, 5)}</text>`,
      )
      .join("");
  return `<div class="card trend-chart-card"><div class="trend-legend">${dimensions.map((dimension) => `<span class="${dimension.cls}"><i></i>${dimension.label}</span>`).join("")}</div><div class="trend-chart-scroll"><svg class="trend-chart" viewBox="0 0 800 255" role="img" aria-label="Evolução de atitude, empenho e comportamento por treino"><g class="trend-grid">${grid}</g>${lines}${dates}</svg></div><div class="trend-chart-note">Cada ponto corresponde à avaliação registada num treino. A escala vai de 1 a 5.</div></div>`;
}

function training() {
  if (!draft)
    return `<div class="section"><h3>Registo Express</h3><span class="pill red">⚡ Rápido</span></div><div class="card"><div class="field"><label>Escalão</label><select id="tg"><option>Benjamins</option><option>Traquinas</option><option>Todos</option></select></div><div class="muted" style="margin-bottom:11px">Todos começam como <b>Presentes · 4/4/4</b>. Altera só as exceções.</div><button class="btn btn-primary btn-block" onclick="startTraining()">⚡ Iniciar treino</button></div><div class="section"><h3>Treinos recentes</h3><button class="btn btn-small btn-ghost" onclick="go('calendar')">Ver todos</button></div><div class="list">${recentTrainingCards(5)}</div>`;
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
  }<div class="list">${people.map(trainingCard).join("")}</div><div class="sticky-save"><button class="btn btn-primary btn-block" onclick="saveTraining()" ${savingTraining ? "disabled" : ""}>${savingTraining ? "A guardar treino…" : `Guardar treino · ${c.p} presentes`}</button></div>`;
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
  "⚽ Qualidade técnica",
  "🧠 Tomada de decisão",
  "📍 Posicionamento",
  "🦶 Passe e receção",
  "🎯 Finalização",
  "🔄 Transição",
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
  if (savingTraining) return;
  try {
    const duplicate = state.trainings.find(
      (t) => t.date === draft.date && t.group === draft.group,
    );
    if (
      duplicate &&
      !confirm(
        `Já existe um treino de ${draft.group} registado em ${fmt(draft.date)}. Queres mesmo guardar outro?`,
      )
    )
      return;
    savingTraining = true;
    render();
    const result = await api("saveTraining", {
      training: {
        id: draft.id,
        date: draft.date,
        time: draft.time,
        group: draft.group,
      },
      records: trainingPeople().map((a) => ({
        id: `r_${draft.id}_${a.id}`,
        athleteId: a.id,
        ...rec(a.id),
      })),
    });
    if (result.training) {
      state.trainings = [
        ...state.trainings.filter((t) => t.id !== result.training.id),
        result.training,
      ];
    }
    if (result.savedRecords) {
      const savedIds = new Set(result.savedRecords.map((r) => r.id));
      const athleteKeys = new Set(
        result.savedRecords.map((r) => r.trainingId + "|" + r.athleteId),
      );
      state.records = state.records
        .filter(
          (r) =>
            !savedIds.has(r.id) &&
            !athleteKeys.has(r.trainingId + "|" + r.athleteId),
        )
        .concat(result.savedRecords);
    }
    generateTrainingNarratives(result.training?.id || draft.id);
    draft = null;
    savingTraining = false;
    view = "dashboard";
    render();
    toast("Treino guardado");
  } catch (e) {
    savingTraining = false;
    render();
    toast(e.message);
  }
}
async function generateTrainingNarratives(trainingId) {
  try {
    const result = await api("generateTrainingSummaries", { trainingId });
    if (!result.summaries) return;
    const ids = new Set(result.summaries.map((x) => x.id));
    state.trainingSummaries = (state.trainingSummaries || [])
      .filter((x) => !ids.has(x.id))
      .concat(result.summaries);
    if (
      view === "trainingSummary" ||
      view === "athleteProfile" ||
      view === "parentHome"
    )
      render();
  } catch (_) {}
}
async function ensureExistingTrainingNarratives(trainingIds) {
  const existing = new Set(
      (state.trainingSummaries || [])
        .filter((x) => x.version === "2")
        .map((x) => x.trainingId),
    ),
    missing = [...new Set(trainingIds)]
      .filter(
        (id) =>
          id && !existing.has(id) && !narrativeGenerationQueue.has(id),
      )
      .slice(0, 6);
  for (const id of missing) {
    narrativeGenerationQueue.add(id);
    await generateTrainingNarratives(id);
    narrativeGenerationQueue.delete(id);
  }
}
function trainingNarrative(record) {
  const saved = (state.trainingSummaries || []).find(
    (x) =>
      x.trainingId === record.trainingId &&
      x.athleteId === record.athleteId &&
      x.version === "2",
  );
  if (saved?.text) return saved.text;
  if (record.status !== "Presente")
    return record.status === "Justificada"
      ? `A ausência deste treino ficou justificada${record.absenceReason ? `: ${record.absenceReason}` : "."}`
      : `Não esteve presente neste treino${record.absenceReason ? `: ${record.absenceReason}` : "."}`;
  const qualities = [];
  if (Number(record.effort) >= 4)
    qualities.push("boa intensidade e compromisso nas tarefas");
  if (Number(record.attitude) >= 4)
    qualities.push("disponibilidade para executar e receber correções");
  if (Number(record.behavior) >= 4)
    qualities.push("concentração e integração positiva no trabalho coletivo");
  return qualities.length
    ? `Na sessão apresentou ${qualities.join(", ")}. A análise técnico-tática detalhada está a ser preparada automaticamente a partir dos indicadores assinalados.`
    : "Participou na sessão com uma resposta global regular. A análise técnico-tática detalhada está a ser preparada automaticamente a partir do registo da equipa técnica.";
}

function recentTrainingCards(limit = 20) {
  return (
    [...state.trainings]
      .sort((a, b) =>
        String(b.date + b.time).localeCompare(String(a.date + a.time)),
      )
      .slice(0, limit)
      .map((t) => trainingHistoryCard(t))
      .join("") || '<div class="card empty">Ainda sem treinos registados.</div>'
  );
}
function trainingHistoryCard(t) {
  const records = state.records.filter((r) => r.trainingId === t.id),
    present = records.filter((r) => r.status === "Presente").length;
  return `<div class="card training-history-card" onclick="openTrainingSummary('${t.id}')"><div><strong>⚽ ${fmt(t.date)} · ${esc(t.time || "")}</strong><div class="muted">${esc(t.group)} · ${present}/${records.length} presentes</div></div><span class="open-chevron">›</span></div>`;
}
function openTrainingSummary(id) {
  if (!state.trainings.some((t) => t.id === id)) return;
  selectedTrainingId = id;
  view = "trainingSummary";
  render();
  ensureExistingTrainingNarratives([id]);
}
function trainingSummary() {
  const t = state.trainings.find((x) => x.id === selectedTrainingId);
  if (!t) return '<div class="card empty">Treino não encontrado.</div>';
  const records = state.records.filter((r) => r.trainingId === t.id),
    present = records.filter((r) => r.status === "Presente"),
    absent = records.filter((r) => r.status === "Falta"),
    justified = records.filter((r) => r.status === "Justificada"),
    average = (key) =>
      present.length
        ? (
            present.reduce((sum, r) => sum + Number(r[key] || 0), 0) /
            present.length
          ).toFixed(1)
        : "—";
  return `<div class="section"><div><h3>Resumo do treino</h3><div class="muted">${fmt(t.date)} · ${esc(t.time || "Hora não indicada")} · ${esc(t.group)}</div></div>${admin() ? `<button class="btn btn-danger" onclick="deleteTraining('${t.id}')">Eliminar treino</button>` : ""}</div><div class="training-summary-kpis"><div class="card"><span>Presentes</span><strong>${present.length}</strong></div><div class="card"><span>Faltas</span><strong>${absent.length}</strong></div><div class="card"><span>Justificadas</span><strong>${justified.length}</strong></div><div class="card"><span>Assiduidade</span><strong>${records.length ? Math.round((present.length / records.length) * 100) : 0}%</strong></div></div><div class="card training-averages"><span>Atitude <b>${average("attitude")}</b></span><span>Empenho <b>${average("effort")}</b></span><span>Comportamento <b>${average("behavior")}</b></span></div><div class="section"><h3>Atletas</h3></div><div class="list">${
    records
      .map((r) => {
        const a = state.athletes.find((x) => x.id === r.athleteId);
        return `<div class="card training-summary-row">${a ? avatar(a) : ""}<div class="grow"><div class="absence-name"><strong>${esc(a?.name || "Atleta removido")}</strong>${a ? groupBadge(a.group) : ""}</div><div class="muted">${esc(r.status)}${r.absenceReason ? ` · ${esc(r.absenceReason)}` : ""}</div><p class="training-narrative">${esc(trainingNarrative(r))}</p>${r.note ? `<small class="coach-note"><b>Observação registada:</b> ${esc(r.note)}</small>` : ""}${r.tags?.length ? `<div class="history-tags">${r.tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}</div>${r.status === "Presente" ? `<div class="mini-score">A ${r.attitude} · E ${r.effort} · C ${r.behavior}</div>` : ""}</div>`;
      })
      .join("") ||
    '<div class="card empty">Este treino não tem registos de atletas.</div>'
  }</div>`;
}
async function deleteTraining(id) {
  if (
    !admin() ||
    !confirm(
      "Eliminar este treino? As presenças, avaliações, observações e tags deste treino também serão eliminadas. Esta ação não pode ser anulada.",
    )
  )
    return;
  try {
    await api("deleteTraining", { id });
    await refresh();
    selectedTrainingId = null;
    view = "calendar";
    render();
    toast("Treino duplicado eliminado");
  } catch (e) {
    toast(e.message);
  }
}

function buildAlerts(group = "") {
  const alerts = [];
  state.athletes
    .filter(
      (a) =>
        a.active &&
        (!group || a.group === group || a.group === "Traquinas/Benjamins"),
    )
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
  const group = dashboardGroup,
    aa = state.athletes.filter(
      (a) =>
        a.active &&
        (a.group === group || a.group === "Traquinas/Benjamins"),
    ),
    groupTrainings = state.trainings.filter(
      (t) => t.group === group || t.group === "Todos",
    ),
    rank = aa
      .map((a) => ({ ...a, score: score(a) }))
      .sort((a, b) => b.score - a.score),
    alerts = buildAlerts(group),
    hi = monthlyHighlights(group);
  return `<div class="section dashboard-heading"><div><h3>Dashboard técnico</h3><div class="muted">Análise independente por escalão</div></div><div class="dashboard-group-tabs"><button class="${group === "Traquinas" ? "active" : ""}" onclick="dashboardGroup='Traquinas';render()">Traquinas</button><button class="${group === "Benjamins" ? "active" : ""}" onclick="dashboardGroup='Benjamins';render()">Benjamins</button></div></div><div class="dashboard-group-banner ${group.toLowerCase()}"><span>Escalão</span><strong>${esc(group)}</strong></div><div class="grid"><div class="card kpi"><span>Atletas</span><strong>${aa.length}</strong></div><div class="card kpi"><span>Treinos</span><strong>${groupTrainings.length}</strong></div><div class="card kpi"><span>Assiduidade média</span><strong>${aa.length ? Math.round(aa.reduce((s, a) => s + attendancePct(a.id), 0) / aa.length) : 0}%</strong></div><div class="card kpi"><span>Empenho médio</span><strong>${aa.length ? (aa.reduce((s, a) => s + avg(a.id, "effort"), 0) / aa.length).toFixed(1) : "0.0"}</strong></div></div>
 <div class="section"><h3>Destaques do mês</h3></div>${hi}
 <div class="section"><h3>Alertas e tendências</h3></div><div class="list">${alerts.map((a) => `<div class="card insight ${a.level}"><strong>${a.icon} ${esc(a.title)}</strong><div class="muted">${esc(a.text)}</div></div>`).join("") || '<div class="card empty">Sem alertas relevantes.</div>'}</div>
 <div class="section"><h3>Índice de treino</h3></div><div class="list">${rank.map((a, i) => `<div class="card rank clickable" onclick="openAthlete('${a.id}')"><div class="rankno">${i + 1}</div>${avatar(a)}<div class="grow"><strong>${esc(a.name)}</strong><div class="muted">${attendancePct(a.id)}% presença · Empenho ${avg(a.id, "effort").toFixed(1)}</div><div class="bar"><i style="width:${a.score}%"></i></div></div><div class="score">${a.score}</div></div>`).join("")}</div>`;
}
function monthlyHighlights(group = "") {
  const now = new Date(),
    mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const tids = new Set(
    state.trainings
      .filter(
        (t) =>
          monthKey(t.date) === mk &&
          (!group || t.group === group || t.group === "Todos"),
      )
      .map((t) => t.id),
  );
  const rr = state.records.filter(
    (r) => tids.has(r.trainingId) && r.status === "Presente",
  );
  if (!rr.length)
    return '<div class="card empty">Ainda sem dados suficientes neste mês.</div>';
  const aa = state.athletes.filter(
    (a) =>
      a.active &&
      (!group || a.group === group || a.group === "Traquinas/Benjamins"),
  );
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
        equipment: g.equipment,
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
  const groups = (
    e.group === "Todos" ? ["Traquinas", "Benjamins"] : [e.group]
  ).filter(
    (group) =>
      user?.role !== "parent" ||
      (state.availabilityRequests || []).some(
        (r) => r.eventId === e.id && r.group === group && r.status === "Aberto",
      ),
  );
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
  const trainingAction =
    e.source === "training"
      ? `<button class="btn btn-small btn-secondary" onclick="openTrainingSummary('${e.sourceId}')">Ver resumo</button>`
      : "";
  return `<div class="card event-row"><div class="event-date"><b>${new Date(e.date + "T12:00:00").getDate()}</b><span>${new Date(e.date + "T12:00:00").toLocaleDateString("pt-PT", { month: "short" }).toUpperCase()}</span></div><div class="grow"><strong>${icons[e.type] || "📌"} ${esc(e.title)}</strong><div class="muted">${esc(e.time || "Hora por definir")}${e.group ? ` · ${esc(e.group)}` : ""}${e.location ? ` · ${esc(e.location)}` : ""}</div>${gameActions}</div>${trainingAction}${admin() && e.source === "manual" ? `<button class="btn btn-small btn-danger" onclick="deleteEvent('${e.id}')">Eliminar</button>` : ""}</div>`;
}
function calendar() {
  const filter = $("eventFilter")?.value || "Todos",
    ee = allEvents().filter((e) => filter === "Todos" || e.type === filter);
  return `<div class="section"><h3>Calendário da formação</h3>${admin() ? '<button class="btn btn-primary" onclick="eventForm()">+ Evento</button>' : ""}</div><div class="card"><div class="field"><label>Mostrar</label><select id="eventFilter" onchange="render()">${["Todos", "Treino", "Jogo", "Torneio", "Outro"].map((x) => `<option ${x === filter ? "selected" : ""}>${x}</option>`).join("")}</select></div></div><div class="list calendar-list">${ee.map(eventCard).join("") || '<div class="card empty">Sem eventos.</div>'}</div>`;
}
function eventForm() {
  if (!admin()) return;
  eventDraft = null;
  view = "eventForm";
  render();
}
function editMatchEvent(id) {
  if (!availabilityOwner()) return toast("Apenas o utilizador josealmanso pode editar este evento.");
  const e = allEvents().find((x) => x.id === id);
  if (!e || e.source === "training") return toast("Este evento não pode ser editado aqui.");
  const game = e.source === "game" ? state.games.find((g) => g.id === e.sourceId) : null;
  eventDraft = {
    ...e,
    title: game?.opponent || e.title,
    equipment: e.equipment || game?.equipment || "",
    returnView: "matchDay",
  };
  view = "eventForm";
  render();
}
function eventFormView() {
  const e = eventDraft || {}, editing = !!eventDraft, isGame = e.source === "game";
  return `<div class="section"><div><h3>${editing ? "Editar evento" : "Novo evento"}</h3>${editing ? '<div class="muted">As alterações ficam visíveis no calendário, nas disponibilidades e no Modo Dia de Jogo.</div>' : ""}</div></div><div class="card"><div class="field"><label>Tipo</label><select id="et" ${isGame ? "disabled" : ""}>${["Torneio", "Outro", "Treino", "Jogo"].map((x) => `<option ${x === (e.type || "Torneio") ? "selected" : ""}>${x}</option>`).join("")}</select></div><div class="field"><label>${isGame ? "Adversário" : "Título"}</label><input id="en" value="${esc(e.title || "")}"></div><div class="form2"><div class="field"><label>Data</label><input id="ed" type="date" value="${esc(e.date || "")}"></div><div class="field"><label>Hora</label><input id="eh" type="time" value="${esc(e.time || "")}"></div></div><div class="form2"><div class="field"><label>Escalão</label><select id="eg" ${editing ? "disabled" : ""}>${["Todos", "Benjamins", "Traquinas"].map((x) => `<option ${x === (e.group || "Todos") ? "selected" : ""}>${x}</option>`).join("")}</select></div><div class="field"><label>Local</label><input id="el" value="${esc(e.location || "")}" placeholder="Ex.: Faro do Alentejo"></div></div><div class="field"><label>Equipamento</label><select id="ee"><option value="" ${!e.equipment ? "selected" : ""}>Por definir</option><option ${e.equipment === "Vermelho" ? "selected" : ""}>Vermelho</option><option ${e.equipment === "Branco" ? "selected" : ""}>Branco</option></select><small>O equipamento escolhido aparece no Modo Dia de Jogo e no calendário.</small></div>${isGame ? "" : `<div class="field"><label>Observação</label><textarea id="eo">${esc(e.note || "")}</textarea></div>`}<button class="btn btn-primary btn-block" onclick="saveEvent()">${editing ? "Guardar alterações" : "Guardar evento"}</button></div>`;
}
async function saveEvent() {
  try {
    const previous = eventDraft,
      payload = {
        id: previous?.id || "",
        source: previous?.source || "manual",
        sourceId: previous?.sourceId || "",
        type: $("et").value,
        title: $("en").value.trim(),
        date: $("ed").value,
        time: $("eh").value,
        group: $("eg").value,
        location: $("el").value.trim(),
        equipment: $("ee").value,
        note: $("eo")?.value.trim() || previous?.note || "",
      };
    const result = await api("saveEvent", { event: payload });
    if (payload.source === "game") {
      const game = state.games.find((g) => g.id === payload.sourceId);
      if (game) Object.assign(game, { opponent: payload.title, date: payload.date, time: payload.time, location: payload.location, equipment: payload.equipment });
    } else {
      const updated = { ...payload, id: result.id, source: "manual", sourceId: "" },
        index = state.events.findIndex((x) => x.id === result.id);
      if (index >= 0) state.events[index] = updated;
      else state.events.push(updated);
    }
    state.gameAvailability.filter((x) => x.eventId === payload.id).forEach((x) => x.eventDate = payload.date);
    const returnView = previous?.returnView || "calendar";
    eventDraft = null;
    refresh();
    view = returnView;
    render();
    toast(previous ? "Evento atualizado" : "Evento guardado");
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
  availabilityShareMessage = "";
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
  const request = (state.availabilityRequests || []).find(
    (r) => r.eventId === event.id && r.group === group && r.status === "Aberto",
  );
  return `<div class="section"><div><h3>Disponibilidade</h3><div class="muted">${esc(event.title)} · ${fmt(event.date)} · ${esc(group)}</div></div>${event.group === "Todos" && user?.role !== "parent" ? `<select onchange="openAvailability('${event.id}',this.value)"><option ${group === "Traquinas" ? "selected" : ""}>Traquinas</option><option ${group === "Benjamins" ? "selected" : ""}>Benjamins</option></select>` : ""}</div>${availabilityOwner() ? `<div class="card availability-opening"><div class="field"><label>Prazo para os pais responderem</label><input id="availabilityDeadline" type="date" min="${new Date().toISOString().slice(0, 10)}" value="${request?.deadline || event.date}"></div><button class="btn btn-primary" onclick="openAvailabilityRequest()">${request ? "Atualizar pedido" : "Abrir pedido"}</button>${request ? `<button class="btn btn-danger" onclick="deleteAvailabilityRequest('${request.id}')">Apagar pedido</button>` : ""}</div>${availabilityShareMessage ? `<div class="card availability-message"><strong>Mensagem pronta para o grupo dos pais</strong><textarea id="availabilityShareText" readonly>${esc(availabilityShareMessage)}</textarea><div class="form2"><button class="btn btn-secondary" onclick="copyAvailabilityMessage()">📋 Copiar mensagem</button><button class="btn btn-primary" onclick="shareAvailabilityWhatsApp()">💬 Abrir WhatsApp</button></div></div>` : ""}` : request ? `<div class="admin-note">Pedido aberto até ${fmt(request.deadline)}. Apenas josealmanso pode alterá-lo ou apagá-lo.</div>` : ""}<div class="availability-summary"><div class="card available"><span>Disponíveis</span><strong>${available}</strong></div><div class="card unavailable"><span>Indisponíveis</span><strong>${unavailable}</strong></div><div class="card no-answer"><span>Sem resposta</span><strong>${noAnswer}</strong></div><div class="card total"><span>Total</span><strong>${athletes.length}</strong></div></div>${user?.role === "parent" ? "" : `<div class="availability-toolbar"><button class="btn btn-small btn-secondary" onclick="setAllAvailability('Disponível')">Todos disponíveis</button><button class="btn btn-small btn-ghost" onclick="setAllAvailability('Sem resposta')">Limpar respostas</button></div>`}<div class="list">${athletes
    .map((a) => {
      const row = availabilityDraft.rows[a.id];
      return `<div class="card availability-row ${row.status.replace(" ", "-").toLowerCase()}">${avatar(a)}<div class="grow"><div class="absence-name"><strong>${esc(a.name)}</strong>${groupBadge(a.group)}</div><div class="availability-buttons">${["Disponível", "Indisponível", "Sem resposta"].map((s) => `<button class="${row.status === s ? "active" : ""}" onclick="setAvailability('${a.id}','${s}')">${availabilityIcon(s)} ${s}</button>`).join("")}</div><input class="availability-note" value="${esc(row.note)}" placeholder="Observação opcional" onchange="availabilityDraft.rows['${a.id}'].note=this.value"></div></div>`;
    })
    .join(
      "",
    )}</div><div class="sticky-save availability-save"><button class="btn btn-primary" onclick="saveAvailability()">${user?.role === "parent" ? "Confirmar resposta" : "Guardar disponibilidade"}</button>${user?.role === "parent" ? "" : '<button class="btn btn-primary" onclick="saveAvailability(true)">Guardar e preparar convocatória</button>'}</div>`;
}
async function openAvailabilityRequest() {
  try {
    const event = availabilityDraft.event,
      group = availabilityDraft.group,
      deadline = $("availabilityDeadline").value;
    await api("saveAvailabilityRequest", {
      eventId: event.id,
      group,
      deadline,
    });
    await refresh();
    const link = `${location.origin}${location.pathname}?portal=pais`,
      message = `⚽ GDR Formação 360\n\nEstá aberta a confirmação de disponibilidade para ${event.title}, no dia ${fmt(event.date)}${event.time ? ` às ${event.time}` : ""}, escalão ${group}.\n\nPor favor, respondam até ${fmt(deadline)} através do Portal dos Pais:\n${link}`;
    availabilityShareMessage = message;
    toast("Pedido aberto — mensagem pronta");
    render();
  } catch (e) {
    toast(e.message);
  }
}
async function deleteAvailabilityRequest(id) {
  if (
    !availabilityOwner() ||
    !confirm(
      "Apagar este pedido? As respostas de disponibilidade deste escalão também serão eliminadas.",
    )
  )
    return;
  try {
    await api("deleteAvailabilityRequest", { id });
    const eventId = availabilityDraft.event.id,
      group = availabilityDraft.group;
    state.availabilityRequests = (state.availabilityRequests || []).filter(
      (r) => r.id !== id,
    );
    state.gameAvailability = (state.gameAvailability || []).filter(
      (r) => !(r.eventId === eventId && r.group === group),
    );
    await refresh();
    availabilityShareMessage = "";
    openAvailability(eventId, group);
    toast("Pedido de disponibilidade apagado");
  } catch (e) {
    toast(e.message);
  }
}
async function copyAvailabilityMessage() {
  const field = $("availabilityShareText");
  if (!field) return;
  try {
    if (navigator.clipboard && window.isSecureContext)
      await navigator.clipboard.writeText(field.value);
    else {
      field.focus();
      field.select();
      document.execCommand("copy");
    }
    toast("Mensagem copiada");
  } catch (e) {
    field.focus();
    field.select();
    toast("Selecionámos a mensagem — mantém premido e escolhe Copiar");
  }
}
function shareAvailabilityWhatsApp() {
  const field = $("availabilityShareText");
  if (!field) return;
  window.open(
    `https://wa.me/?text=${encodeURIComponent(field.value)}`,
    "_blank",
  );
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
    const savedKeys = new Set(
      availability.map((x) => event.id + "|" + group + "|" + x.athleteId),
    );
    state.gameAvailability = (state.gameAvailability || [])
      .filter(
        (x) =>
          !savedKeys.has(x.eventId + "|" + x.group + "|" + x.athleteId),
      )
      .concat(
        availability.map((x) => ({
          id: "local_" + event.id + "_" + x.athleteId,
          eventId: event.id,
          gameId,
          athleteId: x.athleteId,
          group,
          eventDate: event.date,
          status: x.status,
          note: x.note || "",
          updatedAt: new Date().toISOString(),
        })),
      );
    await refresh();
    toast("Disponibilidade guardada");
    if (prepare) prepareCallupForEvent(event.id, group);
    else {
      view = user?.role === "parent" ? "parentHome" : "calendar";
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
  if (!availabilityOwner()) return "";
  return `<div class="section"><h3>Utilizadores e famílias</h3><button class="btn btn-primary" onclick="userForm()">+ Adicionar</button></div><div class="list">${state.users
    .map(
      (u) =>
        `<div class="card athlete"><div class="avatar">${u.role === "admin" ? "A" : u.role === "parent" ? "P" : "T"}</div><div class="grow"><strong>${esc(u.name)}</strong><div class="muted">@${esc(u.username)} · ${u.role === "parent" ? "Pai/Mãe" : u.role} · ${u.active ? "Ativo" : "Inativo"}</div>${
          u.role === "parent"
            ? `<div class="muted">${
                (u.athleteIds || [])
                  .map((id) => state.athletes.find((a) => a.id === id)?.name)
                  .filter(Boolean)
                  .map(esc)
                  .join(" · ") || "Sem filhos associados"
              }</div>`
            : ""
        }</div>${availabilityOwner() ? `<div class="actions"><button class="btn btn-small btn-ghost" onclick="userForm('${u.id}')">Editar</button><button class="btn btn-small btn-danger" onclick="toggleUser('${u.id}',${!u.active})">${u.active ? "Desativar" : "Ativar"}</button>${u.id !== user.id ? `<button class="btn btn-small btn-danger" onclick="deleteUser('${u.id}')">Eliminar</button>` : ""}</div>` : ""}</div>`,
    )
    .join("")}</div>`;
}
function userForm(id = "") {
  if (!availabilityOwner()) return;
  const u = id ? state.users.find((x) => x.id === id) : null;
  view = "userForm";
  $("app").innerHTML = shell(
    `<div class="section"><h3>${u ? "Editar" : "Novo"} utilizador</h3></div><div class="card"><div class="field"><label>Nome</label><input id="un" value="${esc(u?.name || "")}"></div><div class="field"><label>Utilizador</label><input id="uu" value="${esc(u?.username || "")}"></div><div class="field"><label>PIN ${u ? "(deixa vazio para manter)" : ""}</label><input id="up" type="password" inputmode="numeric"></div><div class="field"><label>Perfil</label><select id="ur" onchange="$('parentFields').style.display=this.value==='parent'?'block':'none'"><option value="treinador" ${u?.role === "treinador" ? "selected" : ""}>Treinador</option><option value="parent" ${u?.role === "parent" ? "selected" : ""}>Pai/Mãe</option><option value="admin" ${u?.role === "admin" ? "selected" : ""}>Administrador</option></select></div><div id="parentFields" style="display:${u?.role === "parent" ? "block" : "none"}"><div class="field"><label>Telefone</label><input id="uph" value="${esc(u?.phone || "")}" placeholder="+351..."></div><label>Filhos associados</label><div class="parent-athletes">${sortName(
      state.athletes.filter((a) => a.active),
    )
      .map(
        (a) =>
          `<label><input type="checkbox" name="parentAthlete" value="${a.id}" ${(u?.athleteIds || []).includes(a.id) ? "checked" : ""}> ${esc(a.name)} · ${esc(a.group)}</label>`,
      )
      .join(
        "",
      )}</div></div><button class="btn btn-primary btn-block" onclick="saveUser('${id}')">Guardar</button></div>`,
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
        phone: $("uph")?.value.trim() || "",
        athleteIds: [
          ...document.querySelectorAll('input[name="parentAthlete"]:checked'),
        ].map((x) => x.value),
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
async function deleteUser(id) {
  if (!availabilityOwner() || id === user.id) return;
  const name = state.users.find((item) => item.id === id)?.name || "selecionado";
  if (!confirm(`Eliminar definitivamente o utilizador ${name}?\n\nEsta ação retira o acesso à app, mas não elimina atletas nem registos.`)) return;
  try {
    await api("deleteUser", { id });
    state.users = state.users.filter((item) => item.id !== id);
    rememberData();
    render();
    toast("Utilizador eliminado");
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
  if (dataLoading && !hasLoadedRemoteData)
    b = '<section class="signed-in-loading"><div class="signed-in-mark">✓</div><h2>Entrada concluída</h2><p>Estamos a atualizar a informação mais recente.</p><div class="signed-in-pulse"><i></i><i></i><i></i></div></section>';
  else if (view === "home") b = home();
  else if (view === "parentHome") b = parentHome();
  else if (view === "athletes") b = athletes();
  else if (view === "athleteProfile") b = athleteProfile();
  else if (view === "safety") b = safetyView();
  else if (view === "training") b = training();
  else if (view === "trainingSummary") b = trainingSummary();
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
  else if (view === "announcements") b = announcementsView();
  else if (view === "announcementDetail") b = announcementDetailView();
  else if (view === "announcementForm") b = announcementFormView();
  else if (view === "notifications") b = notificationsView();
  else if (view === "matchDay") b = matchDay();
  else return;
  $("app").innerHTML = shell(b);
}
(async () => {
  if (user && token) {
    restoreCachedData();
    if (user?.role === "parent") view = "parentHome";
    dataLoading = true;
    render();
    loadData(sessionEpoch)
      .then(() => render())
      .catch((e) => {
        if (!hasLoadedRemoteData) logout();
        else toast(e.message);
      })
      .finally(() => {
        dataLoading = false;
        render();
      });
    return;
  }
  render();
})();
setInterval(checkForUpdates, 120000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkForUpdates();
});
if ("serviceWorker" in navigator)
  addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {}),
  );
