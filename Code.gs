/** GDR Formação 360 — backend v12.2. */
const VERSION = "12.2.0",
  FEE_AMOUNT = 10,
  FEE_START_MONTH = "2026-10",
  FEE_DUE_DAY = 8,
  SESSION_HOURS = 72;
const SHEETS = {
  USERS: [
    "ID",
    "Utilizador",
    "PIN_HASH",
    "Nome",
    "Perfil",
    "Ativo",
    "CriadoEm",
    "AtualizadoEm",
    "Telefone",
    "AtletaIDs",
  ],
  ATHLETES: [
    "ID",
    "Nome",
    "Escalao",
    "Ativo",
    "CriadoEm",
    "AtualizadoEm",
    "FotoURL",
    "FotoID",
    "NumeroVermelho",
    "NumeroBranco",
  ],
  TRAININGS: ["ID", "Data", "Hora", "Escalao", "CriadoPor", "CriadoEm"],
  RECORDS: [
    "ID",
    "TreinoID",
    "AtletaID",
    "Presenca",
    "Atitude",
    "Empenho",
    "Comportamento",
    "Observacao",
    "CriadoPor",
    "CriadoEm",
    "MotivoFalta",
    "Tags",
  ],
  GAMES: [
    "ID",
    "Adversario",
    "Data",
    "Hora",
    "Escalao",
    "Local",
    "Equipamento",
    "LimiteConvocados",
    "CriadoPor",
    "CriadoEm",
  ],
  CALLUPS: [
    "ID",
    "JogoID",
    "AtletaID",
    "Estado",
    "Score",
    "CriadoPor",
    "CriadoEm",
    "PosicaoX",
    "PosicaoY",
  ],
  SESSIONS: ["Token", "UtilizadorID", "ExpiraEm", "CriadoEm"],
  MONTHLY_FEES: [
    "ID",
    "AtletaID",
    "Epoca",
    "Mes",
    "Estado",
    "Valor",
    "MetodoPagamento",
    "DataPagamento",
    "Observacao",
    "Referencia",
    "NumeroPagamento",
    "AtualizadoPor",
    "AtualizadoEm",
  ],
  EVENTS: [
    "ID",
    "Tipo",
    "Titulo",
    "Data",
    "Hora",
    "Escalao",
    "Local",
    "Observacao",
    "Origem",
    "OrigemID",
    "CriadoPor",
    "CriadoEm",
  ],
  LINEUPS: [
    "ID",
    "JogoID",
    "AtletaID",
    "PosicaoX",
    "PosicaoY",
    "Equipamento",
    "Numero",
    "AtualizadoPor",
    "AtualizadoEm",
  ],
  SETTINGS: ["Chave", "Valor", "AtualizadoEm"],
  PLANNED_ABSENCES: [
    "ID",
    "AtletaID",
    "Data",
    "Motivo",
    "Observacao",
    "Ativo",
    "CriadoPor",
    "CriadoEm",
  ],
  GAME_AVAILABILITY: [
    "ID",
    "EventoID",
    "JogoID",
    "AtletaID",
    "Escalao",
    "DataEvento",
    "Estado",
    "Observacao",
    "AtualizadoPor",
    "AtualizadoEm",
  ],
  AVAILABILITY_REQUESTS: [
    "ID",
    "EventoID",
    "Escalao",
    "DataLimite",
    "Estado",
    "CriadoPor",
    "CriadoEm",
  ],
  AI_MONTHLY_SUMMARIES: [
    "ID",
    "AtletaID",
    "Mes",
    "Texto",
    "DadosJSON",
    "GeradoEm",
  ],
};

function setup() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActive();
    Object.keys(SHEETS).forEach((n) => ensureSheet_(ss, n, SHEETS[n]));
    if (ss.getSheetByName("USERS").getLastRow() === 1)
      append_("USERS", {
        ID: "u_admin",
        Utilizador: "admin",
        PIN_HASH: hash_("1234"),
        Nome: "Administrador GDR",
        Perfil: "admin",
        Ativo: true,
        CriadoEm: new Date(),
        AtualizadoEm: new Date(),
      });
    photoFolder_();
    ensureDefaultSettings_();
    const duplicateRecordsRemoved = dedupeTrainingRecords_();
    ensureFeeAlertTrigger_();
    ensureWeeklySummaryTrigger_();
    ensureAiSummaryTrigger_();
    PropertiesService.getDocumentProperties().setProperty(
      "GDR_SCHEMA_VERSION",
      VERSION,
    );
    return {
      ok: true,
      version: VERSION,
      duplicateRecordsRemoved: duplicateRecordsRemoved,
    };
  } finally {
    lock.releaseLock();
  }
}
function doGet() {
  return json_({
    ok: true,
    app: "GDR Formação 360",
    version: VERSION,
    status: "online",
  });
}
function doPost(e) {
  try {
    const b = JSON.parse((e.postData && e.postData.contents) || "{}"),
      a = s_(b.action);
    if (a === "login") return json_(login_(b));
    const u = session_(b.token);
    if (
      u.role === "parent" &&
      [
        "getData",
        "saveGameAvailability",
        "savePlannedAbsence",
        "deletePlannedAbsence",
      ].indexOf(a) < 0
    )
      throw Error("Ação não permitida no Portal dos Pais.");
    const h = {
      getData: getData_,
      saveTraining: saveTraining_,
      deleteTraining: deleteTraining_,
      saveCallup: saveCallup_,
      saveAthlete: saveAthlete_,
      deleteAthlete: deleteAthlete_,
      saveUser: saveUser_,
      toggleUser: toggleUser_,
      saveMonthlyFee: saveMonthlyFee_,
      saveFeeSettings: saveFeeSettings_,
      saveEvent: saveEvent_,
      deleteEvent: deleteEvent_,
      saveLineup: saveLineup_,
      savePlannedAbsence: savePlannedAbsence_,
      deletePlannedAbsence: deletePlannedAbsence_,
      saveGameAvailability: saveGameAvailability_,
      saveAvailabilityRequest: saveAvailabilityRequest_,
      deleteAvailabilityRequest: deleteAvailabilityRequest_,
      generateMonthlySummaries: generateMonthlySummariesNow_,
      saveWeeklySettings: saveWeeklySettings_,
      sendWeeklySummary: sendWeeklySummaryNow_,
    };
    if (!h[a]) throw Error("Ação inválida.");
    return json_(h[a](b, u));
  } catch (e2) {
    return json_({ ok: false, error: String(e2.message || e2) });
  }
}
function login_(b) {
  const un = s_(b.username).toLowerCase(),
    ph = hash_(s_(b.pin)),
    u = objs_("USERS").find(
      (x) =>
        s_(x.Utilizador).toLowerCase() === un &&
        s_(x.PIN_HASH) === ph &&
        bool_(x.Ativo),
    );
  if (!u) return { ok: false, error: "Credenciais inválidas" };
  const t = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, "");
  append_("SESSIONS", {
    Token: t,
    UtilizadorID: u.ID,
    ExpiraEm: new Date(Date.now() + SESSION_HOURS * 36e5),
    CriadoEm: new Date(),
  });
  return { ok: true, token: t, user: pub_(u) };
}
function session_(t) {
  const x = objs_("SESSIONS").find(
    (r) => s_(r.Token) === s_(t) && new Date(r.ExpiraEm).getTime() > Date.now(),
  );
  if (!x) throw Error("Sessão expirada. Volta a iniciar sessão.");
  const u = objs_("USERS").find(
    (r) => s_(r.ID) === s_(x.UtilizadorID) && bool_(r.Ativo),
  );
  if (!u) throw Error("Utilizador sem acesso.");
  return pub_(u);
}
function admin_(u) {
  if (!u || u.role !== "admin")
    throw Error("Apenas o Administrador pode efetuar esta alteração.");
}
function availabilityOwner_(u) {
  if (!u || s_(u.username).toLowerCase() !== "josealmanso")
    throw Error("Apenas o utilizador josealmanso pode gerir estes pedidos.");
}

function getData_(b, u) {
  if (u.role === "parent") return getParentData_(b, u);
  return {
    ok: true,
    data: {
      athletes: objs_("ATHLETES").map((r) => ({
        id: s_(r.ID),
        name: s_(r.Nome),
        group: s_(r.Escalao),
        active: bool_(r.Ativo),
        photoUrl: s_(r.FotoURL),
        redNumber: s_(r.NumeroVermelho),
        whiteNumber: s_(r.NumeroBranco),
      })),
      trainings: objs_("TRAININGS").map((r) => ({
        id: s_(r.ID),
        date: date_(r.Data),
        time: time_(r.Hora),
        group: s_(r.Escalao),
      })),
      records: uniqueTrainingRecords_().map((r) => ({
        id: s_(r.ID),
        trainingId: s_(r.TreinoID),
        athleteId: s_(r.AtletaID),
        status: s_(r.Presenca),
        attitude: num_(r.Atitude),
        effort: num_(r.Empenho),
        behavior: num_(r.Comportamento),
        note: s_(r.Observacao),
        absenceReason: s_(r.MotivoFalta),
        tags: arr_(r.Tags),
      })),
      games: objs_("GAMES").map((r) => ({
        id: s_(r.ID),
        opponent: s_(r.Adversario),
        date: date_(r.Data),
        time: time_(r.Hora),
        group: s_(r.Escalao),
        location: s_(r.Local),
        equipment: s_(r.Equipamento),
        callupLimit: num_(r.LimiteConvocados) || 12,
      })),
      callups: objs_("CALLUPS").map((r) => ({
        id: s_(r.ID),
        gameId: s_(r.JogoID),
        athleteId: s_(r.AtletaID),
        status: s_(r.Estado),
        score: num_(r.Score),
        x: num_(r.PosicaoX),
        y: num_(r.PosicaoY),
      })),
      users:
        s_(u.username).toLowerCase() === "josealmanso"
          ? objs_("USERS").map(pub_)
          : [],
      monthlyFees: objs_("MONTHLY_FEES").map((r) => ({
        id: s_(r.ID),
        athleteId: s_(r.AtletaID),
        season: s_(r.Epoca),
        month: s_(r.Mes),
        status: s_(r.Estado),
        amount: num_(r.Valor),
        method: s_(r.MetodoPagamento),
        paymentDate: date_(r.DataPagamento),
        note: s_(r.Observacao),
        reference: s_(r.Referencia),
        paymentNumber: s_(r.NumeroPagamento) || s_(r.Referencia),
        updatedBy: s_(r.AtualizadoPor),
        updatedAt: iso_(r.AtualizadoEm),
      })),
      events: objs_("EVENTS").map((r) => ({
        id: s_(r.ID),
        type: s_(r.Tipo),
        title: s_(r.Titulo),
        date: date_(r.Data),
        time: time_(r.Hora),
        group: s_(r.Escalao),
        location: s_(r.Local),
        note: s_(r.Observacao),
        source: s_(r.Origem),
        sourceId: s_(r.OrigemID),
      })),
      lineups: objs_("LINEUPS").map((r) => ({
        id: s_(r.ID),
        gameId: s_(r.JogoID),
        athleteId: s_(r.AtletaID),
        x: num_(r.PosicaoX),
        y: num_(r.PosicaoY),
        equipment: s_(r.Equipamento),
        number: s_(r.Numero),
      })),
      plannedAbsences: objs_("PLANNED_ABSENCES").map((r) => ({
        id: s_(r.ID),
        athleteId: s_(r.AtletaID),
        date: date_(r.Data),
        reason: s_(r.Motivo),
        note: s_(r.Observacao),
        active: bool_(r.Ativo),
        createdBy: s_(r.CriadoPor),
      })),
      gameAvailability: objs_("GAME_AVAILABILITY").map((r) => ({
        id: s_(r.ID),
        eventId: s_(r.EventoID) || s_(r.JogoID),
        gameId: s_(r.JogoID),
        athleteId: s_(r.AtletaID),
        group: s_(r.Escalao),
        eventDate: date_(r.DataEvento),
        status: s_(r.Estado) || "Sem resposta",
        note: s_(r.Observacao),
        updatedAt: iso_(r.AtualizadoEm),
      })),
      availabilityRequests: objs_("AVAILABILITY_REQUESTS").map((r) => ({
        id: s_(r.ID),
        eventId: s_(r.EventoID),
        group: s_(r.Escalao),
        deadline: date_(r.DataLimite),
        status: s_(r.Estado) || "Aberto",
      })),
      monthlySummaries: objs_("AI_MONTHLY_SUMMARIES").map((r) => ({
        id: s_(r.ID),
        athleteId: s_(r.AtletaID),
        month: s_(r.Mes),
        text: s_(r.Texto),
        generatedAt: iso_(r.GeradoEm),
      })),
      settings: {
        feeAmount: FEE_AMOUNT,
        feeStartMonth: FEE_START_MONTH,
        feeDueDay: FEE_DUE_DAY,
        alertEmail: u.role === "admin" ? setting_("ALERT_EMAIL") : "",
        weeklySummaryEmail:
          u.role === "admin"
            ? setting_("WEEKLY_SUMMARY_EMAIL") || setting_("ALERT_EMAIL")
            : "",
        version: VERSION,
      },
    },
  };
}
function getParentData_(b, u) {
  const full = getData_(b, { id: u.id, role: "treinador" }),
    data = full.data,
    allowed = new Set(u.athleteIds || []),
    allowedGroups = new Set(
      data.athletes.filter((a) => allowed.has(a.id)).map((a) => a.group),
    );
  data.athletes = data.athletes.filter((a) => allowed.has(a.id));
  data.records = data.records.filter((r) => allowed.has(r.athleteId));
  const trainingIds = new Set(data.records.map((r) => r.trainingId));
  data.trainings = data.trainings.filter((t) => trainingIds.has(t.id));
  data.monthlyFees = data.monthlyFees.filter((f) => allowed.has(f.athleteId));
  data.plannedAbsences = data.plannedAbsences.filter((a) =>
    allowed.has(a.athleteId),
  );
  data.gameAvailability = data.gameAvailability.filter((a) =>
    allowed.has(a.athleteId),
  );
  data.monthlySummaries = data.monthlySummaries.filter((s) =>
    allowed.has(s.athleteId),
  );
  data.callups = data.callups.filter((c) => allowed.has(c.athleteId));
  data.events = data.events.filter(
    (e) => e.group === "Todos" || allowedGroups.has(e.group),
  );
  data.games = data.games.filter(
    (g) => g.group === "Todos" || allowedGroups.has(g.group),
  );
  data.availabilityRequests = data.availabilityRequests.filter(
    (r) => allowedGroups.has(r.group) && r.status === "Aberto",
  );
  data.users = [];
  data.records = data.records.map((r) => ({
    id: r.id,
    trainingId: r.trainingId,
    athleteId: r.athleteId,
    status: r.status,
    attitude: r.attitude,
    effort: r.effort,
    behavior: r.behavior,
    absenceReason: r.absenceReason,
    tags: [],
    note: "",
  }));
  return { ok: true, data: data };
}
function saveTraining_(b, u) {
  const t = b.training || {},
    rs = b.records || [];
  if (!s_(t.id) || !date_(t.date)) throw Error("Treino inválido.");
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const now = new Date(),
      records = rs.map((r) => ({
        ID: r.id || "r_" + t.id + "_" + r.athleteId,
        TreinoID: t.id,
        AtletaID: r.athleteId,
        Presenca: r.status,
        Atitude: r.attitude,
        Empenho: r.effort,
        Comportamento: r.behavior,
        Observacao: r.note,
        CriadoPor: u.id,
        CriadoEm: now,
        MotivoFalta: r.absenceReason,
        Tags: JSON.stringify(r.tags || []),
      })),
      eligibleIds = new Set(
        objs_("ATHLETES")
          .filter(
            (a) =>
              bool_(a.Ativo) &&
              (s_(t.group) === "Todos" ||
                s_(a.Escalao) === s_(t.group) ||
                s_(a.Escalao) === "Traquinas/Benjamins"),
          )
          .map((a) => s_(a.ID)),
      );
    objs_("PLANNED_ABSENCES")
      .filter(
        (a) =>
          bool_(a.Ativo) &&
          date_(a.Data) === date_(t.date) &&
          eligibleIds.has(s_(a.AtletaID)),
      )
      .forEach((a) =>
        records.push({
          ID: "pa_" + t.id + "_" + s_(a.AtletaID),
          TreinoID: t.id,
          AtletaID: a.AtletaID,
          Presenca: "Justificada",
          Atitude: "",
          Empenho: "",
          Comportamento: "",
          Observacao: s_(a.Observacao),
          CriadoPor: u.id,
          CriadoEm: now,
          MotivoFalta: "Falta antecipada: " + s_(a.Motivo),
          Tags: "[]",
        }),
      );
    upsertMany_("TRAININGS", "ID", [
      {
        ID: t.id,
        Data: t.date,
        Hora: t.time,
        Escalao: t.group,
        CriadoPor: u.id,
        CriadoEm: now,
      },
    ]);
    upsertMany_("RECORDS", "ID", records);
    dedupeTrainingRecords_(s_(t.id));
    SpreadsheetApp.flush();
    return { ok: true, records: records.length };
  } finally {
    lock.releaseLock();
  }
}

function deleteTraining_(b, u) {
  admin_(u);
  const id = s_(b.id);
  if (!id || !objs_("TRAININGS").some((t) => s_(t.ID) === id))
    throw Error("Treino não encontrado.");
  del_("RECORDS", (r) => s_(r.TreinoID) === id);
  del_("TRAININGS", (t) => s_(t.ID) === id);
  return { ok: true };
}

function savePlannedAbsence_(b, u) {
  const a = b.absence || {};
  if (u.role === "parent" && (u.athleteIds || []).indexOf(s_(a.athleteId)) < 0)
    throw Error("Sem autorização para alterar este atleta.");
  if (!s_(a.athleteId) || !/^\d{4}-\d{2}-\d{2}$/.test(s_(a.date)))
    throw Error("Seleciona o atleta e a data da falta.");
  if (
    s_(a.date) <
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")
  )
    throw Error(
      "A falta antecipada tem de ser registada para hoje ou para uma data futura.",
    );
  if (!s_(a.reason)) throw Error("Indica o motivo da falta.");
  const duplicate = objs_("PLANNED_ABSENCES").find(
    (x) =>
      bool_(x.Ativo) &&
      s_(x.AtletaID) === s_(a.athleteId) &&
      date_(x.Data) === date_(a.date),
  );
  if (duplicate)
    throw Error("Este atleta já tem uma falta antecipada nessa data.");
  const id = "pa_" + Utilities.getUuid();
  append_("PLANNED_ABSENCES", {
    ID: id,
    AtletaID: a.athleteId,
    Data: a.date,
    Motivo: a.reason,
    Observacao: a.note,
    Ativo: true,
    CriadoPor: u.id,
    CriadoEm: new Date(),
  });
  return { ok: true, id: id };
}
function deletePlannedAbsence_(b, u) {
  if (u.role === "parent") {
    const absence = objs_("PLANNED_ABSENCES").find(
      (r) => s_(r.ID) === s_(b.id),
    );
    if (!absence || (u.athleteIds || []).indexOf(s_(absence.AtletaID)) < 0)
      throw Error("Sem autorização para alterar esta falta.");
  }
  patch_("PLANNED_ABSENCES", "ID", b.id, { Ativo: false });
  return { ok: true };
}
function saveGameAvailability_(b, u) {
  const eventId = s_(b.eventId || b.gameId),
    gameId = s_(b.gameId),
    group = s_(b.group),
    eventDate = date_(b.eventDate),
    rows = b.availability || [],
    valid = ["Disponível", "Indisponível", "Sem resposta"];
  if (!eventId || !group || !eventDate)
    throw Error("Evento do calendário inválido.");
  if (u.role === "parent") {
    const allowed = new Set(u.athleteIds || []);
    if (!rows.length || rows.some((x) => !allowed.has(s_(x.athleteId))))
      throw Error("Sem autorização para alterar este atleta.");
    const request = objs_("AVAILABILITY_REQUESTS").find(
      (r) =>
        s_(r.EventoID) === eventId &&
        s_(r.Escalao) === group &&
        s_(r.Estado || "Aberto") === "Aberto" &&
        date_(r.DataLimite) >=
          Utilities.formatDate(
            new Date(),
            Session.getScriptTimeZone(),
            "yyyy-MM-dd",
          ),
    );
    if (!request) throw Error("Este pedido já não está disponível.");
  }
  rows.forEach((x) => {
    if (!s_(x.athleteId) || valid.indexOf(s_(x.status)) < 0)
      throw Error("Disponibilidade inválida.");
    const old = objs_("GAME_AVAILABILITY").find(
        (r) =>
          (s_(r.EventoID) || s_(r.JogoID)) === eventId &&
          (s_(r.Escalao) || group) === group &&
          s_(r.AtletaID) === s_(x.athleteId),
      ),
      id = old ? old.ID : "ga_" + Utilities.getUuid();
    upsert_("GAME_AVAILABILITY", "ID", {
      ID: id,
      EventoID: eventId,
      JogoID: gameId,
      AtletaID: x.athleteId,
      Escalao: group,
      DataEvento: eventDate,
      Estado: x.status,
      Observacao: x.note,
      AtualizadoPor: u.id,
      AtualizadoEm: new Date(),
    });
  });
  return { ok: true };
}
function saveAvailabilityRequest_(b, u) {
  availabilityOwner_(u);
  const eventId = s_(b.eventId),
    group = s_(b.group),
    deadline = date_(b.deadline);
  if (!eventId || !group || !deadline)
    throw Error("Indica o evento, escalão e prazo de resposta.");
  const id = "ar_" + eventId + "_" + group.toLowerCase();
  upsert_("AVAILABILITY_REQUESTS", "ID", {
    ID: id,
    EventoID: eventId,
    Escalao: group,
    DataLimite: deadline,
    Estado: "Aberto",
    CriadoPor: u.id,
    CriadoEm: new Date(),
  });
  return { ok: true, id: id };
}
function deleteAvailabilityRequest_(b, u) {
  availabilityOwner_(u);
  const request = objs_("AVAILABILITY_REQUESTS").find(
    (r) => s_(r.ID) === s_(b.id),
  );
  if (!request) throw Error("Pedido de disponibilidade não encontrado.");
  const eventId = s_(request.EventoID),
    group = s_(request.Escalao);
  del_(
    "GAME_AVAILABILITY",
    (r) => s_(r.EventoID) === eventId && s_(r.Escalao) === group,
  );
  del_("AVAILABILITY_REQUESTS", (r) => s_(r.ID) === s_(request.ID));
  return { ok: true };
}
function saveWeeklySettings_(b, u) {
  admin_(u);
  const email = s_(b.email).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw Error("Indica um endereço de email válido.");
  setSetting_("WEEKLY_SUMMARY_EMAIL", email);
  ensureWeeklySummaryTrigger_();
  return { ok: true };
}
function sendWeeklySummaryNow_(b, u) {
  admin_(u);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s_(b.start)) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s_(b.end))
  )
    throw Error("Período semanal inválido.");
  sendWeeklySummary_(b.start, b.end);
  return { ok: true };
}
function saveCallup_(b, u) {
  const g = b.game || {},
    cs = b.callups || [];
  if (!s_(g.id) || !date_(g.date)) throw Error("Jogo inválido.");
  upsert_("GAMES", "ID", {
    ID: g.id,
    Adversario: g.opponent,
    Data: g.date,
    Hora: g.time,
    Escalao: g.group,
    Local: g.location,
    Equipamento: g.equipment,
    LimiteConvocados: g.callupLimit || 12,
    CriadoPor: u.id,
    CriadoEm: new Date(),
  });
  del_("CALLUPS", (r) => s_(r.JogoID) === s_(g.id));
  cs.forEach((c) =>
    append_("CALLUPS", {
      ID: c.id || Utilities.getUuid(),
      JogoID: g.id,
      AtletaID: c.athleteId,
      Estado: c.status || "Convocado",
      Score: c.score || 0,
      CriadoPor: u.id,
      CriadoEm: new Date(),
      PosicaoX: c.x || "",
      PosicaoY: c.y || "",
    }),
  );
  return { ok: true };
}
function saveAthlete_(b, u) {
  admin_(u);
  const a = b.athlete || {};
  if (!s_(a.name)) throw Error("Indica o nome do atleta.");
  const old = objs_("ATHLETES").find((x) => s_(x.ID) === s_(a.id)),
    id = s_(a.id) || "a_" + Utilities.getUuid();
  let url = old ? s_(old.FotoURL) : "",
    fid = old ? s_(old.FotoID) : "";
  if (b.photoBase64) {
    const f = photo_(b.photoBase64, a.name);
    url = f.url;
    fid = f.id;
  }
  upsert_("ATHLETES", "ID", {
    ID: id,
    Nome: a.name,
    Escalao: a.group,
    Ativo: true,
    CriadoEm: old ? old.CriadoEm : new Date(),
    AtualizadoEm: new Date(),
    FotoURL: url,
    FotoID: fid,
    NumeroVermelho: a.redNumber,
    NumeroBranco: a.whiteNumber,
  });
  return { ok: true, id: id };
}
function deleteAthlete_(b, u) {
  admin_(u);
  patch_("ATHLETES", "ID", b.id, { Ativo: false, AtualizadoEm: new Date() });
  return { ok: true };
}
function saveUser_(b, u) {
  availabilityOwner_(u);
  const t = b.target || {},
    old = objs_("USERS").find((x) => s_(x.ID) === s_(t.id)),
    id = s_(t.id) || "u_" + Utilities.getUuid();
  if (!s_(t.name) || !s_(t.username) || (!old && !s_(t.pin)))
    throw Error("Preenche nome, utilizador e PIN.");
  if (["admin", "treinador", "parent"].indexOf(s_(t.role)) < 0)
    throw Error("Perfil inválido.");
  if (s_(t.role) === "parent" && !(t.athleteIds || []).length)
    throw Error("Associa pelo menos um filho à conta do pai/mãe.");
  upsert_("USERS", "ID", {
    ID: id,
    Utilizador: t.username,
    PIN_HASH: s_(t.pin) ? hash_(t.pin) : old.PIN_HASH,
    Nome: t.name,
    Perfil: t.role || "treinador",
    Ativo: old ? bool_(old.Ativo) : true,
    CriadoEm: old ? old.CriadoEm : new Date(),
    AtualizadoEm: new Date(),
    Telefone: t.phone,
    AtletaIDs: JSON.stringify(t.athleteIds || []),
  });
  return { ok: true, id: id };
}
function toggleUser_(b, u) {
  availabilityOwner_(u);
  if (s_(b.id) === s_(u.id) && !b.active)
    throw Error("Não podes desativar a tua conta.");
  patch_("USERS", "ID", b.id, { Ativo: !!b.active, AtualizadoEm: new Date() });
  return { ok: true };
}
function saveMonthlyFee_(b, u) {
  admin_(u);
  const f = b.fee || {},
    sts = ["Pago", "Em falta", "Isento", "Pendente"],
    meth = ["Numerário", "MB Way"];
  if (
    !s_(f.athleteId) ||
    !/^\d{4}\/\d{2}$/.test(s_(f.season)) ||
    !/^\d{4}-\d{2}$/.test(s_(f.month))
  )
    throw Error("Atleta, época ou mês inválido.");
  if (s_(f.month) < FEE_START_MONTH)
    throw Error("As mensalidades começam em outubro de 2026.");
  if (sts.indexOf(f.status) < 0) throw Error("Estado inválido.");
  if (f.status === "Pago" && meth.indexOf(f.method) < 0)
    throw Error("Seleciona Numerário ou MB Way.");
  if (f.status === "Pago" && !/^\d{4}-\d{2}-\d{2}$/.test(s_(f.paymentDate)))
    throw Error("Indica a data do pagamento.");
  const old = objs_("MONTHLY_FEES").find(
      (x) =>
        s_(x.AtletaID) === s_(f.athleteId) &&
        s_(x.Epoca) === s_(f.season) &&
        s_(x.Mes) === s_(f.month),
    ),
    id = old ? old.ID : s_(f.id) || "fee_" + Utilities.getUuid(),
    paymentNumber =
      old && (s_(old.NumeroPagamento) || s_(old.Referencia))
        ? s_(old.NumeroPagamento) || s_(old.Referencia)
        : f.status === "Pago"
          ? nextPaymentNumber_(
              s_(f.paymentDate).slice(0, 4) || s_(f.month).slice(0, 4),
            )
          : "";
  upsert_("MONTHLY_FEES", "ID", {
    ID: id,
    AtletaID: f.athleteId,
    Epoca: f.season,
    Mes: f.month,
    Estado: f.status,
    Valor: f.status === "Isento" ? 0 : FEE_AMOUNT,
    MetodoPagamento: f.status === "Pago" ? f.method : "",
    DataPagamento: f.status === "Pago" ? f.paymentDate : "",
    Observacao: f.note,
    Referencia: paymentNumber,
    NumeroPagamento: paymentNumber,
    AtualizadoPor: u.id,
    AtualizadoEm: new Date(),
  });
  return { ok: true, id: id, paymentNumber: paymentNumber };
}
function saveFeeSettings_(b, u) {
  admin_(u);
  const email = s_(b.alertEmail).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw Error("Indica um endereço de email válido.");
  setSetting_("ALERT_EMAIL", email);
  ensureFeeAlertTrigger_();
  return { ok: true };
}

function nextPaymentNumber_(year) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const prefix = "GDR-PAG-" + year + "-";
    const max = objs_("MONTHLY_FEES").reduce((n, r) => {
      const value = s_(r.NumeroPagamento) || s_(r.Referencia),
        match = value.match(new RegExp("^" + prefix + "(\\d+)$"));
      return match ? Math.max(n, Number(match[1])) : n;
    }, 0);
    return prefix + String(max + 1).padStart(5, "0");
  } finally {
    lock.releaseLock();
  }
}

function ensureDefaultSettings_() {
  if (!setting_("ALERT_EMAIL")) {
    const email = Session.getEffectiveUser().getEmail();
    if (email) setSetting_("ALERT_EMAIL", email);
  }
}
function setting_(key) {
  const row = objs_("SETTINGS").find((r) => s_(r.Chave) === key);
  return row ? s_(row.Valor) : "";
}
function setSetting_(key, value) {
  upsert_("SETTINGS", "Chave", {
    Chave: key,
    Valor: value,
    AtualizadoEm: new Date(),
  });
}
function ensureFeeAlertTrigger_() {
  if (
    !ScriptApp.getProjectTriggers().some(
      (t) => t.getHandlerFunction() === "dailyFeeAlerts",
    )
  )
    ScriptApp.newTrigger("dailyFeeAlerts")
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();
}
function ensureWeeklySummaryTrigger_() {
  if (
    !ScriptApp.getProjectTriggers().some(
      (t) => t.getHandlerFunction() === "sendAutomaticWeeklySummary",
    )
  )
    ScriptApp.newTrigger("sendAutomaticWeeklySummary")
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(8)
      .create();
}
function ensureAiSummaryTrigger_() {
  if (
    !ScriptApp.getProjectTriggers().some(
      (t) => t.getHandlerFunction() === "generateAutomaticMonthlySummaries",
    )
  )
    ScriptApp.newTrigger("generateAutomaticMonthlySummaries")
      .timeBased()
      .everyDays(1)
      .atHour(7)
      .create();
}
function generateAutomaticMonthlySummaries() {
  const now = new Date();
  if (now.getDate() > 3) return;
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1),
    month = Utilities.formatDate(
      previous,
      Session.getScriptTimeZone(),
      "yyyy-MM",
    );
  generateAiSummariesForMonth_(month);
}
function generateMonthlySummariesNow_(b, u) {
  availabilityOwner_(u);
  const month = s_(b.month);
  if (!/^\d{4}-\d{2}$/.test(month)) throw Error("Mês inválido.");
  const result = generateAiSummariesForMonth_(month);
  if (!result.ok) throw Error(result.reason);
  return result;
}
function generateAiSummariesForMonth_(month) {
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
  if (!apiKey) return { ok: false, reason: "OPENAI_API_KEY não configurada" };
  const model =
      PropertiesService.getScriptProperties().getProperty("OPENAI_MODEL") ||
      "gpt-5.4-mini",
    trainings = objs_("TRAININGS").filter(
      (t) => date_(t.Data).slice(0, 7) === month,
    ),
    trainingIds = new Set(trainings.map((t) => s_(t.ID))),
    records = uniqueTrainingRecords_().filter((r) =>
      trainingIds.has(s_(r.TreinoID)),
    ),
    existing = new Set(
      objs_("AI_MONTHLY_SUMMARIES")
        .filter(
          (r) =>
            s_(r.Texto) &&
            !s_(r.Texto).startsWith("Ainda não existem registos suficientes"),
        )
        .map((r) => s_(r.AtletaID) + "|" + s_(r.Mes)),
    );
  let generated = 0;
  objs_("ATHLETES")
    .filter((a) => bool_(a.Ativo))
    .forEach((athlete) => {
      const athleteId = s_(athlete.ID),
        key = athleteId + "|" + month;
      if (existing.has(key)) return;
      const rr = records.filter((r) => s_(r.AtletaID) === athleteId),
        present = rr.filter((r) => s_(r.Presenca) === "Presente"),
        average = (field) =>
          present.length
            ? Number(
                (
                  present.reduce((sum, r) => sum + num_(r[field]), 0) /
                  present.length
                ).toFixed(1),
              )
            : null,
        tags = {};
      present.forEach((r) =>
        arr_(r.Tags).forEach((tag) => (tags[tag] = (tags[tag] || 0) + 1)),
      );
      const data = {
        mes: month,
        treinosRegistados: rr.length,
        presencas: present.length,
        faltas: rr.filter((r) => s_(r.Presenca) === "Falta").length,
        justificadas: rr.filter((r) => s_(r.Presenca) === "Justificada").length,
        assiduidade: rr.length
          ? Math.round((present.length / rr.length) * 100)
          : null,
        atitude: average("Atitude"),
        empenho: average("Empenho"),
        comportamento: average("Comportamento"),
        destaques: Object.entries(tags)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map((x) => x[0]),
      };
      if (rr.length < 2) return;
      const text = openAiMonthlyText_(apiKey, model, data, athleteId);
      upsert_("AI_MONTHLY_SUMMARIES", "ID", {
        ID: "ai_" + athleteId + "_" + month,
        AtletaID: athleteId,
        Mes: month,
        Texto: text,
        DadosJSON: JSON.stringify(data),
        GeradoEm: new Date(),
      });
      generated++;
    });
  return { ok: true, generated: generated };
}
function openAiMonthlyText_(apiKey, model, data, athleteId) {
  const response = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + apiKey },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        model: model,
        store: false,
        max_output_tokens: 280,
        safety_identifier: hash_(athleteId).slice(0, 32),
        instructions:
          "Escreve em português europeu um resumo mensal curto para os pais de um jovem atleta de futebol. Usa exclusivamente os dados fornecidos. Linguagem positiva, clara e prudente. Não compares com outras crianças, não faças diagnósticos, não inventes factos e não reveles notas numéricas. Inclui evolução observável, ponto positivo e um objetivo simples para o mês seguinte. Dois parágrafos, máximo 110 palavras.",
        input: JSON.stringify(data),
      }),
    }),
    code = response.getResponseCode(),
    body = JSON.parse(response.getContentText() || "{}");
  if (code < 200 || code >= 300)
    throw Error("Falha ao gerar resumo IA: " + (body.error?.message || code));
  const parts = [];
  (body.output || []).forEach((item) =>
    (item.content || []).forEach((content) => {
      if (content.type === "output_text" && content.text)
        parts.push(content.text);
    }),
  );
  if (!parts.length) throw Error("A IA não devolveu texto para o resumo.");
  return parts.join("\n").trim();
}
function sendAutomaticWeeklySummary() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  sendWeeklySummary_(date_(start), date_(end));
}
function sendWeeklySummary_(start, end) {
  const email = setting_("WEEKLY_SUMMARY_EMAIL") || setting_("ALERT_EMAIL");
  if (!email) return;
  const trainings = objs_("TRAININGS").filter(
      (t) => date_(t.Data) >= start && date_(t.Data) <= end,
    ),
    trainingIds = new Set(trainings.map((t) => s_(t.ID))),
    records = objs_("RECORDS").filter((r) => trainingIds.has(s_(r.TreinoID))),
    games = objs_("GAMES").filter(
      (g) => date_(g.Data) >= start && date_(g.Data) <= end,
    ),
    athletes = objs_("ATHLETES").filter((a) => bool_(a.Ativo)),
    groups = ["Traquinas", "Benjamins"],
    groupRows = groups.map((group) => {
      const ids = new Set(
          athletes
            .filter(
              (a) =>
                s_(a.Escalao) === group ||
                s_(a.Escalao) === "Traquinas/Benjamins",
            )
            .map((a) => s_(a.ID)),
        ),
        rr = records.filter((r) => ids.has(s_(r.AtletaID))),
        present = rr.filter((r) => s_(r.Presenca) === "Presente").length,
        avg = (key) => {
          const values = rr
            .filter((r) => s_(r.Presenca) === "Presente" && num_(r[key]))
            .map((r) => num_(r[key]));
          return values.length
            ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
            : "—";
        };
      return {
        group: group,
        athletes: ids.size,
        attendance: rr.length ? Math.round((present / rr.length) * 100) : 0,
        effort: avg("Empenho"),
        behavior: avg("Comportamento"),
        absences: rr.length - present,
      };
    }),
    planned = objs_("PLANNED_ABSENCES").filter(
      (a) => bool_(a.Ativo) && date_(a.Data) > end,
    ).length,
    nextGames = objs_("GAMES")
      .filter((g) => date_(g.Data) > end)
      .sort((a, b) => date_(a.Data).localeCompare(date_(b.Data)))
      .slice(0, 3),
    totalPresent = records.filter((r) => s_(r.Presenca) === "Presente").length,
    attendance = records.length
      ? Math.round((totalPresent / records.length) * 100)
      : 0,
    rowsHtml = groupRows
      .map(
        (r) =>
          `<tr><td><b>${r.group}</b></td><td>${r.athletes}</td><td>${r.attendance}%</td><td>${r.absences}</td><td>${r.effort}</td><td>${r.behavior}</td></tr>`,
      )
      .join(""),
    gamesHtml = nextGames.length
      ? nextGames
          .map(
            (g) =>
              `<li>${date_(g.Data)} · GDR × ${s_(g.Adversario)} · ${s_(g.Escalao)}</li>`,
          )
          .join("")
      : "<li>Sem jogos futuros registados.</li>";
  MailApp.sendEmail({
    to: email,
    subject: `GDR Formação 360 — Resumo semanal ${start} a ${end}`,
    name: "GDR Formação 360",
    htmlBody: `<div style="font-family:Arial,sans-serif;max-width:760px"><h1 style="color:#b5121b">Resumo semanal da formação</h1><p><b>${start} a ${end}</b></p><div style="display:flex;gap:12px"><p><b>${trainings.length}</b><br>Treinos</p><p><b>${games.length}</b><br>Jogos</p><p><b>${attendance}%</b><br>Assiduidade</p><p><b>${planned}</b><br>Faltas antecipadas futuras</p></div><table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left">Escalão</th><th>Atletas</th><th>Assiduidade</th><th>Faltas</th><th>Empenho</th><th>Comportamento</th></tr>${rowsHtml}</table><h3>Próximos jogos</h3><ul>${gamesHtml}</ul><p style="color:#777;font-size:12px">Gerado automaticamente pela GDR Formação 360.</p></div>`,
    body: `Resumo semanal GDR Formação 360\n${start} a ${end}\nTreinos: ${trainings.length}\nJogos: ${games.length}\nAssiduidade: ${attendance}%\nFaltas antecipadas futuras: ${planned}`,
  });
}
function dailyFeeAlerts() {
  const now = new Date(),
    tz = Session.getScriptTimeZone(),
    month = Utilities.formatDate(now, tz, "yyyy-MM"),
    day = Number(Utilities.formatDate(now, tz, "d")),
    weekday = Number(Utilities.formatDate(now, tz, "u"));
  if (
    month < FEE_START_MONTH ||
    !(day === 6 || day === 9 || (day > 9 && weekday === 1))
  )
    return;
  sendFeeAlertForMonth_(month, day <= FEE_DUE_DAY ? "prazo" : "atraso");
}
function sendFeeAlertForMonth_(month, phase) {
  const email = setting_("ALERT_EMAIL");
  if (!email) return;
  const paidOrExempt = new Set(
      objs_("MONTHLY_FEES")
        .filter(
          (f) =>
            s_(f.Mes) === month &&
            ["Pago", "Isento"].indexOf(s_(f.Estado)) >= 0,
        )
        .map((f) => s_(f.AtletaID)),
    ),
    missing = objs_("ATHLETES").filter(
      (a) => bool_(a.Ativo) && !paidOrExempt.has(s_(a.ID)),
    );
  if (!missing.length) return;
  const key =
      "FEE_ALERT_" +
      month +
      "_" +
      phase +
      "_" +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd"),
    props = PropertiesService.getDocumentProperties();
  if (props.getProperty(key)) return;
  const title =
      phase === "prazo"
        ? "Mensalidades por confirmar até dia 8"
        : "Mensalidades em falta após dia 8",
    lines = missing.map((a) => "• " + s_(a.Nome) + " — " + s_(a.Escalao));
  MailApp.sendEmail({
    to: email,
    subject: "GDR Formação 360 — " + title + " — " + month,
    body:
      title +
      "\n\nMês: " +
      month +
      "\nTotal por regularizar: " +
      missing.length +
      " atletas · " +
      missing.length * FEE_AMOUNT +
      " €\n\n" +
      lines.join("\n") +
      "\n\nPrazo normal de pagamento: dias 1 a 8.",
    name: "GDR Formação 360",
  });
  props.setProperty(key, new Date().toISOString());
}
function saveEvent_(b, u) {
  admin_(u);
  const e = b.event || {},
    id = s_(e.id) || "evt_" + Utilities.getUuid();
  if (!s_(e.title) || !date_(e.date)) throw Error("Preenche título e data.");
  upsert_("EVENTS", "ID", {
    ID: id,
    Tipo: e.type,
    Titulo: e.title,
    Data: e.date,
    Hora: e.time,
    Escalao: e.group,
    Local: e.location,
    Observacao: e.note,
    Origem: "manual",
    OrigemID: "",
    CriadoPor: u.id,
    CriadoEm: new Date(),
  });
  return { ok: true, id: id };
}
function deleteEvent_(b, u) {
  admin_(u);
  del_(
    "EVENTS",
    (r) => s_(r.ID) === s_(b.id) && s_(r.Origem || "manual") === "manual",
  );
  return { ok: true };
}
function saveLineup_(b, u) {
  const g = s_(b.gameId);
  if (!g) throw Error("Jogo inválido.");
  del_("LINEUPS", (r) => s_(r.JogoID) === g);
  (b.lineup || []).forEach((x) =>
    append_("LINEUPS", {
      ID: "lu_" + Utilities.getUuid(),
      JogoID: g,
      AtletaID: x.athleteId,
      PosicaoX: x.x,
      PosicaoY: x.y,
      Equipamento: x.equipment,
      Numero: x.number,
      AtualizadoPor: u.id,
      AtualizadoEm: new Date(),
    }),
  );
  return { ok: true };
}

function ensureSheet_(ss, n, h) {
  let sh = ss.getSheetByName(n);
  if (!sh) sh = ss.insertSheet(n);
  if (!sh.getLastRow()) sh.getRange(1, 1, 1, h.length).setValues([h]);
  else {
    const cur = sh
      .getRange(1, 1, 1, sh.getLastColumn())
      .getDisplayValues()[0]
      .map(s_);
    h.forEach((x) => {
      if (cur.indexOf(x) < 0) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(x);
        cur.push(x);
      }
    });
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn())
    .setFontWeight("bold")
    .setBackground("#b5121b")
    .setFontColor("#fff");
}
function objs_(n) {
  const sh = SpreadsheetApp.getActive().getSheetByName(n);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(),
    h = v.shift().map(s_);
  return v
    .filter((r) => r.some((x) => s_(x) !== ""))
    .map((r) => {
      const o = {};
      h.forEach((k, i) => (o[k] = r[i]));
      return o;
    });
}
function append_(n, o) {
  const sh = SpreadsheetApp.getActive().getSheetByName(n),
    h = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  sh.appendRow(h.map((k) => (o[k] === undefined ? "" : o[k])));
}
function upsert_(n, k, o) {
  const sh = SpreadsheetApp.getActive().getSheetByName(n),
    v = sh.getDataRange().getValues(),
    h = v[0].map(s_),
    ki = h.indexOf(k),
    ri = v.findIndex((r, i) => i && s_(r[ki]) === s_(o[k])),
    vals = h.map((x, i) =>
      o[x] === undefined ? (ri > 0 ? v[ri][i] : "") : o[x],
    );
  if (ri > 0) sh.getRange(ri + 1, 1, 1, h.length).setValues([vals]);
  else sh.appendRow(vals);
}
function upsertMany_(n, k, rows) {
  if (!rows || !rows.length) return;
  const sh = SpreadsheetApp.getActive().getSheetByName(n),
    values = sh.getDataRange().getValues(),
    headers = values[0].map(s_),
    keyIndex = headers.indexOf(k),
    rowByKey = {};
  values.forEach((row, index) => {
    if (index && s_(row[keyIndex])) rowByKey[s_(row[keyIndex])] = index + 1;
  });
  const additions = [];
  rows.forEach((item) => {
    const sheetRow = rowByKey[s_(item[k])],
      current = sheetRow ? values[sheetRow - 1] : [],
      output = headers.map((header, index) =>
        item[header] === undefined ? current[index] || "" : item[header],
      );
    if (sheetRow)
      sh.getRange(sheetRow, 1, 1, headers.length).setValues([output]);
    else additions.push(output);
  });
  if (additions.length)
    sh.getRange(
      sh.getLastRow() + 1,
      1,
      additions.length,
      headers.length,
    ).setValues(additions);
}
function uniqueTrainingRecords_() {
  const unique = {};
  objs_("RECORDS").forEach((record) => {
    const trainingId = s_(record.TreinoID),
      athleteId = s_(record.AtletaID),
      key = trainingId && athleteId ? trainingId + "|" + athleteId : "";
    if (key) unique[key] = record;
  });
  return Object.keys(unique).map((key) => unique[key]);
}
function dedupeTrainingRecords_(onlyTrainingId) {
  const sh = SpreadsheetApp.getActive().getSheetByName("RECORDS");
  if (!sh || sh.getLastRow() < 3) return 0;
  const values = sh.getDataRange().getValues(),
    headers = values[0].map(s_),
    trainingIndex = headers.indexOf("TreinoID"),
    athleteIndex = headers.indexOf("AtletaID"),
    seen = {},
    rowsToDelete = [];
  for (let index = values.length - 1; index >= 1; index--) {
    const trainingId = s_(values[index][trainingIndex]),
      athleteId = s_(values[index][athleteIndex]);
    if (
      !trainingId ||
      !athleteId ||
      (onlyTrainingId && trainingId !== s_(onlyTrainingId))
    )
      continue;
    const key = trainingId + "|" + athleteId;
    if (seen[key]) rowsToDelete.push(index + 1);
    else seen[key] = true;
  }
  rowsToDelete.forEach((row) => sh.deleteRow(row));
  return rowsToDelete.length;
}
function patch_(n, k, val, p) {
  const r = objs_(n).find((x) => s_(x[k]) === s_(val));
  if (!r) throw Error("Registo não encontrado.");
  Object.keys(p).forEach((x) => (r[x] = p[x]));
  upsert_(n, k, r);
}
function del_(n, p) {
  const sh = SpreadsheetApp.getActive().getSheetByName(n),
    r = objs_(n);
  for (let i = r.length - 1; i >= 0; i--) if (p(r[i])) sh.deleteRow(i + 2);
}
function photoFolder_() {
  const p = PropertiesService.getDocumentProperties(),
    id = p.getProperty("GDR_PHOTOS_FOLDER_ID");
  try {
    if (id) return DriveApp.getFolderById(id);
  } catch (e) {}
  const f = DriveApp.createFolder("GDR Formação 360 - Fotografias");
  p.setProperty("GDR_PHOTOS_FOLDER_ID", f.getId());
  return f;
}
function photo_(d, n) {
  const m = String(d).match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!m) throw Error("Fotografia inválida.");
  const f = photoFolder_().createFile(
    Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], s_(n) + ".jpg"),
  );
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    id: f.getId(),
    url: "https://drive.google.com/uc?export=view&id=" + f.getId(),
  };
}
function pub_(u) {
  return {
    id: s_(u.ID),
    username: s_(u.Utilizador),
    name: s_(u.Nome),
    role: s_(u.Perfil),
    active: bool_(u.Ativo),
    phone: s_(u.Telefone),
    athleteIds: arr_(u.AtletaIDs),
  };
}
function s_(v) {
  return v == null ? "" : String(v).trim();
}
function bool_(v) {
  return (
    v === true ||
    ["true", "sim", "1", "ativo"].indexOf(s_(v).toLowerCase()) >= 0
  );
}
function num_(v) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}
function arr_(v) {
  if (Array.isArray(v)) return v;
  try {
    const a = JSON.parse(s_(v) || "[]");
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return s_(v) ? s_(v).split("|") : [];
  }
}
function date_(v) {
  if (!v) return "";
  return Object.prototype.toString.call(v) === "[object Date]"
    ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd")
    : s_(v).slice(0, 10);
}
function time_(v) {
  if (!v) return "";
  return Object.prototype.toString.call(v) === "[object Date]"
    ? Utilities.formatDate(v, Session.getScriptTimeZone(), "HH:mm")
    : s_(v).slice(0, 5);
}
function iso_(v) {
  if (!v) return "";
  try {
    return new Date(v).toISOString();
  } catch (e) {
    return s_(v);
  }
}
function hash_(p) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(p),
    Utilities.Charset.UTF_8,
  )
    .map((b) => ("0" + (b < 0 ? b + 256 : b).toString(16)).slice(-2))
    .join("");
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
