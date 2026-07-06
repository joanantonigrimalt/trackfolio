// GET /api/portfolio/shared?token=XXXX
// Public, read-only view of a shared portfolio. Resolves the share token to the
// owner's live positions (server-side, service_role), prices them in EUR, and
// returns a render-ready snapshot. If the share has hide_amounts=true, absolute
// € values are stripped server-side (only weights % and returns % are sent).

const { resolveAssetData, resolveFromCache } = require('../../lib/providers');
const { toEur } = require('../../lib/fx');
const { setupApi, sendError } = require('../../lib/security');

const PER_ASSET_MS = 6000; // per-asset resolve budget (Vercel 10s limit)

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise(r => setTimeout(() => r(null), ms))]);
}

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 40 })) return;

  const token = String(req.query.token || '').trim();
  if (!token || token.length < 8) return sendError(res, 400, 'Token no válido');

  const sbUrl = process.env.SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !svcKey) return sendError(res, 503, 'No configurado');
  const H = { apikey: svcKey, Authorization: `Bearer ${svcKey}` };

  try {
    // 1. Resolve the share token → owner
    const sr = await fetch(`${sbUrl}/rest/v1/portfolio_shares?token=eq.${encodeURIComponent(token)}&select=user_id,display_name,hide_amounts&limit=1`, { headers: H });
    const shares = sr.ok ? await sr.json() : [];
    const share = Array.isArray(shares) && shares[0];
    if (!share) return sendError(res, 404, 'Este enlace no existe o ha sido revocado');

    // 2. Fetch the owner's positions
    const pr = await fetch(`${sbUrl}/rest/v1/user_positions?user_id=eq.${encodeURIComponent(share.user_id)}&select=overrides,custom_assets,liquidity&limit=1`, { headers: H });
    const rows = pr.ok ? await pr.json() : [];
    const pos = (Array.isArray(rows) && rows[0]) || {};
    const parse = (v, d) => (typeof v === 'string' ? (() => { try { return JSON.parse(v || d); } catch { return JSON.parse(d); } })() : (v || JSON.parse(d)));
    const overrides = parse(pos.overrides, '{}');
    const customAssets = parse(pos.custom_assets, '{}');
    const liquidity = parse(pos.liquidity, '[]');

    // 3. Resolve each held position to EUR (parallel, bounded)
    const isins = Object.keys(overrides).filter(k => Number(overrides[k] && overrides[k].quantity || 0) > 0);
    const positions = await Promise.all(isins.map(async (isin) => {
      const ov = overrides[isin] || {};
      const qty = Number(ov.quantity) || 0;
      const avg = Number(ov.avgCost) || 0;
      const costCcy = ov.costCurrency || 'EUR';
      const ca = customAssets[isin] || {};
      let price = 0, priceCcy = 'EUR', name = ca.name || ca.shortName || isin, type = ca.type || '';
      const resolved = (await resolveFromCache(isin).catch(() => null)) || (await withTimeout(resolveAssetData(isin).catch(() => null), PER_ASSET_MS));
      if (resolved && resolved.data && resolved.data.quote) {
        const q = resolved.data.quote;
        const p = Number(q.price != null ? q.price : q.close);
        if (Number.isFinite(p) && p > 0) { price = p; priceCcy = q.currency || 'EUR'; }
        if (!ca.name && resolved.mapping && resolved.mapping.name) name = resolved.mapping.name;
        if (!type && resolved.mapping && resolved.mapping.type) type = resolved.mapping.type;
      }
      if (price <= 0 && Number(ca.currentPrice) > 0) { price = Number(ca.currentPrice); priceCcy = ca.currency || 'EUR'; }
      const valueEur = await toEur(qty * price, priceCcy);
      const investedEur = await toEur(qty * avg, costCcy);
      const gainPct = investedEur > 0 ? (valueEur - investedEur) / investedEur * 100 : 0;
      return { name, type, valueEur, investedEur, gainPct };
    }));

    // 4. Liquidity to EUR
    const liq = await Promise.all((Array.isArray(liquidity) ? liquidity : []).map(async (l) => ({
      name: l.name || 'Efectivo', type: l.type || 'cash', rate: Number(l.rate) || 0,
      amountEur: await toEur(Number(l.amount) || 0, l.currency || 'EUR'),
    })));

    const totalAssets = positions.reduce((s, p) => s + p.valueEur, 0);
    const totalInvested = positions.reduce((s, p) => s + p.investedEur, 0);
    const totalLiq = liq.reduce((s, l) => s + l.amountEur, 0);
    const grand = totalAssets + totalLiq;
    const gainPct = totalInvested > 0 ? (totalAssets - totalInvested) / totalInvested * 100 : 0;
    const hide = !!share.hide_amounts;
    const r2 = n => Math.round(n * 100) / 100;
    const w = v => grand > 0 ? Number((v / grand * 100).toFixed(1)) : 0;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.end(JSON.stringify({
      displayName: share.display_name || 'Inversor',
      hideAmounts: hide,
      updatedAt: new Date().toISOString(),
      count: positions.length,
      gainPct: Number(gainPct.toFixed(2)),
      total: hide ? null : r2(grand),
      invested: hide ? null : r2(totalInvested),
      positions: positions.sort((a, b) => b.valueEur - a.valueEur).map(p => ({
        name: p.name, type: p.type, weight: w(p.valueEur),
        gainPct: Number(p.gainPct.toFixed(2)), value: hide ? null : r2(p.valueEur),
      })),
      liquidity: liq.map(l => ({
        name: l.name, type: l.type, rate: l.rate, weight: w(l.amountEur),
        value: hide ? null : r2(l.amountEur),
      })),
    }));
  } catch (e) {
    sendError(res, 500, 'Error interno');
  }
};
