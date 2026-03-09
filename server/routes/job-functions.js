const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const functions = req.db.getJobFunctions();
    res.json(functions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const fn = req.db.createJobFunction?.(req.body);
    res.status(201).json(fn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const fn = req.db.updateJobFunction?.(req.params.id, req.body);
    res.json(fn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    req.db.deleteJobFunction?.(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
