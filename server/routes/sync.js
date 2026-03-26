const express = require('express');
const path = require('path');
const router = express.Router();

const serverVersion = (() => {
  try { return require(path.join(__dirname, '..', 'package.json')).version; }
  catch { return 'unknown'; }
})();

router.get('/status', (req, res) => {
  try {
    const status = req.syncEngine.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bootstrap', async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken) {
      return res.status(400).json({ error: 'accessToken is required' });
    }

    const status = await req.syncEngine.bootstrapFromAccessToken(accessToken);
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

// Reset all checkpoints and do a full re-sync
router.post('/reset-and-full-sync', async (req, res) => {
  try {
    const status = await req.syncEngine.resetAndFullSync();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fast-lane: trigger immediate log upload
router.post('/fast-upload-logs', async (req, res) => {
  try {
    req.syncEngine.triggerFastLaneSync();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agent control (includes telemetry: capturedEventsCount, ignoredDedupeCount, etc.)
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
