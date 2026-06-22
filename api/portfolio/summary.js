// GET /api/portfolio/summary?isins=A,B&quantities=10,20&buyPrices=100,50&currentPrices=150,60
const { setupApi, sendError } = require('../../lib/security');

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 60 })) return;

  const isins = String(req.query?.isins || '').split(',').filter(Boolean);
  const quantities = String(req.query?.quantities || '').split(',').map(Number);
  const buyPrices = String(req.query?.buyPrices || '').split(',').map(Number);
  const currentPrices = String(req.query?.currentPrices || '').split(',').map(Number);

  if (!isins.length) return sendError(res, 400, 'isins required');

  let totalValue = 0, totalInvested = 0;
  const positions = [];

  for (let i = 0; i < isins.length; i++) {
    const qty = quantities[i] || 0;
    const buy = buyPrices[i] || 0;
    const cur = currentPrices[i] || 0;
    const value = qty * cur;
    const invested = qty * buy;
    const gain = value - invested;
    const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
    totalValue += value;
    totalInvested += invested;
    positions.push({ isin: isins[i], value, invested, gain, gainPct });
  }

  const totalGain = totalValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const sorted = [...positions].sort((a, b) => b.gainPct - a.gainPct);

  res.statusCode = 200;
  res.end(JSON.stringify({
    totalValue: +totalValue.toFixed(2),
    totalInvested: +totalInvested.toFixed(2),
    totalGain: +totalGain.toFixed(2),
    totalGainPct: +totalGainPct.toFixed(2),
    assetCount: isins.length,
    topPerformer: sorted[0] || null,
    worstPerformer: sorted[sorted.length - 1] || null,
    positions,
    generatedAt: new Date().toISOString(),
  }));
};
