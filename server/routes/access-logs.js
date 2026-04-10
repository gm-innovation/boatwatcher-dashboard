const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const logs = req.db.getAccessLogs(req.query);
    // Normalize timestamps: facial events are stored as BRT-as-UTC in local SQLite.
    // The UI applies formatBrtDateTime (-3h), so we must add +3h here to get real UTC.
    // Manual events already use correct UTC (new Date().toISOString()), skip them.
    for (const log of logs) {
      if (log.source !== 'manual') {
        const d = new Date(log.timestamp);
        d.setUTCHours(d.getUTCHours() + 3);
        log.timestamp = d.toISOString();
      }
    }
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    // Tag manual logs with source so they're distinguishable from facial events
    const logData = { ...req.body, source: req.body.source || 'manual' };
    const log = req.db.insertAccessLog(logData);
    // Trigger fast-lane sync so manual events reach the cloud immediately
    if (req.syncEngine) {
      req.syncEngine.triggerFastLaneSync();
    }
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
