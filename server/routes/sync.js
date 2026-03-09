const express = require('express');
const router = express.Router();

router.get('/status', (req, res) => {
  try {
    const status = req.syncEngine.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trigger', async (req, res) => {
  try {
    await req.syncEngine.triggerSync();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agent control
router.get('/agent/status', (req, res) => {
  try {
    res.json(req.agentController.getStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agent/start', async (req, res) => {
  try {
    await req.agentController.start();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agent/stop', (req, res) => {
  try {
    req.agentController.stop();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
