// GET /api/myinvestor/catalog
// Serves a curated catalog of ETFs and funds available on MyInvestor.
// Static base data (ISIN, TER, category) + live returns from Apps Script when available.
// Cache: 6h in-memory.

// ─── Static catalog ────────────────────────────────────────────────────────────
// Popular ETFs and funds available on MyInvestor (Spain).
// Returns data (rent1a/3a/5a) are approximate as of H1 2026 and refreshed via Apps Script.
const STATIC_CATALOG = [
  // ── RENTA VARIABLE GLOBAL ──
  {isin:'IE00B4L5Y983',nombre:'iShares Core MSCI World UCITS ETF USD Acc',tipo:'ETF',categoria:'Renta Variable Global',mercado:'XAMS',ter:0.20,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:24.1,rent3a:11.8,rent5a:14.2,rating:'5',url:'https://app.myinvestor.es/etfs/IE00B4L5Y983'},
  {isin:'IE00B3RBWM25',nombre:'Vanguard FTSE All-World UCITS ETF USD Dis',tipo:'ETF',categoria:'Renta Variable Global',mercado:'XAMS',ter:0.22,divisa:'USD',replica:'Física',distribucion:'Distribución',rent1a:23.4,rent3a:10.9,rent5a:13.5,rating:'5',url:'https://app.myinvestor.es/etfs/IE00B3RBWM25'},
  {isin:'IE00BK5BQT80',nombre:'Vanguard FTSE All-World UCITS ETF USD Acc',tipo:'ETF',categoria:'Renta Variable Global',mercado:'XAMS',ter:0.22,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:23.5,rent3a:11.0,rent5a:13.6,rating:'5',url:'https://app.myinvestor.es/etfs/IE00BK5BQT80'},
  {isin:'LU1681043599',nombre:'Amundi MSCI World UCITS ETF Acc',tipo:'ETF',categoria:'Renta Variable Global',mercado:'XPAR',ter:0.12,divisa:'USD',replica:'Sintética',distribucion:'Acumulación',rent1a:24.3,rent3a:12.1,rent5a:14.5,rating:'4',url:'https://app.myinvestor.es/etfs/LU1681043599'},
  {isin:'IE00B6R52259',nombre:'iShares MSCI ACWI UCITS ETF USD Acc',tipo:'ETF',categoria:'Renta Variable Global',mercado:'XLON',ter:0.20,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:22.8,rent3a:10.5,rent5a:13.1,rating:'4',url:'https://app.myinvestor.es/etfs/IE00B6R52259'},
  // ── RENTA VARIABLE USA ──
  {isin:'IE00B5BMR087',nombre:'iShares Core S&P 500 UCITS ETF USD Acc',tipo:'ETF',categoria:'Renta Variable USA',mercado:'XLON',ter:0.07,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:28.9,rent3a:14.2,rent5a:17.1,rating:'5',url:'https://app.myinvestor.es/etfs/IE00B5BMR087'},
  {isin:'IE00B3XXRP09',nombre:'Vanguard S&P 500 UCITS ETF USD Dis',tipo:'ETF',categoria:'Renta Variable USA',mercado:'XLON',ter:0.07,divisa:'USD',replica:'Física',distribucion:'Distribución',rent1a:28.7,rent3a:14.0,rent5a:16.9,rating:'5',url:'https://app.myinvestor.es/etfs/IE00B3XXRP09'},
  {isin:'IE00BFMXXD54',nombre:'iShares S&P 500 Swap UCITS ETF USD Acc',tipo:'ETF',categoria:'Renta Variable USA',mercado:'XETR',ter:0.05,divisa:'USD',replica:'Sintética',distribucion:'Acumulación',rent1a:29.0,rent3a:14.3,rent5a:17.2,rating:'4',url:'https://app.myinvestor.es/etfs/IE00BFMXXD54'},
  {isin:'LU1681048804',nombre:'Amundi S&P 500 UCITS ETF Acc',tipo:'ETF',categoria:'Renta Variable USA',mercado:'XPAR',ter:0.07,divisa:'USD',replica:'Sintética',distribucion:'Acumulación',rent1a:29.1,rent3a:14.4,rent5a:17.3,rating:'4',url:'https://app.myinvestor.es/etfs/LU1681048804'},
  {isin:'IE00BFNM3J75',nombre:'Vanguard S&P 500 UCITS ETF USD Acc',tipo:'ETF',categoria:'Renta Variable USA',mercado:'XAMS',ter:0.07,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:28.8,rent3a:14.1,rent5a:17.0,rating:'5',url:'https://app.myinvestor.es/etfs/IE00BFNM3J75'},
  // ── RENTA VARIABLE EUROPA ──
  {isin:'IE00B4K48X80',nombre:'iShares Core MSCI Europe UCITS ETF EUR Acc',tipo:'ETF',categoria:'Renta Variable Europa',mercado:'XLON',ter:0.12,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:8.3,rent3a:7.1,rent5a:8.9,rating:'4',url:'https://app.myinvestor.es/etfs/IE00B4K48X80'},
  {isin:'LU0392494562',nombre:'ComStage MSCI Europe UCITS ETF',tipo:'ETF',categoria:'Renta Variable Europa',mercado:'XETR',ter:0.20,divisa:'EUR',replica:'Sintética',distribucion:'Acumulación',rent1a:8.0,rent3a:6.8,rent5a:8.5,rating:'3',url:'https://app.myinvestor.es/etfs/LU0392494562'},
  {isin:'IE00B60SX394',nombre:'Vanguard FTSE Developed Europe UCITS ETF',tipo:'ETF',categoria:'Renta Variable Europa',mercado:'XAMS',ter:0.10,divisa:'EUR',replica:'Física',distribucion:'Distribución',rent1a:8.1,rent3a:7.0,rent5a:8.7,rating:'4',url:'https://app.myinvestor.es/etfs/IE00B60SX394'},
  // ── RENTA VARIABLE EMERGENTES ──
  {isin:'IE00B4L5YC18',nombre:'iShares Core MSCI EM IMI UCITS ETF USD Acc',tipo:'ETF',categoria:'Mercados Emergentes',mercado:'XLON',ter:0.18,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:12.1,rent3a:1.8,rent5a:5.2,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B4L5YC18'},
  {isin:'LU1681045370',nombre:'Amundi MSCI Emerging Markets UCITS ETF Acc',tipo:'ETF',categoria:'Mercados Emergentes',mercado:'XPAR',ter:0.20,divisa:'USD',replica:'Sintética',distribucion:'Acumulación',rent1a:12.3,rent3a:2.0,rent5a:5.4,rating:'3',url:'https://app.myinvestor.es/etfs/LU1681045370'},
  {isin:'IE00B3F81G20',nombre:'iShares MSCI Emerging Markets UCITS ETF',tipo:'ETF',categoria:'Mercados Emergentes',mercado:'XLON',ter:0.18,divisa:'USD',replica:'Física',distribucion:'Distribución',rent1a:11.8,rent3a:1.5,rent5a:5.0,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B3F81G20'},
  // ── RENTA VARIABLE TECNOLOGÍA ──
  {isin:'IE00B3WJKG14',nombre:'iShares S&P 500 Information Technology Sector',tipo:'ETF',categoria:'Tecnología',mercado:'XLON',ter:0.15,divisa:'USD',replica:'Física',distribucion:'Distribución',rent1a:38.2,rent3a:18.9,rent5a:22.4,rating:'5',url:'https://app.myinvestor.es/etfs/IE00B3WJKG14'},
  {isin:'IE00BYVJRP78',nombre:'iShares Nasdaq 100 UCITS ETF USD Acc',tipo:'ETF',categoria:'Tecnología',mercado:'XETR',ter:0.20,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:31.4,rent3a:15.7,rent5a:20.8,rating:'5',url:'https://app.myinvestor.es/etfs/IE00BYVJRP78'},
  {isin:'IE0032077012',nombre:'iShares NASDAQ 100 UCITS ETF (DE)',tipo:'ETF',categoria:'Tecnología',mercado:'XETR',ter:0.33,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:31.2,rent3a:15.5,rent5a:20.6,rating:'5',url:'https://app.myinvestor.es/etfs/IE0032077012'},
  {isin:'LU1861132840',nombre:'Lyxor Nasdaq-100 UCITS ETF Acc',tipo:'ETF',categoria:'Tecnología',mercado:'XPAR',ter:0.22,divisa:'USD',replica:'Sintética',distribucion:'Acumulación',rent1a:31.5,rent3a:15.8,rent5a:20.9,rating:'4',url:'https://app.myinvestor.es/etfs/LU1861132840'},
  // ── RENTA FIJA ──
  {isin:'IE00B3F81R35',nombre:'iShares Core Global Aggregate Bond UCITS ETF EUR Hdg',tipo:'ETF',categoria:'Renta Fija Global',mercado:'XLON',ter:0.10,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:2.1,rent3a:-1.8,rent5a:0.3,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B3F81R35'},
  {isin:'IE00B3DKXQ41',nombre:'iShares Euro Government Bond UCITS ETF EUR Dis',tipo:'ETF',categoria:'Renta Fija Europa',mercado:'XLON',ter:0.07,divisa:'EUR',replica:'Física',distribucion:'Distribución',rent1a:1.8,rent3a:-2.1,rent5a:-0.2,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B3DKXQ41'},
  {isin:'IE00B2NPKV68',nombre:'iShares $ Treasury Bond 1-3yr UCITS ETF',tipo:'ETF',categoria:'Renta Fija Corto Plazo',mercado:'XLON',ter:0.07,divisa:'USD',replica:'Física',distribucion:'Distribución',rent1a:4.9,rent3a:2.8,rent5a:2.5,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B2NPKV68'},
  {isin:'IE00B14X4Q57',nombre:'iShares $ Treasury Bond 7-10yr UCITS ETF',tipo:'ETF',categoria:'Renta Fija USA',mercado:'XLON',ter:0.07,divisa:'USD',replica:'Física',distribucion:'Distribución',rent1a:1.2,rent3a:-4.8,rent5a:-1.3,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B14X4Q57'},
  // ── RENTA VARIABLE SECTORIAL ──
  {isin:'IE00BYXVGZ48',nombre:'iShares MSCI World Health Care Sector UCITS ETF',tipo:'ETF',categoria:'Salud',mercado:'XLON',ter:0.25,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:5.8,rent3a:8.4,rent5a:10.2,rating:'4',url:'https://app.myinvestor.es/etfs/IE00BYXVGZ48'},
  {isin:'IE00BHZRR150',nombre:'iShares MSCI World Financials Sector UCITS ETF',tipo:'ETF',categoria:'Finanzas',mercado:'XLON',ter:0.25,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:28.5,rent3a:14.1,rent5a:13.8,rating:'4',url:'https://app.myinvestor.es/etfs/IE00BHZRR150'},
  {isin:'IE00B3CNHF18',nombre:'iShares MSCI World Energy Sector UCITS ETF',tipo:'ETF',categoria:'Energía',mercado:'XLON',ter:0.25,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:4.2,rent3a:16.8,rent5a:12.3,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B3CNHF18'},
  // ── SMART BETA / FACTOR ──
  {isin:'IE00BP3QZ825',nombre:'MSCI World Quality Factor UCITS ETF',tipo:'ETF',categoria:'Factor Quality',mercado:'XLON',ter:0.25,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:27.4,rent3a:13.8,rent5a:16.2,rating:'5',url:'https://app.myinvestor.es/etfs/IE00BP3QZ825'},
  {isin:'IE00B8FHGS14',nombre:'iShares Edge MSCI World Minimum Volatility UCITS ETF',tipo:'ETF',categoria:'Factor Min Volatilidad',mercado:'XLON',ter:0.30,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:14.2,rent3a:8.5,rent5a:10.8,rating:'4',url:'https://app.myinvestor.es/etfs/IE00B8FHGS14'},
  {isin:'IE00B3YLTY66',nombre:'SPDR MSCI World Small Cap UCITS ETF',tipo:'ETF',categoria:'Small Cap Global',mercado:'XLON',ter:0.45,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:15.3,rent3a:5.8,rent5a:9.4,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B3YLTY66'},
  // ── MATERIAS PRIMAS ──
  {isin:'IE00B579F325',nombre:'iShares Physical Gold ETC',tipo:'ETF',categoria:'Materias Primas - Oro',mercado:'XLON',ter:0.12,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:29.8,rent3a:14.2,rent5a:13.1,rating:'5',url:'https://app.myinvestor.es/etfs/IE00B579F325'},
  {isin:'DE000A0N62G0',nombre:'Xetra-Gold ETC',tipo:'ETF',categoria:'Materias Primas - Oro',mercado:'XETR',ter:0.36,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:30.1,rent3a:14.5,rent5a:13.4,rating:'4',url:'https://app.myinvestor.es/etfs/DE000A0N62G0'},
  // ── RENTA VARIABLE JAPÓN / ASIA ──
  {isin:'IE00B02KXH56',nombre:'iShares MSCI Japan UCITS ETF USD Dis',tipo:'ETF',categoria:'Renta Variable Japón',mercado:'XLON',ter:0.48,divisa:'USD',replica:'Física',distribucion:'Distribución',rent1a:4.1,rent3a:8.3,rent5a:9.2,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B02KXH56'},
  {isin:'IE00B0M62Q58',nombre:'iShares MSCI EM UCITS ETF USD Dis',tipo:'ETF',categoria:'Mercados Emergentes',mercado:'XLON',ter:0.18,divisa:'USD',replica:'Física',distribucion:'Distribución',rent1a:12.5,rent3a:2.1,rent5a:5.6,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B0M62Q58'},
  // ── HIGH DIVIDEND ──
  {isin:'IE00B3F81609',nombre:'Vanguard FTSE All-World High Dividend Yield UCITS ETF',tipo:'ETF',categoria:'Renta Variable Global Dividendo',mercado:'XAMS',ter:0.29,divisa:'USD',replica:'Física',distribucion:'Distribución',rent1a:17.8,rent3a:10.2,rent5a:11.8,rating:'4',url:'https://app.myinvestor.es/etfs/IE00B3F81609'},
  {isin:'IE00BZ182R45',nombre:'Vanguard FTSE All-World High Dividend Yield UCITS ETF USD Acc',tipo:'ETF',categoria:'Renta Variable Global Dividendo',mercado:'XAMS',ter:0.29,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:17.9,rent3a:10.3,rent5a:11.9,rating:'4',url:'https://app.myinvestor.es/etfs/IE00BZ182R45'},
  {isin:'IE00B8GKDB10',nombre:'iShares STOXX Europe Select Dividend 30 UCITS ETF',tipo:'ETF',categoria:'Renta Variable Europa Dividendo',mercado:'XETR',ter:0.31,divisa:'EUR',replica:'Física',distribucion:'Distribución',rent1a:5.2,rent3a:8.9,rent5a:9.4,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B8GKDB10'},
  // ── REAL ESTATE / REIT ──
  {isin:'IE00B83YJG36',nombre:'Amundi FTSE EPRA Europe Real Estate UCITS ETF',tipo:'ETF',categoria:'Inmobiliario Europa',mercado:'XPAR',ter:0.24,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:2.8,rent3a:-3.2,rent5a:2.1,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B83YJG36'},
  // ── INFLATION-LINKED ──
  {isin:'IE00B1FZSC47',nombre:'iShares Euro Inflation Linked Govt Bond UCITS ETF',tipo:'ETF',categoria:'Bonos Ligados Inflación',mercado:'XETR',ter:0.09,divisa:'EUR',replica:'Física',distribucion:'Distribución',rent1a:1.5,rent3a:-1.2,rent5a:0.8,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B1FZSC47'},
  // ── FONDOS DE INVERSIÓN (disponibles en MyInvestor) ──
  {isin:'LU0996182563',nombre:'Vanguard Global Stock Index Fund EUR Acc',tipo:'Fondo',categoria:'Renta Variable Global',mercado:'',ter:0.18,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:24.0,rent3a:11.7,rent5a:14.1,rating:'5',url:'https://app.myinvestor.es/fondos/LU0996182563'},
  {isin:'IE00B03HCZ61',nombre:'Vanguard U.S. 500 Stock Index Fund EUR Acc',tipo:'Fondo',categoria:'Renta Variable USA',mercado:'',ter:0.10,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:28.8,rent3a:14.0,rent5a:17.0,rating:'5',url:'https://app.myinvestor.es/fondos/IE00B03HCZ61'},
  {isin:'LU1861218413',nombre:'MyInvestor Indexado SP500 FI',tipo:'Fondo',categoria:'Renta Variable USA',mercado:'',ter:0.24,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:28.5,rent3a:13.8,rent5a:null,rating:'4',url:'https://app.myinvestor.es/fondos/LU1861218413'},
  {isin:'LU1781541179',nombre:'MyInvestor Indexado Mundial FI',tipo:'Fondo',categoria:'Renta Variable Global',mercado:'',ter:0.28,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:23.8,rent3a:11.5,rent5a:null,rating:'4',url:'https://app.myinvestor.es/fondos/LU1781541179'},
  {isin:'LU1060462932',nombre:'Robeco Global Consumer Trends D EUR',tipo:'Fondo',categoria:'Renta Variable Consumo',mercado:'',ter:1.50,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:18.2,rent3a:3.1,rent5a:11.4,rating:'3',url:'https://app.myinvestor.es/fondos/LU1060462932'},
  {isin:'LU0552385295',nombre:'Fundsmith Equity Fund R EUR Acc',tipo:'Fondo',categoria:'Renta Variable Global',mercado:'',ter:1.00,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:12.4,rent3a:6.8,rent5a:11.2,rating:'4',url:'https://app.myinvestor.es/fondos/LU0552385295'},
  {isin:'IE0003290529',nombre:'Vanguard European Stock Index Fund EUR Acc',tipo:'Fondo',categoria:'Renta Variable Europa',mercado:'',ter:0.12,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:8.2,rent3a:7.0,rent5a:8.8,rating:'4',url:'https://app.myinvestor.es/fondos/IE0003290529'},
  {isin:'IE0031786142',nombre:'Vanguard Emerging Markets Stock Index Fund EUR Acc',tipo:'Fondo',categoria:'Mercados Emergentes',mercado:'',ter:0.23,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:12.0,rent3a:1.7,rent5a:5.1,rating:'3',url:'https://app.myinvestor.es/fondos/IE0031786142'},
  {isin:'LU0823421906',nombre:'Nordea 1 European High Yield Bond Fund BI EUR',tipo:'Fondo',categoria:'Renta Fija Alto Rendimiento',mercado:'',ter:0.60,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:8.2,rent3a:4.1,rent5a:5.3,rating:'3',url:'https://app.myinvestor.es/fondos/LU0823421906'},
  {isin:'LU0099574567',nombre:'Amundi Funds Euro Bond I EUR C',tipo:'Fondo',categoria:'Renta Fija EUR',mercado:'',ter:0.42,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:2.4,rent3a:-2.8,rent5a:-0.4,rating:'3',url:'https://app.myinvestor.es/fondos/LU0099574567'},
  // ── MORE POPULAR ETFs ──
  {isin:'IE00B52SF786',nombre:'iShares MSCI World Small Cap UCITS ETF',tipo:'ETF',categoria:'Small Cap Global',mercado:'XLON',ter:0.35,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:14.8,rent3a:5.4,rent5a:9.1,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B52SF786'},
  {isin:'IE00B4MCHH10',nombre:'Vanguard EUR Eurozone Government Bond UCITS ETF',tipo:'ETF',categoria:'Renta Fija Eurozona',mercado:'XAMS',ter:0.07,divisa:'EUR',replica:'Física',distribucion:'Distribución',rent1a:1.9,rent3a:-1.9,rent5a:-0.1,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B4MCHH10'},
  {isin:'IE00BKX55S42',nombre:'Vanguard ESG Global All Cap UCITS ETF USD Acc',tipo:'ETF',categoria:'Renta Variable Global ESG',mercado:'XLON',ter:0.24,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:22.1,rent3a:10.1,rent5a:13.0,rating:'4',url:'https://app.myinvestor.es/etfs/IE00BKX55S42'},
  {isin:'IE00BG0J4J64',nombre:'iShares MSCI World ESG Screened UCITS ETF USD Acc',tipo:'ETF',categoria:'Renta Variable Global ESG',mercado:'XLON',ter:0.20,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:22.8,rent3a:10.8,rent5a:13.5,rating:'4',url:'https://app.myinvestor.es/etfs/IE00BG0J4J64'},
  {isin:'IE00B44Z5B48',nombre:'iShares Core MSCI Pacific ex-Japan UCITS ETF',tipo:'ETF',categoria:'Renta Variable Pacífico',mercado:'XLON',ter:0.20,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:11.2,rent3a:3.4,rent5a:6.8,rating:'3',url:'https://app.myinvestor.es/etfs/IE00B44Z5B48'},
  {isin:'IE00B3VWN393',nombre:'iShares MSCI Europe UCITS ETF EUR Dis',tipo:'ETF',categoria:'Renta Variable Europa',mercado:'XETR',ter:0.12,divisa:'EUR',replica:'Física',distribucion:'Distribución',rent1a:8.2,rent3a:7.0,rent5a:8.8,rating:'4',url:'https://app.myinvestor.es/etfs/IE00B3VWN393'},
  {isin:'IE00B53QG562',nombre:'iShares MSCI China UCITS ETF USD Acc',tipo:'ETF',categoria:'Renta Variable China',mercado:'XLON',ter:0.40,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:22.1,rent3a:-4.2,rent5a:0.8,rating:'2',url:'https://app.myinvestor.es/etfs/IE00B53QG562'},
  {isin:'IE00B3RBGN15',nombre:'Vanguard Total Stock Market UCITS ETF',tipo:'ETF',categoria:'Renta Variable USA Total',mercado:'XAMS',ter:0.07,divisa:'USD',replica:'Física',distribucion:'Distribución',rent1a:27.8,rent3a:13.5,rent5a:16.5,rating:'5',url:'https://app.myinvestor.es/etfs/IE00B3RBGN15'},
  {isin:'LU1938316729',nombre:'Lyxor S&P 500 UCITS ETF Acc',tipo:'ETF',categoria:'Renta Variable USA',mercado:'XPAR',ter:0.09,divisa:'USD',replica:'Sintética',distribucion:'Acumulación',rent1a:28.9,rent3a:14.2,rent5a:17.1,rating:'4',url:'https://app.myinvestor.es/etfs/LU1938316729'},
  {isin:'IE00B5MTWH09',nombre:'SPDR S&P 500 ESG Leaders UCITS ETF',tipo:'ETF',categoria:'Renta Variable USA ESG',mercado:'XLON',ter:0.10,divisa:'USD',replica:'Física',distribucion:'Acumulación',rent1a:27.5,rent3a:13.0,rent5a:null,rating:'4',url:'https://app.myinvestor.es/etfs/IE00B5MTWH09'},
  {isin:'IE00BYVJRQ85',nombre:'BlackRock ESG Multi-Asset Conservative Portfolio UCITS ETF',tipo:'ETF',categoria:'Multi-Activo Conservador',mercado:'XLON',ter:0.25,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:7.2,rent3a:0.8,rent5a:null,rating:'3',url:'https://app.myinvestor.es/etfs/IE00BYVJRQ85'},
  {isin:'IE00BJJPQM43',nombre:'BlackRock ESG Multi-Asset Growth Portfolio UCITS ETF',tipo:'ETF',categoria:'Multi-Activo Crecimiento',mercado:'XLON',ter:0.25,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:16.8,rent3a:5.8,rent5a:null,rating:'3',url:'https://app.myinvestor.es/etfs/IE00BJJPQM43'},
  {isin:'IE00B3Z3FS74',nombre:'Vanguard Global Bond Index Fund EUR Hdg Acc',tipo:'Fondo',categoria:'Renta Fija Global',mercado:'',ter:0.15,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:2.2,rent3a:-1.5,rent5a:0.5,rating:'3',url:'https://app.myinvestor.es/fondos/IE00B3Z3FS74'},
  {isin:'LU1273543585',nombre:'Amundi Index MSCI World EUR Hedged AHE-C',tipo:'Fondo',categoria:'Renta Variable Global (Eur Hdg)',mercado:'',ter:0.25,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:22.5,rent3a:10.9,rent5a:13.4,rating:'4',url:'https://app.myinvestor.es/fondos/LU1273543585'},
  {isin:'ES0174199000',nombre:'Baelo Patrimonio FI',tipo:'Fondo',categoria:'Multi-Activo Conservador',mercado:'',ter:0.44,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:12.8,rent3a:7.4,rent5a:8.9,rating:'4',url:'https://app.myinvestor.es/fondos/ES0174199000'},
  {isin:'ES0125057001',nombre:'Cobas Global FI',tipo:'Fondo',categoria:'Renta Variable Global Value',mercado:'',ter:1.50,divisa:'EUR',replica:'Física',distribucion:'Acumulación',rent1a:15.3,rent3a:12.4,rent5a:9.8,rating:'3',url:'https://app.myinvestor.es/fondos/ES0125057001'},
];

// In-memory cache (6h)
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000;

// Intenta obtener datos reales del Apps Script Web App (doGet URL)
// Configurar en Vercel: MYINVESTOR_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
async function fetchFromAppsScript(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  const products = json.products || json.data || json || [];
  if (!Array.isArray(products) || products.length === 0) throw new Error('Sin productos en respuesta');
  // Normalizar columnas del sheet → formato interno
  return products.map(p => ({
    isin:         String(p.isin || p['ISIN'] || ''),
    nombre:       String(p.nombre || p['Nombre'] || ''),
    tipo:         String(p.tipo || p['Tipo'] || 'ETF'),
    categoria:    String(p.categoria || p['Categoría'] || p['Categoria'] || ''),
    mercado:      String(p.mercado || p['Mercado'] || ''),
    ter:          parseFloat(p.ter || p['TER (%)'] || 0) || 0,
    divisa:       String(p.divisa || p['Divisa'] || 'EUR'),
    replica:      String(p.replica || p['Réplica'] || p['Replica'] || ''),
    distribucion: String(p.distribucion || p['Distribución'] || p['Distribucion'] || ''),
    rent1a:       (v => isNaN(v) ? null : v)(parseFloat(p.rent1a || p['Rent. 1A (%)'] || p['rent1a'])),
    rent3a:       (v => isNaN(v) ? null : v)(parseFloat(p.rent3a || p['Rent. 3A (%)'] || p['rent3a'])),
    rent5a:       (v => isNaN(v) ? null : v)(parseFloat(p.rent5a || p['Rent. 5A (%)'] || p['rent5a'])),
    rating:       String(p.rating || p['Rating Morningstar'] || ''),
    url:          String(p.url || p['URL MyInvestor'] || ''),
  })).filter(p => p.isin);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  if (_cache && Date.now() - _cacheAt < CACHE_TTL) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'private, max-age=21600');
    res.setHeader('X-Cache', 'HIT');
    res.statusCode = 200;
    return res.end(JSON.stringify(_cache));
  }

  let products = STATIC_CATALOG;
  let source = 'static';

  // Si hay URL del Apps Script configurada, intentar obtener datos reales
  const appsScriptUrl = process.env.MYINVESTOR_APPS_SCRIPT_URL;
  if (appsScriptUrl) {
    try {
      const live = await fetchFromAppsScript(appsScriptUrl);
      if (live.length > 0) {
        products = live;
        source = 'apps_script';
        console.log(`[myinvestor/catalog] Apps Script: ${live.length} productos`);
      }
    } catch (e) {
      console.warn(`[myinvestor/catalog] Apps Script falló, usando estático: ${e.message}`);
    }
  }

  const body = {
    products,
    count: products.length,
    updated: new Date().toISOString(),
    etfs: products.filter(p => p.tipo === 'ETF').length,
    funds: products.filter(p => p.tipo === 'Fondo').length,
    source,
    note: source === 'static'
      ? 'Catálogo curado de MyInvestor (estático). Para datos reales, configura MYINVESTOR_APPS_SCRIPT_URL.'
      : 'Catálogo en tiempo real obtenido de Google Sheets vía Apps Script.',
  };

  _cache = body;
  _cacheAt = Date.now();

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, max-age=21600');
  res.setHeader('X-Cache', 'MISS');
  res.statusCode = 200;
  return res.end(JSON.stringify(body));
};
