const express = require('express');
const router = express.Router();

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

module.exports = router;
