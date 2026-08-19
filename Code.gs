const SHEETS = {
  USERS: ['ID','Utilizador','PIN_HASH','Nome','Perfil','Ativo','CriadoEm'],
  ATHLETES: ['ID','Nome','Escalao','Ativo','CriadoEm','AtualizadoEm'],
  TRAININGS: ['ID','Data','Hora','Escalao','CriadoPor','CriadoEm'],
  RECORDS: ['ID','TreinoID','AtletaID','Presenca','Atitude','Empenho','Comportamento','Observacao','CriadoPor','CriadoEm'],
  GAMES: ['ID','Adversario','Data','Hora','Escalao','Local','CriadoPor','CriadoEm'],
  CALLUPS: ['ID','JogoID','AtletaID','Estado','Score','CriadoPor','CriadoEm']
};

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.entries(SHEETS).forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
  });
  const users = ss.getSheetByName('USERS');
  if (users.getLastRow() === 1) {
    users.appendRow(['u_admin','admin',hashPin_('1234'),'Administrador GDR','admin',true,new Date()]);
  }
}

function doGet(e) {
  return json_({ok:true, app:'GDR Formação 360', status:'online'});
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action || '';
    if (action === 'login') return login_(body);
    return json_({ok:false,error:'Ação inválida'});
  } catch (err) {
    return json_({ok:false,error:String(err)});
  }
}

function login_(body) {
  const username = String(body.username || '').trim().toLowerCase();
  const pin = String(body.pin || '').trim();
  const sh = SpreadsheetApp.getActive().getSheetByName('USERS');
  const values = sh.getDataRange().getValues();
  const pinHash = hashPin_(pin);
  for (let i=1;i<values.length;i++) {
    const r=values[i];
    if (String(r[1]).toLowerCase() === username && String(r[2]) === pinHash && String(r[5]).toLowerCase() !== 'false') {
      return json_({ok:true,user:{id:r[0],username:r[1],name:r[3],role:r[4]}});
    }
  }
  return json_({ok:false,error:'Credenciais inválidas'});
}

function hashPin_(pin) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pin), Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2)).join('');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
