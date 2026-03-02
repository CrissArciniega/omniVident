const express = require('express');
const auth = require('../middleware/auth');
const { getProducts, getSummary, getCountries, getCategories, getReport } = require('../services/marketParser');

const router = express.Router();

router.get('/products', auth, (req, res) => {
  try {
    const { country, category, sort, page, limit } = req.query;
    const result = getProducts({
      country,
      category,
      sort,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(result);
  } catch (err) {
    console.error('[Market] Error products:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/summary', auth, (req, res) => {
  try {
    res.json(getSummary());
  } catch (err) {
    console.error('[Market] Error summary:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/countries', auth, (req, res) => {
  try {
    res.json(getCountries());
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/categories', auth, (req, res) => {
  try {
    res.json(getCategories());
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/report', auth, (req, res) => {
  try {
    const report = getReport();
    if (!report) return res.status(404).json({ error: 'No hay reporte disponible' });
    res.type('html').send(report);
  } catch (err) {
    console.error('[Market] Error report:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
