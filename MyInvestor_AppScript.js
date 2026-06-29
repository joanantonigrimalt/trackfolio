// ============================================================
//  AÑADIR ESTE CÓDIGO AL FINAL DE Código.gs en Apps Script
//  Script ID: 1J7LGZYLqv78lJwknqKPkDyuWh73BtZybNg8AlpbRCPp0XxznilZ8hPZX
//  Spreadsheet ID: 1Qj4avyVAIwhaqqXI4UBL0WB_0oo1taPUu4ZwUstUeC0
// ============================================================

var MYINVESTOR_SHEET_NAME = 'MyInvestor';

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────
// Ejecutar manualmente o via trigger semanal
function crearHojaMyInvestor() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Eliminar pestaña si ya existe y recrear
  var existing = ss.getSheetByName(MYINVESTOR_SHEET_NAME);
  if (existing) ss.deleteSheet(existing);
  var sheet = ss.insertSheet(MYINVESTOR_SHEET_NAME);

  // Fetch todos los productos (ETF + Fondo)
  var products = [];
  Logger.log('=== Fetching ETFs ===');
  var etfs = _miFetch('ETF');
  Logger.log('ETFs obtenidos: ' + etfs.length);

  Logger.log('=== Fetching Fondos ===');
  var funds = _miFetch('FUND');
  Logger.log('Fondos obtenidos: ' + funds.length);

  products = etfs.concat(funds);

  if (products.length === 0) {
    sheet.getRange('A1').setValue('No se pudieron obtener datos. Revisa el log (Ctrl+Enter en Apps Script).');
    SpreadsheetApp.flush();
    Logger.log('ERROR: 0 productos obtenidos. Comprueba los endpoints en el log.');
    return;
  }

  // Cabeceras
  var headers = [
    'ISIN', 'Nombre', 'Tipo', 'Categoría', 'Mercado',
    'TER (%)', 'Divisa', 'Réplica', 'Distribución',
    'Rent. 1A (%)', 'Rent. 3A (%)', 'Rent. 5A (%)',
    'Rating Morningstar', 'URL MyInvestor', 'Actualizado'
  ];
  var hdrRange = sheet.getRange(1, 1, 1, headers.length);
  hdrRange.setValues([headers]);
  hdrRange.setBackground('#1a7a42').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Datos
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  var rows = products.map(function(p) {
    return [
      p.isin, p.nombre, p.tipo, p.categoria, p.mercado,
      p.ter, p.divisa, p.replica, p.distribucion,
      p.rent1a, p.rent3a, p.rent5a,
      p.rating, p.url, now
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // Colores alternos
  for (var i = 2; i <= rows.length + 1; i += 2) {
    sheet.getRange(i, 1, 1, headers.length).setBackground('#f0f7f3');
  }

  // Formato columnas de rentabilidad (%)
  var pctFmt = '0.00"%"';
  var pctCols = [10, 11, 12]; // Rent 1A, 3A, 5A
  pctCols.forEach(function(col) {
    if (rows.length > 0) sheet.getRange(2, col, rows.length, 1).setNumberFormat(pctFmt);
  });

  sheet.autoResizeColumns(1, headers.length);
  SpreadsheetApp.flush();

  Logger.log('✅ Hoja MyInvestor creada con ' + products.length + ' productos.');
  try { SpreadsheetApp.getActive().toast('Hoja MyInvestor creada con ' + products.length + ' productos', '✅ Listo', 6); } catch(e) {}
}

// ─── FETCH PAGINADO ──────────────────────────────────────────
function _miFetch(type) {
  // Endpoints a probar en orden (se para en el primero que funcione)
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
      while (page < 60) { // max 60 páginas × 100 = 6000 productos
        var url = tpl.replace('{PAGE}', page);
        var resp = UrlFetchApp.fetch(url, {
          headers: reqHeaders,
          muteHttpExceptions: true,
          followRedirects: true
        });
        var code = resp.getResponseCode();

        if (code === 401 || code === 403) {
          Logger.log('[' + type + '] Endpoint ' + ei + ' requiere auth (' + code + ')');
          break;
        }
        if (code !== 200) {
          Logger.log('[' + type + '] Endpoint ' + ei + ' HTTP ' + code);
          break;
        }

        var text = resp.getContentText();
        var json;
        try { json = JSON.parse(text); } catch(pe) { Logger.log('JSON parse error: ' + pe); break; }

        // Log estructura del primer resultado para debug
        if (page === 0) {
          Logger.log('[' + type + '] Endpoint ' + ei + ' keys: ' + Object.keys(json).join(', '));
          var items0 = _miExtractItems(json);
          if (items0 && items0.length > 0) {
            Logger.log('[' + type + '] Primer item keys: ' + Object.keys(items0[0]).join(', '));
            Logger.log('[' + type + '] Primer item (truncado): ' + JSON.stringify(items0[0]).substring(0, 400));
          }
        }

        var items = _miExtractItems(json);
        if (!items || items.length === 0) { success = true; break; }

        items.forEach(function(item) {
          allProducts.push(_miParseProduct(item, type));
        });

        Logger.log('[' + type + '] Página ' + page + ': ' + items.length + ' items → total: ' + allProducts.length);

        if (!_miHasMore(json, items.length)) { success = true; break; }
        page++;
        Utilities.sleep(300); // pausa respetuosa
      }

      if (success && allProducts.length > 0) {
        Logger.log('[' + type + '] ✅ Endpoint ' + ei + ' OK — ' + allProducts.length + ' productos');
        return allProducts;
      }

    } catch(e) {
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
  // Buscar arrays anidados un nivel más
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
  Logger.log('Estructura desconocida: ' + JSON.stringify(json).substring(0, 300));
  return [];
}

// Detecta si hay más páginas
function _miHasMore(json, itemsCount) {
  if (itemsCount < 100) return false; // menos que el tamaño de página = última página
  if (json.last === true || json.last === 'true') return false;
  if (json.hasNext === false) return false;
  if (json.totalPages !== undefined) return false; // se gestiona externamente, parar aquí
  if (json.page && json.page.totalPages !== undefined) return false;
  return true; // asumir hay más si el tamaño de página es exactamente 100
}

// Convierte un item de la API a nuestro formato normalizado
function _miParseProduct(item, type) {
  // Helper: intenta varios nombres de campo
  function get(obj) {
    for (var i = 1; i < arguments.length; i++) {
      var k = arguments[i];
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        var v = obj[k];
        if (typeof v === 'object' && !Array.isArray(v)) {
          // Objeto anidado: extraer campo "name" o "value"
          return v.name || v.value || v.code || JSON.stringify(v);
        }
        return v;
      }
    }
    return '';
  }

  function toNum(v) {
    if (v === '' || v === null || v === undefined) return '';
    var s = String(v).replace(',', '.').replace('%', '').trim();
    var n = parseFloat(s);
    return isNaN(n) ? '' : n;
  }

  var isin      = get(item, 'isin', 'ISIN', 'isinCode', 'code');
  var nombre    = get(item, 'name', 'nombre', 'productName', 'fundName', 'title', 'shortName', 'description');
  var categoria = get(item, 'category', 'categoria', 'assetClass', 'fundCategory', 'subcategory', 'morningstarCategory');
  var mercado   = get(item, 'market', 'exchange', 'mercado', 'stockExchange', 'primaryExchange');
  var ter       = get(item, 'ter', 'TER', 'ongoingCharge', 'totalExpenseRatio', 'managementFee', 'annualFee', 'expenseRatio', 'managementExpenseRatio');
  var divisa    = get(item, 'currency', 'divisa', 'currencyCode', 'baseCurrency', 'currency_code');
  var replica   = get(item, 'replicationMethod', 'replica', 'replication', 'methodology', 'indexReplication', 'physicalOrSynthetic');
  var distrib   = get(item, 'distributionPolicy', 'distribucion', 'incomeType', 'dividendPolicy', 'accumulation', 'distributing');
  var rating    = get(item, 'morningstarRating', 'rating', 'stars', 'morningstarStars', 'starRating');
  var rent1a    = get(item, 'return1Year', 'performance1Y', 'rent1a', 'annualized1Y', 'oneYearReturn', 'return1y', 'ytd1Y', 'trailingReturn1Y', 'r1y');
  var rent3a    = get(item, 'return3Year', 'performance3Y', 'rent3a', 'annualized3Y', 'threeYearReturn', 'return3y', 'trailingReturn3Y', 'r3y');
  var rent5a    = get(item, 'return5Year', 'performance5Y', 'rent5a', 'annualized5Y', 'fiveYearReturn', 'return5y', 'trailingReturn5Y', 'r5y');

  // Construir URL de ficha en MyInvestor
  var url = get(item, 'url', 'link', 'productUrl', 'detailUrl');
  if (!url && isin) {
    url = type === 'ETF'
      ? 'https://app.myinvestor.es/etfs/' + isin
      : 'https://app.myinvestor.es/fondos/' + isin;
  }

  return {
    isin: String(isin),
    nombre: String(nombre),
    tipo: type === 'ETF' ? 'ETF' : 'Fondo',
    categoria: String(categoria),
    mercado: String(mercado),
    ter: toNum(ter),
    divisa: String(divisa),
    replica: String(replica),
    distribucion: String(distrib),
    rent1a: toNum(rent1a),
    rent3a: toNum(rent3a),
    rent5a: toNum(rent5a),
    rating: String(rating),
    url: String(url)
  };
}

// ─── WEB APP — sirve el catálogo como JSON para Finasset ─────
// Desplegar como: App web → Ejecutar como Yo → Acceso: Cualquier usuario
function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(MYINVESTOR_SHEET_NAME);

    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Hoja no encontrada. Ejecuta crearHojaMyInvestor() primero.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ products: [], count: 0, updated: null }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var headers = data[0].map(function(h) { return String(h); });
    var rows = data.slice(1).filter(function(r) { return r[0]; }); // excluir filas vacías

    var products = rows.map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });

    var output = JSON.stringify({
      products: products,
      count: products.length,
      updated: rows.length > 0 ? rows[0][14] : null
    });

    return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── TRIGGER SEMANAL ─────────────────────────────────────────
// Ejecutar UNA VEZ manualmente para activar la actualización automática
function crearTriggerSemanal() {
  // Eliminar triggers previos para esta función
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'crearHojaMyInvestor') ScriptApp.deleteTrigger(t);
  });

  // Crear trigger: cada lunes a las 7:00h
  ScriptApp.newTrigger('crearHojaMyInvestor')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(7)
    .create();

  Logger.log('✅ Trigger semanal creado: crearHojaMyInvestor() correrá cada lunes a las 7h');
}
