// Dispatcher for MyInvestor endpoints — merged into ONE serverless function to
// stay under Vercel Hobby's 12-function limit. Routed via vercel.json rewrites:
//   /api/myinvestor/catalog  → /api/myinvestor/data?mode=catalog
//   /api/myinvestor/returns  → /api/myinvestor/data?mode=returns
const catalog = require('../../lib/myinvestor-catalog');
const returns = require('../../lib/myinvestor-returns');

module.exports = (req, res) =>
  (req.query && req.query.mode === 'returns') ? returns(req, res) : catalog(req, res);
