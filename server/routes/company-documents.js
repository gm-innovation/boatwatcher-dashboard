const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    const documents = req.db.getCompanyDocuments(companyId);
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const document = req.db.createCompanyDocument(req.body);
    res.status(201).json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
