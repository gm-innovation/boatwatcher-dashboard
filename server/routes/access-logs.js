const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const logs = req.db.getAccessLogs(req.query);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const log = req.db.insertAccessLog(req.body);
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
