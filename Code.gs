/** GDR Formação 360 — backend v17.9. */
const VERSION = "17.9.0",
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
    "DataNascimento",
    "CartaoJogadorFotoURL",
    "CartaoJogadorFotoID",
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
    "ComprovativoEntregue",
    "DataEntregaComprovativo",
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
    "Equipamento",
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
  TRAINING_SUMMARIES: [
    "ID", "TreinoID", "AtletaID", "Texto", "DadosJSON", "GeradoEm", "Versao",
  ],
  ANNOUNCEMENTS: [
    "ID", "Titulo", "Mensagem", "Escalao", "Prioridade", "DataInicio",
    "DataFim", "Ativo", "CriadoPor", "CriadoEm",
  ],
  NOTIFICATION_READS: ["ID", "UtilizadorID", "Chave", "LidoEm"],
  ATHLETE_SAFETY: [
    "ID", "AtletaID", "Contacto1Nome", "Contacto1Relacao", "Contacto1Telefone",
    "Contacto2Nome", "Contacto2Relacao", "Contacto2Telefone", "PessoasAutorizadas",
    "AlertasCriticos", "MedicacaoEmergencia", "LimitacoesTemporarias",
    "InstrucoesEmergencia", "Consentimento", "ConfirmadoPor", "ConfirmadoEm",
    "AtualizadoPor", "AtualizadoEm",
  ],
  SAFETY_ACCESS_LOG: [
    "ID", "AtletaID", "UtilizadorID", "Perfil", "Acao", "Motivo", "CriadoEm",
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
  let mutationCacheKey = "";
  try {
    resetRequestCache_();
    const b = JSON.parse((e.postData && e.postData.contents) || "{}"),
      a = s_(b.action);
    if (a === "login") return json_(login_(b));
    const u = session_(b.token);
    if (a === "mutationStatus") return json_(mutationStatus_(b, u));
    if (
      u.role === "parent" &&
      [
        "getData",
        "syncStatus",
        "saveGameAvailability",
        "savePlannedAbsence",
        "deletePlannedAbsence",
        "saveSafetyProfile",
        "logSafetyAccess",
        "markNotificationsRead",
      ].indexOf(a) < 0
    )
      throw Error("Ação não permitida no Portal dos Pais.");
    const h = {
      getData: getDataCached_,
      syncStatus: syncStatus_,
      saveTraining: saveTraining_,
      deleteTraining: deleteTraining_,
      saveCallup: saveCallup_,
      saveAthlete: saveAthlete_,
      deleteAthlete: deleteAthlete_,
      saveUser: saveUser_,
      toggleUser: toggleUser_,
      deleteUser: deleteUser_,
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
      generateTrainingSummaries: generateTrainingSummaries_,
      saveWeeklySettings: saveWeeklySettings_,
      sendWeeklySummary: sendWeeklySummaryNow_,
      saveSafetyProfile: saveSafetyProfile_,
      logSafetyAccess: logSafetyAccess_,
      saveAnnouncement: saveAnnouncement_,
      deleteAnnouncement: deleteAnnouncement_,
      markNotificationsRead: markNotificationsRead_,
    };
    if (!h[a]) throw Error("Ação inválida.");
    if (b.mutationId) {
      mutationCacheKey = mutationKey_(u, b.mutationId);
      const previous = claimMutation_(mutationCacheKey);
      if (previous) {
        if (previous === "PENDING") return json_({ ok: true, pending: true });
        try { return json_(JSON.parse(previous)); } catch (ignore) {}
      }
    }
    const result = h[a](b, u);
    if (["getData", "syncStatus", "logSafetyAccess", "markNotificationsRead", "sendWeeklySummary"].indexOf(a) < 0)
      touchData_();
    if (mutationCacheKey)
      CacheService.getScriptCache().put(mutationCacheKey, JSON.stringify(result), 21600);
    return json_(result);
  } catch (e2) {
    if (mutationCacheKey) CacheService.getScriptCache().remove(mutationCacheKey);
    return json_({ ok: false, error: String(e2.message || e2) });
  }
}

function mutationKey_(u, mutationId) {
  return "mutation_" + hash_([u.id, s_(mutationId)].join("|")).slice(0, 48);
}
function claimMutation_(key) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache(), previous = cache.get(key);
    if (!previous) cache.put(key, "PENDING", 600);
    return previous;
  } finally { lock.releaseLock(); }
}
function mutationStatus_(b, u) {
  const id = s_(b.mutationId);
  if (!id) throw Error("Identificador de gravação inválido.");
  const saved = CacheService.getScriptCache().get(mutationKey_(u, id));
  if (!saved || saved === "PENDING") return { ok: true, pending: true };
  try { return JSON.parse(saved); }
  catch (ignore) { return { ok: true, pending: true }; }
}
function login_(b) {
  const un = s_(b.username).toLowerCase(),
    ph = hash_(s_(b.pin)),
    accessVersion = userAccessVersion_(),
    loginKey = "login_" + hash_([un, ph, accessVersion].join("|")),
    cachedUser = CacheService.getScriptCache().get(loginKey);
  let publicUser = null;
  if (cachedUser) {
    try { publicUser = JSON.parse(cachedUser); } catch (ignore) {}
  }
  const u = publicUser ? null : objs_("USERS").find(
      (x) =>
        s_(x.Utilizador).toLowerCase() === un &&
        s_(x.PIN_HASH) === ph &&
        bool_(x.Ativo),
    );
  if (!publicUser && !u) return { ok: false, error: "Credenciais inválidas" };
  if (!publicUser) {
    publicUser = pub_(u);
    CacheService.getScriptCache().put(loginKey, JSON.stringify(publicUser), 21600);
  }
  const t = createSessionToken_(publicUser);
  cacheSession_(t, publicUser);
  return {
    ok: true,
    token: t,
    user: publicUser,
  };
}
function session_(t) {
  const cached = CacheService.getScriptCache().get("session_" + hash_(s_(t)));
  if (cached) {
    try {
      const session = JSON.parse(cached);
      if (session.user && session.accessVersion === userAccessVersion_())
        return session.user;
    } catch (ignore) {}
  }
  const signedUser = signedSession_(t);
  if (signedUser) {
    cacheSession_(t, signedUser);
    return signedUser;
  }
  const x = objs_("SESSIONS").find(
    (r) => s_(r.Token) === s_(t) && new Date(r.ExpiraEm).getTime() > Date.now(),
  );
  if (!x) throw Error("Sessão expirada. Volta a iniciar sessão.");
  const u = objs_("USERS").find(
    (r) => s_(r.ID) === s_(x.UtilizadorID) && bool_(r.Ativo),
  );
  if (!u) throw Error("Utilizador sem acesso.");
  const publicUser = pub_(u);
  cacheSession_(t, publicUser);
  return publicUser;
}
function sessionSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("SESSION_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("SESSION_SECRET", secret);
  }
  return secret;
}
function createSessionToken_(user) {
  const payload = Utilities.base64EncodeWebSafe(
      JSON.stringify({
        u: user,
        e: Date.now() + SESSION_HOURS * 36e5,
        v: userAccessVersion_(),
      }),
    ).replace(/=+$/g, ""),
    signature = Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(payload, sessionSecret_()),
    ).replace(/=+$/g, "");
  return payload + "." + signature;
}
function signedSession_(token) {
  try {
    const parts = s_(token).split(".");
    if (parts.length !== 2) return null;
    const expected = Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(parts[0], sessionSecret_()),
    ).replace(/=+$/g, "");
    if (expected !== parts[1]) return null;
    const payload = JSON.parse(
      Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString(),
    );
    if (
      !payload.u ||
      Number(payload.e) <= Date.now() ||
      payload.v !== userAccessVersion_()
    ) return null;
    return payload.u;
  } catch (ignore) {
    return null;
  }
}
function cacheSession_(token, user) {
  CacheService.getScriptCache().put(
    "session_" + hash_(s_(token)),
    JSON.stringify({ user: user, accessVersion: userAccessVersion_() }),
    21600,
  );
}
function userAccessVersion_() {
  const cache = CacheService.getScriptCache(),
    cached = cache.get("USER_ACCESS_VERSION_FAST");
  if (cached) return cached;
  const stored =
    PropertiesService.getDocumentProperties().getProperty(
      "USER_ACCESS_VERSION",
    ) || "1";
  cache.put("USER_ACCESS_VERSION_FAST", stored, 21600);
  return stored;
}
function touchUserAccess_() {
  const version = new Date().getTime() + "_" + Utilities.getUuid();
  PropertiesService.getDocumentProperties().setProperty(
    "USER_ACCESS_VERSION",
    version,
  );
  CacheService.getScriptCache().put(
    "USER_ACCESS_VERSION_FAST",
    version,
    21600,
  );
}
function dataVersion_() {
  const cache = CacheService.getScriptCache(), fast = cache.get("DATA_VERSION_FAST");
  if (fast) return fast;
  const stored = PropertiesService.getDocumentProperties().getProperty("DATA_VERSION") || "1";
  cache.put("DATA_VERSION_FAST", stored, 21600);
  return stored;
}
function touchData_() {
  // A versão dos dados não necessita de uma escrita persistente e lenta em
  // PropertiesService em cada alteração. O ScriptCache é partilhado por todos
  // os utilizadores e faz a invalidação imediatamente.
  CacheService.getScriptCache().put(
    "DATA_VERSION_FAST",
    new Date().getTime() + "_" + Utilities.getUuid(),
    21600,
  );
}
function cacheJsonGet_(key) {
  try {
    const cache = CacheService.getScriptCache(),
      count = Number(cache.get(key + "_count") || 0);
    if (!count) return null;
    let encoded = "";
    for (let i = 0; i < count; i++) {
      const part = cache.get(key + "_" + i);
      if (!part) return null;
      encoded += part;
    }
    const json = Utilities.ungzip(
      Utilities.newBlob(Utilities.base64Decode(encoded)),
    ).getDataAsString();
    return JSON.parse(json);
  } catch (ignore) {
    return null;
  }
}
function cacheJsonPut_(key, value, ttl) {
  try {
    const encoded = Utilities.base64Encode(
        Utilities.gzip(Utilities.newBlob(JSON.stringify(value))).getBytes(),
      ),
      size = 80000,
      count = Math.ceil(encoded.length / size),
      values = {};
    values[key + "_count"] = String(count);
    for (let i = 0; i < count; i++)
      values[key + "_" + i] = encoded.slice(i * size, (i + 1) * size);
    CacheService.getScriptCache().putAll(values, ttl || 300);
  } catch (ignore) {}
}
function getDataCached_(b, u) {
  const identity = [u.id, u.role, (u.athleteIds || []).join("|")].join("_"),
    day = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyyMMdd",
    ),
    key =
      "data_" + hash_(identity).slice(0, 20) + "_" + dataVersion_() + "_" + day,
    cached = cacheJsonGet_(key);
  if (cached) return cached;
  const result = getData_(b, u);
  cacheJsonPut_(key, result, 300);
  return result;
}
function syncStatus_() {
  return { ok: true, revision: dataVersion_(), version: VERSION };
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
      revision: dataVersion_(),
      athletes: objs_("ATHLETES").map((r) => ({
        id: s_(r.ID),
        name: s_(r.Nome),
        group: s_(r.Escalao),
        active: bool_(r.Ativo),
        photoUrl: s_(r.FotoURL),
        redNumber: s_(r.NumeroVermelho),
        whiteNumber: s_(r.NumeroBranco),
        birthDate: date_(r.DataNascimento),
        playerCardPhotoUrl: s_(r.CartaoJogadorFotoURL),
        createdAt: iso_(r.CriadoEm),
        updatedAt: iso_(r.AtualizadoEm),
      })),
      birthdaysToday: birthdayNotices_(),
      challengeBoard: challengeBoard_(),
      trainings: objs_("TRAININGS").map((r) => ({
        id: s_(r.ID),
        date: date_(r.Data),
        time: time_(r.Hora),
        group: s_(r.Escalao),
      })),
      records: effectiveTrainingRecords_().map((r) => ({
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
        proofDelivered: bool_(r.ComprovativoEntregue),
        proofDeliveredAt: date_(r.DataEntregaComprovativo),
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
        equipment: s_(r.Equipamento),
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
      trainingSummaries: objs_("TRAINING_SUMMARIES").map((r) => ({
        id: s_(r.ID),
        trainingId: s_(r.TreinoID),
        athleteId: s_(r.AtletaID),
        text: s_(r.Texto),
        generatedAt: iso_(r.GeradoEm),
        version: s_(r.Versao),
      })),
      announcements: objs_("ANNOUNCEMENTS").map((r) => ({
        id: s_(r.ID),
        title: s_(r.Titulo),
        message: s_(r.Mensagem),
        group: s_(r.Escalao) || "Todos",
        priority: s_(r.Prioridade) || "Normal",
        startDate: date_(r.DataInicio),
        endDate: date_(r.DataFim),
        active: s_(r.Ativo) === "" ? true : bool_(r.Ativo),
        createdAt: iso_(r.CriadoEm),
      })),
      notificationReads: objs_("NOTIFICATION_READS")
        .filter((r) => s_(r.UtilizadorID) === s_(u.id))
        .map((r) => s_(r.Chave))
        .filter(Boolean),
      safetyProfiles: objs_("ATHLETE_SAFETY").filter((r) => bool_(r.Consentimento)).map((r) => ({
        id: s_(r.ID), athleteId: s_(r.AtletaID),
        contact1Name: s_(r.Contacto1Nome), contact1Relation: s_(r.Contacto1Relacao), contact1Phone: s_(r.Contacto1Telefone),
        contact2Name: s_(r.Contacto2Nome), contact2Relation: s_(r.Contacto2Relacao), contact2Phone: s_(r.Contacto2Telefone),
        authorizedPickup: s_(r.PessoasAutorizadas), criticalAlerts: s_(r.AlertasCriticos),
        emergencyMedication: s_(r.MedicacaoEmergencia), temporaryLimitations: s_(r.LimitacoesTemporarias),
        emergencyInstructions: s_(r.InstrucoesEmergencia), confirmedAt: iso_(r.ConfirmadoEm), updatedAt: iso_(r.AtualizadoEm),
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
  data.trainingSummaries = data.trainingSummaries.filter((s) =>
    allowed.has(s.athleteId),
  );
  data.safetyProfiles = data.safetyProfiles.filter((s) => allowed.has(s.athleteId));
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
  data.announcements = data.announcements.filter(
    (a) => a.group === "Todos" || allowedGroups.has(a.group),
  );
  data.challengeBoard.athletes = (data.challengeBoard.athletes || []).filter(
    (a) => allowedGroups.has(a.group) || (a.group === "Traquinas/Benjamins" && (allowedGroups.has("Traquinas") || allowedGroups.has("Benjamins"))),
  );
  data.challengeBoard.collective = (data.challengeBoard.collective || []).filter(
    (item) => allowedGroups.has(item.group),
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

function challengeCatalog_() {
  return {
    weekly: [
      { id: "energia", title: "Energia GDR", description: "Empenho de nível elevado em dois treinos da semana.", type: "average", field: "Empenho", target: 4, minimum: 2, badge: 0 },
      { id: "sempre_presente", title: "Sempre Presente", description: "Participar em todos os treinos da semana, com um mínimo de dois.", type: "attendance", target: 1, minimum: 2, badge: 1 },
      { id: "equipa", title: "Juntos Somos GDR", description: "Receber um reconhecimento de espírito de equipa ou entreajuda.", type: "tag", tags: ["espírito de equipa", "entreajuda", "companheiro"], target: 1, badge: 2 },
      { id: "passo_frente", title: "Passo em Frente", description: "Evoluir do primeiro para o último treino da semana.", type: "improvement", target: 0.5, minimum: 2, badge: 3 },
      { id: "fair_play", title: "Guardião do Fair Play", description: "Comportamento de nível elevado em dois treinos da semana.", type: "average", field: "Comportamento", target: 4, minimum: 2, badge: 4 },
      { id: "atitude", title: "Pronto para Aprender", description: "Atitude positiva e disponível em dois treinos da semana.", type: "average", field: "Atitude", target: 4, minimum: 2, badge: 5 },
      { id: "consistencia", title: "Semana de Ouro", description: "Concluir três treinos com presença e compromisso.", type: "presence", target: 3, badge: 6 },
      { id: "tecnico", title: "Desafio Futebolístico", description: "Somar dois destaques técnico-táticos registados pela equipa técnica.", type: "tag", tags: ["passe", "receção", "finalização", "posicionamento", "tomada de decisão", "transição", "qualidade técnica"], target: 2, badge: 7 },
      { id:"alegria_campo", title:"Alegria em Campo", description:"Demonstrar atitude muito positiva em dois treinos da semana.", type:"average", field:"attitude", target:4.3, minimum:2, badge:8 },
      { id:"motor_ligado", title:"Motor Ligado", description:"Alcançar uma média de empenho muito elevada em dois treinos.", type:"average", field:"effort", target:4.5, minimum:2, badge:9 },
      { id:"dupla_forca", title:"Dupla Força", description:"Equilibrar atitude, empenho e comportamento em dois treinos.", type:"balanced", target:4, minimum:2, badge:10 },
      { id:"cabeca_jogo", title:"Cabeça no Jogo", description:"Manter atitude e concentração de nível elevado em dois treinos.", type:"average", field:"attitude", target:4.2, minimum:2, badge:11 },
      { id:"chuva_destaques", title:"Chuva de Destaques", description:"Reunir três destaques positivos nos treinos da semana.", type:"tag", tags:["empenho","espírito de equipa","evolução","qualidade técnica","passe","receção","finalização","posicionamento","tomada de decisão","transição"], target:3, badge:12 },
      { id:"leao_compromisso", title:"Coração de Leão", description:"Estar presente em três treinos e manter empenho positivo.", type:"average", field:"effort", target:3.8, minimum:3, badge:13 },
      { id:"dois_pes", title:"Dois Pés, Um Sonho", description:"Receber dois destaques de qualidade técnica ou evolução.", type:"tag", tags:["qualidade técnica","evolução"], target:2, badge:14 },
      { id:"passe_magico", title:"Passe Mágico", description:"Conquistar um destaque relacionado com passe ou receção.", type:"tag", tags:["passe","receção"], target:1, badge:15 },
      { id:"rede_estrelas", title:"Rede de Estrelas", description:"Conquistar um destaque relacionado com finalização.", type:"tag", tags:["finalização"], target:1, badge:16 },
      { id:"decisao_certa", title:"Decisão Certa", description:"Conquistar um destaque de tomada de decisão.", type:"tag", tags:["tomada de decisão"], target:1, badge:17 },
      { id:"equilibrio", title:"Equilíbrio GDR", description:"Manter os três indicadores de formação numa média positiva.", type:"balanced", target:3.7, minimum:2, badge:18 },
      { id:"saber_ouvir", title:"Saber Ouvir", description:"Manter atitude muito positiva em três treinos.", type:"average", field:"attitude", target:4, minimum:3, badge:19 },
      { id:"farol_equipa", title:"Farol da Equipa", description:"Combinar comportamento positivo com um destaque de equipa.", type:"heart", target:3.8, minimum:2, badge:20 },
      { id:"bola_salta", title:"A Bola Não Para", description:"Participar em dois treinos e melhorar até ao último.", type:"improvement", target:.3, minimum:2, badge:21 },
      { id:"mao_amiga", title:"Mão Amiga", description:"Somar dois reconhecimentos de entreajuda ou espírito de equipa.", type:"tag", tags:["espírito de equipa","entreajuda","companheiro"], target:2, badge:22 },
      { id:"depois_chuva", title:"Depois da Chuva", description:"Regressar e participar positivamente após uma ausência anterior.", type:"average", field:"attitude", target:3.8, minimum:2, badge:23 },
      { id:"ponte_amizade", title:"Ponte da Amizade", description:"Combinar presença total com um reconhecimento de equipa.", type:"heart", target:3.5, minimum:2, badge:24 },
      { id:"super_ouvinte", title:"Super Ouvinte", description:"Alcançar atitude de nível máximo em pelo menos um treino.", type:"average", field:"attitude", target:5, minimum:1, badge:25 },
      { id:"coragem", title:"Capa da Coragem", description:"Evoluir pelo menos meio ponto durante a semana.", type:"improvement", target:.5, minimum:2, badge:26 },
      { id:"sol_positivo", title:"Sol Positivo", description:"Manter comportamento e atitude positivos em três treinos.", type:"balanced", target:3.8, minimum:3, badge:27 },
      { id:"maos_seguras", title:"Mãos Seguras", description:"Manter comportamento exemplar em dois treinos.", type:"average", field:"behavior", target:4.5, minimum:2, badge:28 },
      { id:"tres_caminhos", title:"Três Caminhos", description:"Somar três destaques técnico-táticos diferentes ou repetidos.", type:"tag", tags:["passe","receção","finalização","posicionamento","tomada de decisão","transição","qualidade técnica"], target:3, badge:29 },
      { id:"primeiro_toque", title:"Primeiro Toque", description:"Receber um destaque de receção ou qualidade técnica.", type:"tag", tags:["receção","qualidade técnica"], target:1, badge:30 },
      { id:"aventura_drible", title:"Aventura com Bola", description:"Combinar dois treinos presentes com evolução positiva.", type:"improvement", target:.25, minimum:2, badge:31 },
      { id:"puzzle_equipa", title:"Peça da Equipa", description:"Receber um reconhecimento de espírito de equipa e manter bom comportamento.", type:"heart", target:3.5, minimum:2, badge:32 },
      { id:"cinco_perfeito", title:"Cinco Perfeito", description:"Alcançar média máxima de comportamento durante a semana.", type:"average", field:"behavior", target:5, minimum:2, badge:33 },
      { id:"mala_pronta", title:"Sempre Preparado", description:"Participar em todos os treinos da semana, com mínimo de três.", type:"attendance", target:1, minimum:3, badge:34 },
      { id:"comboio", title:"Comboio GDR", description:"Construir uma sequência de três presenças na semana.", type:"presence", target:3, badge:35 },
      { id:"regresso", title:"Voltar Mais Forte", description:"Apresentar uma evolução clara entre o primeiro e o último treino.", type:"improvement", target:.7, minimum:2, badge:36 },
      { id:"respeito", title:"Respeito Sempre", description:"Manter comportamento muito positivo em três treinos.", type:"average", field:"behavior", target:4, minimum:3, badge:37 },
      { id:"calma_bola", title:"Calma com Bola", description:"Equilibrar atitude e comportamento ao longo de dois treinos.", type:"balanced", target:4, minimum:2, badge:38 },
      { id:"portal_vitoria", title:"Portal da Vitória", description:"Concluir três treinos com média global superior a quatro.", type:"balanced", target:4.1, minimum:3, badge:39 },
    ],
    monthly: [
      { id: "compromisso_ouro", title: "Compromisso de Ouro", description: "Alcançar pelo menos 90% de assiduidade no mês, com três treinos registados.", type: "attendance", target: 0.9, minimum: 3, badge: 40 },
      { id: "forca_vontade", title: "Força de Vontade", description: "Manter empenho de nível elevado durante o mês.", type: "average", field: "Empenho", target: 4, minimum: 3, badge: 41 },
      { id: "coracao_gdr", title: "Coração GDR", description: "Manter comportamento exemplar e receber um destaque de equipa.", type: "heart", target: 4, minimum: 3, badge: 42 },
      { id: "atleta_completo", title: "Atleta Completo", description: "Equilibrar atitude, empenho e comportamento ao longo do mês.", type: "balanced", target: 3.8, minimum: 3, badge: 43 },
      { id: "evolucao_mes", title: "Evolução do Mês", description: "Terminar o mês com evolução positiva face ao seu início.", type: "improvement", target: 0.5, minimum: 3, badge: 44 },
      { id: "mira_certa", title: "Mira Certa", description: "Somar três destaques técnico-táticos durante o mês.", type: "tag", tags: ["passe", "receção", "finalização", "posicionamento", "tomada de decisão", "transição", "qualidade técnica"], target: 3, badge: 45 },
      { id:"mes_disciplina", title:"Mês da Disciplina", description:"Manter comportamento muito positivo em pelo menos quatro treinos.", type:"average", field:"behavior", target:4, minimum:4, badge:46 },
      { id:"montanha", title:"Subida ao Topo", description:"Evoluir de forma clara entre o início e o final do mês.", type:"improvement", target:.7, minimum:4, badge:47 },
      { id:"familia_equipa", title:"Família em Campo", description:"Somar três reconhecimentos de equipa, respeito ou entreajuda.", type:"tag", tags:["espírito de equipa","entreajuda","companheiro","respeito"], target:3, badge:48 },
      { id:"mes_total", title:"Mês Completo", description:"Alcançar média superior a quatro nos três indicadores de formação.", type:"balanced", target:4.1, minimum:4, badge:49 },
    ],
  };
}
function monday_(value) {
  const d = new Date(value || new Date()), day = d.getDay() || 7;
  d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - day + 1);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}
function plusDays_(date, days) {
  const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}
function currentChallenges_() {
  const catalog = challengeCatalog_(), now = new Date(), start = monday_(now),
    weekSerial = Math.floor(new Date(start + "T12:00:00").getTime() / 604800000),
    month = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM"),
    parts = month.split("-"), monthSerial = Number(parts[0]) * 12 + Number(parts[1]) - 1,
    monthEndDate = new Date(Number(parts[0]), Number(parts[1]), 0),
    monthEnd = Utilities.formatDate(monthEndDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return {
    weekly: Object.assign({}, catalog.weekly[Math.abs(weekSerial) % catalog.weekly.length], { period: start, start: start, end: plusDays_(start, 6), cadence: "weekly" }),
    monthly: Object.assign({}, catalog.monthly[Math.abs(monthSerial) % catalog.monthly.length], { period: month, start: month + "-01", end: monthEnd, cadence: "monthly" }),
  };
}
function evaluateChallenge_(challenge, records) {
  const rr = records.slice().sort((a, b) => s_(a.DataTreino).localeCompare(s_(b.DataTreino))),
    present = rr.filter((r) => s_(r.Presenca) === "Presente"),
    fields = { effort: "Empenho", attitude: "Atitude", behavior: "Comportamento" },
    average = (field) => { field = fields[field] || field; return present.length ? present.reduce((sum, r) => sum + num_(r[field]), 0) / present.length : 0; },
    allTags = present.reduce((out, r) => out.concat(arr_(r.Tags).map((x) => s_(x).toLowerCase())), []);
  let value = 0, earned = false;
  if (challenge.type === "presence") { value = present.length; earned = value >= challenge.target; }
  else if (challenge.type === "attendance") { value = rr.length ? present.length / rr.length : 0; earned = rr.length >= challenge.minimum && value >= challenge.target; }
  else if (challenge.type === "average") { value = average(challenge.field); earned = present.length >= challenge.minimum && value >= challenge.target; }
  else if (challenge.type === "tag") { value = allTags.filter((tag) => challenge.tags.some((key) => tag.indexOf(key) >= 0)).length; earned = value >= challenge.target; }
  else if (challenge.type === "improvement") {
    value = present.length >= 2 ? (["Atitude", "Empenho", "Comportamento"].reduce((sum, field) => sum + num_(present[present.length - 1][field]) - num_(present[0][field]), 0) / 3) : 0;
    earned = present.length >= challenge.minimum && value >= challenge.target;
  } else if (challenge.type === "balanced") { value = ["Atitude", "Empenho", "Comportamento"].reduce((sum, field) => sum + average(field), 0) / 3; earned = present.length >= challenge.minimum && value >= challenge.target; }
  else if (challenge.type === "heart") { value = average("Comportamento"); earned = present.length >= challenge.minimum && value >= challenge.target && allTags.some((tag) => ["espírito de equipa", "entreajuda", "companheiro"].some((key) => tag.indexOf(key) >= 0)); }
  const countFactor = challenge.minimum ? Math.min(1, present.length / challenge.minimum) : 1,
    progress = challenge.type === "attendance" ? Math.min(100, Math.round(value / challenge.target * 100 * countFactor)) :
      challenge.type === "average" || challenge.type === "balanced" || challenge.type === "heart" ? Math.min(100, Math.round(value / challenge.target * 100 * countFactor)) :
      challenge.type === "improvement" ? Math.min(100, Math.max(0, Math.round(value / challenge.target * 100 * countFactor))) : Math.min(100, Math.round(value / challenge.target * 100));
  return { earned: earned, progress: earned ? 100 : progress, value: value };
}
function challengeBoard_() {
  const challenges = currentChallenges_(), trainings = objs_("TRAININGS"), byTraining = {};
  trainings.forEach((t) => byTraining[s_(t.ID)] = date_(t.Data));
  const records = effectiveTrainingRecords_().map((r) => Object.assign({}, r, { DataTreino: byTraining[s_(r.TreinoID)] || "" })),
    athletes = objs_("ATHLETES").filter((a) => bool_(a.Ativo)).map((a) => {
      const own = records.filter((r) => s_(r.AtletaID) === s_(a.ID)),
        weekly = own.filter((r) => r.DataTreino >= challenges.weekly.start && r.DataTreino <= challenges.weekly.end),
        monthly = own.filter((r) => r.DataTreino >= challenges.monthly.start && r.DataTreino <= challenges.monthly.end);
      return { athleteId: s_(a.ID), name: s_(a.Nome), group: s_(a.Escalao), photoUrl: s_(a.FotoURL), weekly: evaluateChallenge_(challenges.weekly, weekly), monthly: evaluateChallenge_(challenges.monthly, monthly) };
    }),
    collectiveNames = [
      ["Todos em Campo", "Se 80% do escalão conquistar o desafio semanal, todos recebem este patch coletivo."],
      ["Constelação GDR", "O escalão une esforços para chegar aos 80% de conquistadores esta semana."],
      ["Equipa Fair Play", "Cada conquista aproxima todo o escalão do patch coletivo da semana."],
      ["Família GDR", "Um objetivo partilhado: 80% do escalão a concluir o desafio semanal."],
    ],
    monthNumber = Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM")) - 1,
    collective = ["Traquinas", "Benjamins"].map((group) => {
      const groupAthletes = athletes.filter((a) => a.group === group || a.group === "Traquinas/Benjamins"),
        earned = groupAthletes.filter((a) => a.weekly.earned).length,
        progress = groupAthletes.length ? Math.round(earned / groupAthletes.length * 100) : 0,
        selected = collectiveNames[monthNumber % collectiveNames.length];
      return { group: group, title: selected[0], description: selected[1], badge: 58 + monthNumber % 4, progress: progress, earned: groupAthletes.length > 0 && progress >= 80, earnedCount: earned, total: groupAthletes.length };
    });
  return { weekly: challenges.weekly, monthly: challenges.monthly, athletes: athletes, collective: collective };
}

function birthdayNotices_() {
  const now = new Date(),
    tz = Session.getScriptTimeZone(),
    today = Utilities.formatDate(now, tz, "MM-dd"),
    year = Number(Utilities.formatDate(now, tz, "yyyy"));
  return objs_("ATHLETES")
    .filter((a) => bool_(a.Ativo) && date_(a.DataNascimento).slice(5) === today)
    .map((a) => {
      const birthDate = date_(a.DataNascimento),
        age = year - Number(birthDate.slice(0, 4));
      return {
        athleteId: s_(a.ID),
        name: s_(a.Nome),
        group: s_(a.Escalao),
        photoUrl: s_(a.FotoURL),
        age: age,
        message:
          "Hoje " + s_(a.Nome) + " celebra " + age +
          " anos. Toda a família GDR deseja-lhe um dia muito feliz!",
      };
    });
}

function safetyAccess_(u, athleteId, write) {
  const athlete = objs_("ATHLETES").find((a) => s_(a.ID) === s_(athleteId) && bool_(a.Ativo));
  if (!athlete) throw Error("Atleta não encontrado.");
  if (u.role === "parent" && (u.athleteIds || []).indexOf(s_(athleteId)) < 0)
    throw Error("Não tens acesso aos dados deste atleta.");
  if (write && u.role !== "admin" && u.role !== "parent")
    throw Error("A equipa técnica pode consultar, mas não alterar a ficha de segurança.");
  return athlete;
}
function safetyText_(value, max) {
  return s_(value).slice(0, max || 1000);
}
function saveSafetyProfile_(b, u) {
  const p = b.profile || {}, athleteId = s_(p.athleteId);
  safetyAccess_(u, athleteId, true);
  if (!bool_(p.consent)) throw Error("É necessário confirmar o consentimento para guardar esta informação.");
  if (!s_(p.contact1Name) || s_(p.contact1Phone).replace(/\D/g, "").length < 9)
    throw Error("Indica um contacto principal e um número de telefone válido.");
  const now = new Date(), id = "safety_" + athleteId;
  upsert_("ATHLETE_SAFETY", "ID", {
    ID: id, AtletaID: athleteId,
    Contacto1Nome: safetyText_(p.contact1Name, 120), Contacto1Relacao: safetyText_(p.contact1Relation, 80), Contacto1Telefone: safetyText_(p.contact1Phone, 40),
    Contacto2Nome: safetyText_(p.contact2Name, 120), Contacto2Relacao: safetyText_(p.contact2Relation, 80), Contacto2Telefone: safetyText_(p.contact2Phone, 40),
    PessoasAutorizadas: safetyText_(p.authorizedPickup, 1000), AlertasCriticos: safetyText_(p.criticalAlerts, 1000),
    MedicacaoEmergencia: safetyText_(p.emergencyMedication, 1000), LimitacoesTemporarias: safetyText_(p.temporaryLimitations, 1000),
    InstrucoesEmergencia: safetyText_(p.emergencyInstructions, 1500), Consentimento: true,
    ConfirmadoPor: u.id, ConfirmadoEm: now, AtualizadoPor: u.id, AtualizadoEm: now,
  });
  append_("SAFETY_ACCESS_LOG", { ID: Utilities.getUuid(), AtletaID: athleteId, UtilizadorID: u.id, Perfil: u.role, Acao: "Atualização", Motivo: "Ficha confirmada", CriadoEm: now });
  return { ok: true, id: id };
}
function logSafetyAccess_(b, u) {
  const athleteId = s_(b.athleteId);
  safetyAccess_(u, athleteId, false);
  append_("SAFETY_ACCESS_LOG", { ID: Utilities.getUuid(), AtletaID: athleteId, UtilizadorID: u.id, Perfil: u.role, Acao: safetyText_(b.accessAction || "Consulta", 80), Motivo: safetyText_(b.reason || "Abertura da ficha", 200), CriadoEm: new Date() });
  return { ok: true };
}
function saveAnnouncement_(b, u) {
  availabilityOwner_(u);
  const a = b.announcement || {},
    title = s_(a.title),
    message = s_(a.message),
    startDate = date_(a.startDate),
    endDate = date_(a.endDate);
  if (!title || !message) throw Error("Preenche o título e a mensagem do aviso.");
  if (endDate && startDate && endDate < startDate)
    throw Error("A data final não pode ser anterior à data de publicação.");
  const id = s_(a.id) || "ann_" + Utilities.getUuid();
  const saved = {
    ID: id,
    Titulo: title,
    Mensagem: message,
    Escalao: ["Traquinas", "Benjamins"].indexOf(s_(a.group)) >= 0 ? s_(a.group) : "Todos",
    Prioridade: ["Urgente", "Importante"].indexOf(s_(a.priority)) >= 0 ? s_(a.priority) : "Normal",
    DataInicio: startDate,
    DataFim: endDate,
    Ativo: a.active !== false,
    CriadoPor: u.id,
    CriadoEm: new Date(),
  };
  upsert_("ANNOUNCEMENTS", "ID", saved);
  return {
    ok: true,
    id: id,
    announcement: {
      id: id, title: title, message: message,
      group: saved.Escalao, priority: saved.Prioridade,
      startDate: startDate, endDate: endDate, active: saved.Ativo,
      createdBy: u.id, createdAt: iso_(saved.CriadoEm),
    },
  };
}
function deleteAnnouncement_(b, u) {
  availabilityOwner_(u);
  const id = s_(b.id);
  if (!id) throw Error("Aviso inválido.");
  del_("ANNOUNCEMENTS", (r) => s_(r.ID) === id);
  return { ok: true };
}
function markNotificationsRead_(b, u) {
  const keys = (b.keys || []).map(s_).filter(Boolean).slice(0, 100),
    now = new Date();
  upsertMany_(
    "NOTIFICATION_READS",
    "ID",
    keys.map((key) => ({
      ID: s_(u.id) + "|" + key,
      UtilizadorID: u.id,
      Chave: key,
      LidoEm: now,
    })),
  );
  return { ok: true };
}
function saveTraining_(b, u) {
  const t = b.training || {},
    rs = b.records || [];
  if (!s_(t.id) || !date_(t.date)) throw Error("Treino inválido.");
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
    const lock = LockService.getDocumentLock();
    lock.waitLock(10000);
    try {
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
    } finally {
      lock.releaseLock();
    }
    return {
      ok: true,
      training: {
        id: s_(t.id),
        date: date_(t.date),
        time: time_(t.time),
        group: s_(t.group),
      },
      savedRecords: records.map((r) => ({
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
      records: records.length,
    };
}

function deleteTraining_(b, u) {
  admin_(u);
  const id = s_(b.id);
  if (!id || !objs_("TRAININGS").some((t) => s_(t.ID) === id))
    throw Error("Treino não encontrado.");
  del_("RECORDS", (r) => s_(r.TreinoID) === id);
  del_("TRAINING_SUMMARIES", (r) => s_(r.TreinoID) === id);
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
  const existing = objs_("GAME_AVAILABILITY");
  const updates = rows.map((x) => {
    if (!s_(x.athleteId) || valid.indexOf(s_(x.status)) < 0)
      throw Error("Disponibilidade inválida.");
    const old = existing.find(
        (r) =>
          (s_(r.EventoID) || s_(r.JogoID)) === eventId &&
          (s_(r.Escalao) || group) === group &&
          s_(r.AtletaID) === s_(x.athleteId),
      ),
      id = old ? old.ID : "ga_" + Utilities.getUuid();
    return {
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
    };
  });
  upsertMany_("GAME_AVAILABILITY", "ID", updates);
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
  replaceRows_(
    "CALLUPS",
    (r) => s_(r.JogoID) === s_(g.id),
    cs.map((c) => ({
      ID: c.id || Utilities.getUuid(),
      JogoID: g.id,
      AtletaID: c.athleteId,
      Estado: c.status || "Convocado",
      Score: c.score || 0,
      CriadoPor: u.id,
      CriadoEm: new Date(),
      PosicaoX: c.x || "",
      PosicaoY: c.y || "",
    })),
  );
  return { ok: true };
}
function saveAthlete_(b, u) {
  admin_(u);
  const a = b.athlete || {};
  if (!s_(a.name)) throw Error("Indica o nome do atleta.");
  if (s_(a.birthDate) && !/^\d{4}-\d{2}-\d{2}$/.test(s_(a.birthDate)))
    throw Error("A data de nascimento é inválida.");
  if (s_(a.birthDate) > Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"))
    throw Error("A data de nascimento não pode ser futura.");
  const old = objs_("ATHLETES").find((x) => s_(x.ID) === s_(a.id)),
    id = s_(a.id) || "a_" + Utilities.getUuid();
  let url = old ? s_(old.FotoURL) : "",
    fid = old ? s_(old.FotoID) : "",
    cardUrl = old ? s_(old.CartaoJogadorFotoURL) : "",
    cardFid = old ? s_(old.CartaoJogadorFotoID) : "";
  if (b.photoBase64) {
    const f = photo_(b.photoBase64, a.name);
    url = f.url;
    fid = f.id;
  }
  if (b.playerCardPhotoBase64) {
    availabilityOwner_(u);
    const card = photo_(b.playerCardPhotoBase64, a.name + " - Cartão de jogador");
    cardUrl = card.url;
    cardFid = card.id;
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
    DataNascimento: a.birthDate,
    CartaoJogadorFotoURL: cardUrl,
    CartaoJogadorFotoID: cardFid,
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
  touchUserAccess_();
  return { ok: true, id: id };
}
function toggleUser_(b, u) {
  availabilityOwner_(u);
  if (s_(b.id) === s_(u.id) && !b.active)
    throw Error("Não podes desativar a tua conta.");
  patch_("USERS", "ID", b.id, { Ativo: !!b.active, AtualizadoEm: new Date() });
  touchUserAccess_();
  return { ok: true };
}
function deleteUser_(b, u) {
  availabilityOwner_(u);
  const id = s_(b.id), target = objs_("USERS").find((x) => s_(x.ID) === id);
  if (!target) throw Error("Utilizador não encontrado.");
  if (id === s_(u.id)) throw Error("Não podes eliminar a tua própria conta.");
  del_("USERS", (x) => s_(x.ID) === id);
  touchUserAccess_();
  return { ok: true, id: id };
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
    ComprovativoEntregue: f.status === "Pago" && !!f.proofDelivered,
    DataEntregaComprovativo:
      f.status === "Pago" && f.proofDelivered
        ? s_(f.proofDeliveredAt) || date_(old && old.DataEntregaComprovativo) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")
        : "",
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
function generateTrainingSummaries_(b, u) {
  if (u.role === "parent") throw Error("Ação não permitida.");
  const trainingId = s_(b.trainingId),
    training = objs_("TRAININGS").find((t) => s_(t.ID) === trainingId);
  if (!training) throw Error("Treino não encontrado.");
  const records = effectiveTrainingRecords_().filter(
      (r) => s_(r.TreinoID) === trainingId,
    ),
    input = records.map((r) => ({
      athleteId: s_(r.AtletaID),
      status: s_(r.Presenca),
      attitude: num_(r.Atitude),
      effort: num_(r.Empenho),
      behavior: num_(r.Comportamento),
      tags: arr_(r.Tags),
      note: s_(r.Observacao),
      absenceReason: s_(r.MotivoFalta),
    }));
  let generated = [];
  const apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY"),
    model =
      PropertiesService.getScriptProperties().getProperty("OPENAI_MODEL") ||
      "gpt-5.4-mini";
  if (apiKey && input.length) {
    try {
      const response = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + apiKey },
          muteHttpExceptions: true,
          payload: JSON.stringify({
            model: model,
            store: false,
            max_output_tokens: Math.min(4000, 180 + input.length * 100),
            instructions:
              "Recebes registos de avaliação de um treino de futebol juvenil. Devolve apenas JSON válido no formato {\"summaries\":[{\"athleteId\":\"...\",\"text\":\"...\"}]}. Produz para cada atleta um texto em português europeu, com 2 a 4 frases e máximo 85 palavras. Usa linguagem de formação futebolística: intensidade e compromisso para empenho; disponibilidade para executar tarefas e receber correções para atitude; concentração, disciplina e integração coletiva para comportamento. Usa indicadores técnico-táticos como passe/receção, posicionamento, tomada de decisão, transição ou finalização apenas quando constarem das tags ou da observação. Integra a observação sem a copiar mecanicamente. Não inventes ações, exercícios, posições ou capacidades. Linguagem construtiva, adequada às famílias, sem comparações, diagnósticos ou notas numéricas. Se faltou, explica apenas o estado e o motivo disponível.",
            input: JSON.stringify({
              date: date_(training.Data),
              group: s_(training.Escalao),
              athletes: input,
            }),
          }),
        }),
        body = JSON.parse(response.getContentText() || "{}"),
        texts = [];
      (body.output || []).forEach((item) =>
        (item.content || []).forEach((content) => {
          if (content.type === "output_text" && content.text)
            texts.push(content.text);
        }),
      );
      const parsed = JSON.parse(
        texts.join("").replace(/^```json\s*|\s*```$/g, "").trim(),
      );
      generated = Array.isArray(parsed.summaries) ? parsed.summaries : [];
    } catch (ignore) {
      generated = [];
    }
  }
  const byId = {};
  generated.forEach((x) => (byId[s_(x.athleteId)] = s_(x.text)));
  const now = new Date(),
    rows = input.map((record) => ({
      ID: "ts_" + trainingId + "_" + record.athleteId,
      TreinoID: trainingId,
      AtletaID: record.athleteId,
      Texto:
        byId[record.athleteId] || trainingSummaryFallback_(record),
      DadosJSON: JSON.stringify(record),
      GeradoEm: now,
      Versao: "2",
    }));
  upsertMany_("TRAINING_SUMMARIES", "ID", rows);
  return {
    ok: true,
    summaries: rows.map((r) => ({
      id: r.ID,
      trainingId: r.TreinoID,
      athleteId: r.AtletaID,
      text: r.Texto,
      generatedAt: now.toISOString(),
      version: "2",
    })),
  };
}
function trainingSummaryFallback_(r) {
  if (r.status !== "Presente")
    return r.status === "Justificada"
      ? "A ausência deste treino ficou justificada" +
          (r.absenceReason ? " por " + r.absenceReason.toLowerCase() : "") +
          "."
      : "O atleta não esteve presente neste treino" +
          (r.absenceReason ? " devido a " + r.absenceReason.toLowerCase() : "") +
          ".";
  const positives = [];
  if (r.effort >= 4)
    positives.push("manteve boa intensidade e compromisso na execução das tarefas");
  else if (r.effort <= 2)
    positives.push("necessita de aumentar a intensidade e a continuidade do esforço");
  if (r.attitude >= 4)
    positives.push("mostrou disponibilidade para receber indicações e responder às propostas do treino");
  else if (r.attitude <= 2)
    positives.push("deve melhorar a disponibilidade para executar e corrigir");
  if (r.behavior >= 4)
    positives.push("manteve concentração, disciplina e boa integração no trabalho coletivo");
  else if (r.behavior <= 2)
    positives.push("precisa de reforçar a concentração e o comportamento dentro da dinâmica coletiva");
  const tags = (r.tags || []).slice(0, 3).join(", ");
  let text = positives.length
    ? "Na sessão, o atleta " + positives.join(" e ") + "."
    : "O atleta participou na sessão com uma resposta global regular às tarefas propostas.";
  if (tags)
    text += " Os indicadores assinalados pela equipa técnica foram " + tags.toLowerCase() + ".";
  if (r.note)
    text += " Na observação técnica, destaca-se que " + r.note.charAt(0).toLowerCase() + r.note.slice(1).replace(/[.!?]+$/, "") + ".";
  return text;
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
    records = effectiveTrainingRecords_().filter((r) =>
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
    source = s_(e.source || "manual"),
    sourceId = s_(e.sourceId),
    id = s_(e.id) || "evt_" + Utilities.getUuid(),
    equipment = ["Vermelho", "Branco"].indexOf(s_(e.equipment)) >= 0
      ? s_(e.equipment)
      : "";
  if (!s_(e.title) || !date_(e.date)) throw Error("Preenche título e data.");
  if (source === "game") {
    availabilityOwner_(u);
    const game = objs_("GAMES").find((r) => s_(r.ID) === sourceId);
    if (!game) throw Error("Jogo não encontrado.");
    patch_("GAMES", "ID", sourceId, {
      Adversario: s_(e.title),
      Data: e.date,
      Hora: e.time,
      Local: e.location,
      Equipamento: equipment,
    });
    updateEventReferenceDates_(id, e.date);
    return { ok: true, id: id, source: "game", sourceId: sourceId };
  }
  const existing = objs_("EVENTS").find((r) => s_(r.ID) === id);
  if (existing) availabilityOwner_(u);
  upsert_("EVENTS", "ID", {
    ID: id,
    Tipo: e.type,
    Titulo: e.title,
    Data: e.date,
    Hora: e.time,
    Escalao: e.group,
    Local: e.location,
    Equipamento: equipment,
    Observacao: e.note,
    Origem: "manual",
    OrigemID: "",
    CriadoPor: existing ? existing.CriadoPor : u.id,
    CriadoEm: existing ? existing.CriadoEm : new Date(),
  });
  updateEventReferenceDates_(id, e.date);
  return { ok: true, id: id, source: "manual", sourceId: id };
}
function updateEventReferenceDates_(eventId, date) {
  const rows = objs_("GAME_AVAILABILITY")
    .filter((r) => s_(r.EventoID) === s_(eventId))
    .map((r) => {
      r.DataEvento = date;
      return r;
    });
  upsertMany_("GAME_AVAILABILITY", "ID", rows);
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
  replaceRows_(
    "LINEUPS",
    (r) => s_(r.JogoID) === g,
    (b.lineup || []).map((x) => ({
      ID: "lu_" + Utilities.getUuid(),
      JogoID: g,
      AtletaID: x.athleteId,
      PosicaoX: x.x,
      PosicaoY: x.y,
      Equipamento: x.equipment,
      Numero: x.number,
      AtualizadoPor: u.id,
      AtualizadoEm: new Date(),
    })),
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
let REQUEST_OBJECT_CACHE = {},
  REQUEST_HEADER_CACHE = {},
  REQUEST_SPREADSHEET_CACHE = null;
function resetRequestCache_() {
  REQUEST_OBJECT_CACHE = {};
  REQUEST_HEADER_CACHE = {};
  REQUEST_SPREADSHEET_CACHE = null;
}
function invalidateRequestCache_(n) {
  delete REQUEST_OBJECT_CACHE[n];
}
function spreadsheet_() {
  if (!REQUEST_SPREADSHEET_CACHE)
    REQUEST_SPREADSHEET_CACHE = SpreadsheetApp.getActive();
  return REQUEST_SPREADSHEET_CACHE;
}
function sheetHeaders_(sh) {
  const name = sh.getName();
  if (REQUEST_HEADER_CACHE[name]) return REQUEST_HEADER_CACHE[name].slice();
  const known = SHEETS[sh.getName()];
  const headers =
    known && known.length === sh.getLastColumn()
      ? known.slice()
      : sh
          .getRange(1, 1, 1, sh.getLastColumn())
          .getDisplayValues()[0]
          .map(s_);
  REQUEST_HEADER_CACHE[name] = headers;
  return headers.slice();
}
function objs_(n) {
  if (REQUEST_OBJECT_CACHE[n])
    return REQUEST_OBJECT_CACHE[n].map((x) => Object.assign({}, x));
  const sh = spreadsheet_().getSheetByName(n);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(),
    h = v.shift().map(s_);
  const rows = v
    .filter((r) => r.some((x) => s_(x) !== ""))
    .map((r) => {
      const o = {};
      h.forEach((k, i) => (o[k] = r[i]));
      return o;
    });
  REQUEST_OBJECT_CACHE[n] = rows;
  return rows.map((x) => Object.assign({}, x));
}
function append_(n, o) {
  const sh = spreadsheet_().getSheetByName(n),
    h = sheetHeaders_(sh);
  sh.getRange(sh.getLastRow() + 1, 1, 1, h.length).setValues([
    h.map((k) => (o[k] === undefined ? "" : o[k])),
  ]);
  invalidateRequestCache_(n);
}
function upsert_(n, k, o) {
  const sh = spreadsheet_().getSheetByName(n),
    h = sheetHeaders_(sh),
    ki = h.indexOf(k),
    lastRow = sh.getLastRow(),
    keys = lastRow > 1
      ? sh.getRange(2, ki + 1, lastRow - 1, 1).getDisplayValues()
      : [],
    keyPosition = keys.findIndex((row) => s_(row[0]) === s_(o[k])),
    rowNumber = keyPosition >= 0 ? keyPosition + 2 : lastRow + 1,
    current = keyPosition >= 0
      ? sh.getRange(rowNumber, 1, 1, h.length).getValues()[0]
      : [],
    vals = h.map((x, i) =>
      o[x] === undefined ? current[i] || "" : o[x],
    );
  sh.getRange(rowNumber, 1, 1, h.length).setValues([vals]);
  invalidateRequestCache_(n);
}
function upsertMany_(n, k, rows) {
  if (!rows || !rows.length) return;
  const sh = spreadsheet_().getSheetByName(n),
    values = sh.getDataRange().getValues(),
    headers = values[0].map(s_),
    keyIndex = headers.indexOf(k),
    rowByKey = {};
  values.forEach((row, index) => {
    if (index && s_(row[keyIndex])) rowByKey[s_(row[keyIndex])] = index + 1;
  });
  const additions = [],
    updates = [];
  rows.forEach((item) => {
    const sheetRow = rowByKey[s_(item[k])],
      current = sheetRow ? values[sheetRow - 1] : [],
      output = headers.map((header, index) =>
        item[header] === undefined ? current[index] || "" : item[header],
      );
    if (sheetRow) updates.push({ row: sheetRow, values: output });
    else additions.push(output);
  });
  updates.sort((a, b) => a.row - b.row);
  for (let i = 0; i < updates.length; ) {
    const group = [updates[i]];
    while (
      i + group.length < updates.length &&
      updates[i + group.length].row === group[group.length - 1].row + 1
    ) group.push(updates[i + group.length]);
    sh.getRange(group[0].row, 1, group.length, headers.length)
      .setValues(group.map((entry) => entry.values));
    i += group.length;
  }
  if (additions.length)
    sh.getRange(sh.getLastRow() + 1, 1, additions.length, headers.length)
      .setValues(additions);
  invalidateRequestCache_(n);
}
function replaceRows_(n, removePredicate, additions) {
  const sh = spreadsheet_().getSheetByName(n),
    values = sh.getDataRange().getValues(),
    headers = values[0].map(s_),
    kept = values.slice(1).filter((row) => {
      const obj = {};
      headers.forEach((header, index) => (obj[header] = row[index]));
      return !removePredicate(obj);
    }),
    added = (additions || []).map((item) =>
      headers.map((header) => (item[header] === undefined ? "" : item[header])),
    ),
    output = kept.concat(added),
    oldRows = Math.max(sh.getLastRow() - 1, 0);
  if (oldRows) sh.getRange(2, 1, oldRows, headers.length).clearContent();
  if (output.length)
    sh.getRange(2, 1, output.length, headers.length).setValues(output);
  invalidateRequestCache_(n);
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
function effectiveTrainingRecords_() {
  const records = uniqueTrainingRecords_(),
    mixed = new Set(
      objs_("ATHLETES")
        .filter((athlete) => s_(athlete.Escalao) === "Traquinas/Benjamins")
        .map((athlete) => s_(athlete.ID)),
    ),
    trainingDateById = {},
    trainingGroupById = {};
  objs_("TRAININGS").forEach((training) => {
    trainingDateById[s_(training.ID)] = date_(training.Data);
    trainingGroupById[s_(training.ID)] = s_(training.Escalao);
  });
  const normal = [],
    mixedByDay = {},
    rank = { Presente: 3, Justificada: 2, Falta: 1 };
  records.forEach((record) => {
    const athleteId = s_(record.AtletaID);
    if (!mixed.has(athleteId)) {
      normal.push(record);
      return;
    }
    const date = trainingDateById[s_(record.TreinoID)],
      key = athleteId + "|" + (date || s_(record.TreinoID));
    if (!mixedByDay[key]) mixedByDay[key] = [];
    mixedByDay[key].push(record);
  });
  const effectiveMixed = Object.keys(mixedByDay)
    .map((key) => {
      const dayRecords = mixedByDay[key],
        present = dayRecords.find(
          (record) => s_(record.Presenca) === "Presente",
        );
      if (present) return present;
      const groups = new Set(
        dayRecords.map(
          (record) => trainingGroupById[s_(record.TreinoID)] || "",
        ),
      );
      if (
        !groups.has("Todos") &&
        !(groups.has("Traquinas") && groups.has("Benjamins"))
      )
        return null;
      return dayRecords
        .slice()
        .sort(
          (a, b) =>
            (rank[s_(b.Presenca)] || 0) -
            (rank[s_(a.Presenca)] || 0),
        )[0];
    })
    .filter(Boolean);
  return normal.concat(effectiveMixed);
}
function dedupeTrainingRecords_(onlyTrainingId) {
  const sh = spreadsheet_().getSheetByName("RECORDS");
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
  const sh = spreadsheet_().getSheetByName(n),
    values = sh.getDataRange().getValues(),
    headers = values[0].map(s_),
    kept = values.slice(1).filter((row) => {
      const obj = {};
      headers.forEach((header, index) => (obj[header] = row[index]));
      return !p(obj);
    }),
    oldRows = Math.max(values.length - 1, 0);
  if (oldRows) sh.getRange(2, 1, oldRows, headers.length).clearContent();
  if (kept.length)
    sh.getRange(2, 1, kept.length, headers.length).setValues(kept);
  invalidateRequestCache_(n);
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
