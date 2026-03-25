const express = require('express');
const router = express.Router();
const { enrollUserOnDevice, removeUserFromDevice, loadPhotoAsBase64, getWorkerControlIdCode } = require('../lib/controlid');

router.get('/', (req, res) => {
  try {
    const workers = req.db.getWorkers(req.query);
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const worker = req.db.getWorkerById(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const worker = req.db.createWorker(req.body);
    res.status(201).json(worker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const worker = req.db.updateWorker(req.params.id, req.body);
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/enrollment', async (req, res) => {
  try {
    const action = req.body?.action === 'remove' ? 'remove' : 'enroll';
    let deviceIds = Array.isArray(req.body?.deviceIds) ? [...new Set(req.body.deviceIds.filter(Boolean))] : [];

    const worker = req.db.getWorkerById(req.params.id);
    if (!worker) {
      return res.status(404).json({ success: false, error: 'Worker not found' });
    }

    // Auto-resolve devices from worker's allowed_project_ids when no deviceIds provided
    if (deviceIds.length === 0) {
      const allowedProjects = Array.isArray(worker.allowed_project_ids)
        ? worker.allowed_project_ids
        : (typeof worker.allowed_project_ids === 'string' ? JSON.parse(worker.allowed_project_ids || '[]') : []);

      if (allowedProjects.length > 0 && req.db.getAllDevices) {
        const allDevices = req.db.getAllDevices();
        deviceIds = allDevices
          .filter((d) => d.project_id && allowedProjects.includes(d.project_id))
          .map((d) => d.id);
      }
    }

    if (deviceIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum dispositivo encontrado para os projetos do trabalhador.' });
    }

    const devices = deviceIds
      .map((deviceId) => req.db.getDeviceById?.(deviceId))
      .filter(Boolean);

    if (devices.length === 0) {
      return res.status(404).json({ success: false, error: 'Nenhum dispositivo válido foi encontrado.' });
    }

    let photoBase64 = null;
    let photoNotice = null;

    if (action === 'enroll') {
      if (!worker.photo_url) {
        photoNotice = 'Trabalhador sem foto biométrica cadastrada.';
      } else {
        try {
          photoBase64 = await loadPhotoAsBase64(worker.photo_url);
          if (!photoBase64) {
            photoNotice = 'Foto do trabalhador indisponível para biometria.';
          }
        } catch (error) {
          photoNotice = `Foto indisponível para biometria: ${error.message}`;
        }
      }
    }

    const currentEnrolled = Array.isArray(worker.devices_enrolled) ? worker.devices_enrolled : [];
    const nextEnrolled = new Set(currentEnrolled);
    const results = [];

    for (const device of devices) {
      try {
        const result = action === 'enroll'
          ? await enrollUserOnDevice(device, worker, photoBase64)
          : await removeUserFromDevice(device, worker.id, worker.code);

        if (result.success) {
          if (action === 'enroll') nextEnrolled.add(device.id);
          if (action === 'remove') nextEnrolled.delete(device.id);
        }

        results.push({
          deviceId: device.id,
          deviceName: device.name,
          ...result,
        });
      } catch (error) {
        results.push({
          deviceId: device.id,
          deviceName: device.name,
          success: false,
          error: error.message,
        });
      }
    }

    const updatedDevicesEnrolled = Array.from(nextEnrolled);
    const updatedWorker = req.db.updateWorker(worker.id, {
      devices_enrolled: updatedDevicesEnrolled,
    });

    const successCount = results.filter((item) => item.success).length;
    const failureCount = results.length - successCount;
    const warningCount = results.filter((item) => item.warning).length;

    let message = `${action === 'enroll' ? 'Enrollment' : 'Remoção'} concluído(a) em ${successCount}/${results.length} dispositivo(s).`;
    if (failureCount > 0) {
      message += ` ${failureCount} falha(s).`;
    }
    if (photoNotice) {
      message += ` ${photoNotice}`;
    } else if (warningCount > 0) {
      message += ' Parte dos dispositivos concluiu sem biometria facial.';
    }

    res.json({
      success: failureCount === 0,
      message,
      results,
      devicesEnrolled: updatedDevicesEnrolled,
      worker: updatedWorker,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const worker = req.db.getWorkerById(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    // Remove from all enrolled devices before deleting
    const enrolledDevices = Array.isArray(worker.devices_enrolled) ? worker.devices_enrolled : [];
    for (const deviceId of enrolledDevices) {
      const device = req.db.getDeviceById?.(deviceId);
      if (!device || !device.controlid_ip_address) continue;
      try {
        await removeUserFromDevice(device, worker.id, worker.code);
        console.log(`Removed worker ${worker.name} from device ${device.name}`);
      } catch (err) {
        console.warn(`Failed to remove worker ${worker.name} from device ${device.name}: ${err.message}`);
      }
    }

    req.db.deleteWorker(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
