const express = require('express');
const router = express.Router();

router.get('/expiring', (req, res) => {
  try {
    const daysAhead = Number(req.query.daysAhead || 30);
    const documents = req.db.getWorkersWithExpiringDocuments(daysAhead);
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/expired', (req, res) => {
  try {
    const documents = req.db.getExpiredDocuments();
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const { workerId, workerIds } = req.query;
    const documents = req.db.getWorkerDocuments({
      worker_id: workerId,
      worker_ids: workerIds,
    });
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const document = req.db.createWorkerDocument(req.body);
    res.status(201).json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const document = req.db.updateWorkerDocument(req.params.id, req.body);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    req.db.deleteWorkerDocument(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
