const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();

const DATA_DIR = process.env.BW_DATA_DIR || path.join(__dirname, '..', 'data');

router.post('/upload', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  try {
    const bucket = req.query.bucket || 'general';
    const filename = req.query.path || `${uuidv4()}.bin`;
    const dir = path.join(DATA_DIR, 'files', bucket);
    
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), req.body);
    
    const fileUrl = `/files/${bucket}/${filename}`;
    res.json({ url: fileUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/url', (req, res) => {
  const { bucket, path: filePath } = req.query;
  if (!bucket || !filePath) return res.status(400).json({ error: 'bucket and path required' });
  
  const fullPath = path.join(DATA_DIR, 'files', bucket, filePath);
  if (fs.existsSync(fullPath)) {
    res.json({ url: `/files/${bucket}/${filePath}` });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

module.exports = router;
