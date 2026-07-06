// ============================================================
//  Finasset — Actualizador semanal del catálogo MyInvestor
//  Pega TODO este código en el proyecto de Apps Script del Sheet.
//  Script ID:      1J7LGZYLqv78lJwknqKPkDyuWh73BtZybNg8AlpbRCPp0XxznilZ8hPZX
//  Spreadsheet ID: 1Qj4avyVAIwhaqqXI4UBL0WB_0oo1taPUu4ZwUstUeC0
//
//  IMPORTANTE — la app Finasset lee la PRIMERA pestaña (gid=0) con ESTA
//  estructura de columnas EXACTA (el parser usa índices fijos):
//    0:ID 1:Nombre 2:ISIN 3:Ticker 4:Divisa 5:Pais 6:Mercado Cod 7:Mercado
//    8:Precio 9:Fecha Precio 10:1 mes % 11:3 meses % 12:6 meses % 13:YTD %
//    14:1 anio %  15:3 anios %  16:5 anios %  17:Tipo  18:TER anual  19:Distribucion
//
//  Este script REESCRIBE la pestaña gid=0 en ese formato (sin borrarla, para
//  no perder el gid). Si el fetch devuelve 0 productos, NO toca el Sheet.
// ============================================================

// El Sheet objetivo (se autodefine por si no está en Código.gs)
var SPREADSHEET_ID = '1Qj4avyVAIwhaqqXI4UBL0WB_0oo1taPUu4ZwUstUeC0';

// Cabecera EXACTA que espera el parser de Finasset (lib/myinvestor-catalog.js)
var FA_HEADERS = [
  'ID','Nombre','ISIN','Ticker','Divisa','Pais','Mercado Cod','Mercado',
  'Precio','Fecha Precio','1 mes %','3 meses %','6 meses %','YTD %',
  '1 anio %','3 anios %','5 anios %','Tipo','TER anual','Distribucion'
];

// ─── FUNCIÓN PRINCIPAL (esta es la que va en el trigger semanal) ─────────────
function actualizarCatalogoFinasset() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheets()[0]; // gid=0 = primera pestaña (la que lee la app)

  Logger.log('=== Fetching ETFs ===');
  var etfs = _miFetch('ETF');
  Logger.log('ETFs obtenidos: ' + etfs.length);

  Logger.log('=== Fetching Fondos ===');
  var funds = _miFetch('FUND');
  Logger.log('Fondos obtenidos: ' + funds.length);

  var products = etfs.concat(funds);

  // Deduplicar por ISIN (mismo producto puede venir en varias bolsas)
  var seen = {}, unique = [];
  products.forEach(function(p) {
    var k = String(p.isin || '').trim().toUpperCase();
    if (k.length < 10 || seen[k]) return;
    seen[k] = true; unique.push(p);
  });

  // ⚠ SEGURIDAD: si no se obtuvo NADA, no tocar el Sheet (conservar datos previos)
  if (unique.length === 0) {
    Logger.log('⚠ 0 productos — Sheet NO modificado (se conservan los datos anteriores).');
    try { SpreadsheetApp.getActive().toast('0 productos obtenidos. Revisa los endpoints en el log. El Sheet NO se ha modificado.', '⚠ Aviso', 8); } catch(e) {}
    return;
  }

  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

  // Construir filas en el ORDEN EXACTO de FA_HEADERS
  var rows = unique.map(function(p, idx) {
    return [
      idx + 1,                 // 0  ID
      p.nombre,                // 1  Nombre
      p.isin,                  // 2  ISIN
      '',                      // 3  Ticker
      p.divisa || 'EUR',       // 4  Divisa
      '',                      // 5  Pais
      '',                      // 6  Mercado Cod
      p.mercado || '',         // 7  Mercado
      '',                      // 8  Precio
      now,                     // 9  Fecha Precio  ← marca de frescura semanal
      '',                      // 10 1 mes %
      '',                      // 11 3 meses %
      '',                      // 12 6 meses %
      '',                      // 13 YTD %
      p.rent1a,                // 14 1 anio %   ← RENTABILIDAD 1A
      p.rent3a,                // 15 3 anios %  ← RENTABILIDAD 3A
      p.rent5a,                // 16 5 anios %  ← RENTABILIDAD 5A
      p.tipo,                  // 17 Tipo (ETF / Fondo)
      p.ter,                   // 18 TER anual
      p.distribucion           // 19 Distribucion
    ];
  });

  // Reescribir gid=0 SIN borrar la pestaña (para conservar el gid)
  sheet.clearContents();
  var hdr = sheet.getRange(1, 1, 1, FA_HEADERS.length);
  hdr.setValues([FA_HEADERS]);
  hdr.setBackground('#1a7a42').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.getRange(2, 1, rows.length, FA_HEADERS.length).setValues(rows);

  // Formato % en columnas de rentabilidad (15,16,17 en 1-based = índices 14,15,16)
  ['O', 'P', 'Q'].forEach(function(col) {
    sheet.getRange(col + '2:' + col + (rows.length + 1)).setNumberFormat('0.00"%"');
  });

  SpreadsheetApp.flush();
  Logger.log('✅ gid=0 actualizado con ' + unique.length + ' productos únicos (' + now + ').');
  try { SpreadsheetApp.getActive().toast('Catálogo actualizado: ' + unique.length + ' productos', '✅ Listo', 6); } catch(e) {}
}

// ─── TRIGGER SEMANAL ─────────────────────────────────────────
// Ejecuta esto UNA VEZ (manualmente) para activar la actualización automática.
function crearTriggerSemanal() {
  // Borra triggers previos de ambas funciones (por si quedó el viejo)
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'actualizarCatalogoFinasset' || fn === 'crearHojaMyInvestor') ScriptApp.deleteTrigger(t);
  });
  // Cada lunes a las 7:00h
  ScriptApp.newTrigger('actualizarCatalogoFinasset')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(7)
    .create();
  Logger.log('✅ Trigger semanal creado: actualizarCatalogoFinasset() correrá cada lunes a las 7h');
  try { SpreadsheetApp.getActive().toast('Trigger semanal activado (lunes 7h)', '✅ Listo', 6); } catch(e) {}
}

// ─── FETCH PAGINADO (universo + rentabilidades desde la API de MyInvestor) ───
function _miFetch(type) {
  var endpointTemplates = [
    'https://app.myinvestor.es/api/v2/savings-plans/fund-search?page={PAGE}&size=100&productType=' + type,
    'https://app.myinvestor.es/api/v1/savings-plans/fund-search?page={PAGE}&size=100&type=' + type,
    'https://app.myinvestor.es/api/v2/investment-universe?category=' + type + '&page={PAGE}&size=100',
    'https://app.myinvestor.es/api/v2/funds?productType=' + type + '&page={PAGE}&size=100',
    'https://app.myinvestor.es/api/v1/investment-products?type=' + type + '&page={PAGE}&size=100'
  ];

  var reqHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Referer': 'https://app.myinvestor.es/',
    'Origin': 'https://app.myinvestor.es'
  };

  for (var ei = 0; ei < endpointTemplates.length; ei++) {
    var tpl = endpointTemplates[ei];
    var allProducts = [];
    var page = 0;
    var success = false;
    Logger.log('[' + type + '] Probando endpoint ' + ei + ': ' + tpl.replace('{PAGE}', '0'));

    try {
      while (page < 70) { // hasta 70 páginas × 100 = 7000 productos
        var url = tpl.replace('{PAGE}', page);
        var resp = UrlFetchApp.fetch(url, { headers: reqHeaders, muteHttpExceptions: true, followRedirects: true });
        var code = resp.getResponseCode();
        if (code === 401 || code === 403) { Logger.log('[' + type + '] Endpoint ' + ei + ' requiere auth (' + code + ')'); break; }
        if (code !== 200) { Logger.log('[' + type + '] Endpoint ' + ei + ' HTTP ' + code); break; }

        var json;
        try { json = JSON.parse(resp.getContentText()); } catch (pe) { Logger.log('JSON parse error: ' + pe); break; }

        if (page === 0) {
          Logger.log('[' + type + '] Endpoint ' + ei + ' keys: ' + Object.keys(json).join(', '));
          var items0 = _miExtractItems(json);
          if (items0 && items0.length > 0) Logger.log('[' + type + '] Primer item keys: ' + Object.keys(items0[0]).join(', '));
        }

        var items = _miExtractItems(json);
        if (!items || items.length === 0) { success = true; break; }
        items.forEach(function(item) { allProducts.push(_miParseProduct(item, type)); });
        Logger.log('[' + type + '] Página ' + page + ': ' + items.length + ' → total: ' + allProducts.length);
        if (!_miHasMore(json, items.length)) { success = true; break; }
        page++;
        Utilities.sleep(300);
      }
      if (success && allProducts.length > 0) {
        Logger.log('[' + type + '] ✅ Endpoint ' + ei + ' OK — ' + allProducts.length + ' productos');
        return allProducts;
      }
    } catch (e) {
      Logger.log('[' + type + '] Error endpoint ' + ei + ': ' + e.toString());
    }
  }
  Logger.log('[' + type + '] ❌ Todos los endpoints fallaron');
  return [];
}

// Detecta el array de items en la respuesta JSON (múltiples formatos)
function _miExtractItems(json) {
  if (Array.isArray(json)) return json;
  var candidates = ['content', 'data', 'results', 'items', 'funds', 'etfs', 'products', 'list'];
  for (var i = 0; i < candidates.length; i++) {
    if (json[candidates[i]] && Array.isArray(json[candidates[i]])) return json[candidates[i]];
  }
  var keys = Object.keys(json);
  for (var k = 0; k < keys.length; k++) {
    var val = json[keys[k]];
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      var subKeys = Object.keys(val);
      for (var sk = 0; sk < subKeys.length; sk++) {
        if (Array.isArray(val[subKeys[sk]]) && val[subKeys[sk]].length > 0) return val[subKeys[sk]];
      }
    }
  }
  return [];
}

// Detecta si hay más páginas
function _miHasMore(json, itemsCount) {
  if (itemsCount < 100) return false;
  if (json.last === true || json.last === 'true') return false;
  if (json.hasNext === false) return false;
  if (json.totalPages !== undefined) return false;
  if (json.page && json.page.totalPages !== undefined) return false;
  return true;
}

// Convierte un item de la API al formato normalizado que necesita el Sheet
function _miParseProduct(item, type) {
  function get(obj) {
    for (var i = 1; i < arguments.length; i++) {
      var k = arguments[i];
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        var v = obj[k];
        if (typeof v === 'object' && !Array.isArray(v)) return v.name || v.value || v.code || '';
        return v;
      }
    }
    return '';
  }
  function toNum(v) {
    if (v === '' || v === null || v === undefined) return '';
    var s = String(v).replace(',', '.').replace('%', '').trim();
    var n = parseFloat(s);
    if (isNaN(n)) return '';
    // La API a veces da la rentabilidad como fracción (0.36) en vez de % (36).
    // Heurística: si |n|<=1.5 y no es 0, asumimos fracción → a porcentaje.
    return n;
  }

  var isin   = get(item, 'isin', 'ISIN', 'isinCode', 'code');
  var nombre = get(item, 'name', 'nombre', 'productName', 'fundName', 'title', 'shortName', 'description');
  var mercado= get(item, 'market', 'exchange', 'mercado', 'stockExchange', 'primaryExchange');
  var ter    = get(item, 'ter', 'TER', 'ongoingCharge', 'totalExpenseRatio', 'managementFee', 'annualFee', 'expenseRatio');
  var divisa = get(item, 'currency', 'divisa', 'currencyCode', 'baseCurrency');
  var distrib= get(item, 'distributionPolicy', 'distribucion', 'incomeType', 'dividendPolicy', 'accumulation', 'distributing');
  var rent1a = get(item, 'return1Year', 'performance1Y', 'rent1a', 'annualized1Y', 'oneYearReturn', 'return1y', 'trailingReturn1Y', 'r1y');
  var rent3a = get(item, 'return3Year', 'performance3Y', 'rent3a', 'annualized3Y', 'threeYearReturn', 'return3y', 'trailingReturn3Y', 'r3y');
  var rent5a = get(item, 'return5Year', 'performance5Y', 'rent5a', 'annualized5Y', 'fiveYearReturn', 'return5y', 'trailingReturn5Y', 'r5y');

  return {
    isin: String(isin),
    nombre: String(nombre),
    tipo: type === 'ETF' ? 'ETF' : 'Fondo',
    mercado: String(mercado),
    ter: toNum(ter),
    divisa: String(divisa) || 'EUR',
    distribucion: String(distrib),
    rent1a: toNum(rent1a),
    rent3a: toNum(rent3a),
    rent5a: toNum(rent5a)
  };
}
