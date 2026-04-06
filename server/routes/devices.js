const express = require('express');
const router = express.Router();
const { controlIdRequest, clearAllUsersFromDevice, enrollUserOnDevice, loadPhotoAsBase64 } = require('../lib/controlid');

async function executeDeviceAction(db, device, action, params = {}) {
  switch (action) {
    case 'getDeviceInfo': {
      const data = await controlIdRequest(device, '/device_info.fcgi', 'GET');
      return {
        success: true,
        message: 'Informações do dispositivo obtidas com sucesso.',
        device: db.getDeviceById?.(device.id),
        data,
      };
    }

    case 'getDeviceStatus': {
      try {
        const data = await controlIdRequest(device, '/device_info.fcgi', 'GET');
        const updatedDevice = db.updateDevice?.(device.id, {
          status: 'online',
          last_event_timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          message: 'Dispositivo online e respondendo normalmente.',
          device: updatedDevice,
          status: updatedDevice?.status || 'online',
          data,
        };
      } catch (error) {
        const updatedDevice = db.updateDevice?.(device.id, { status: 'offline' });
        return {
          success: false,
          message: 'Dispositivo offline ou inacessível.',
          error: error.message,
          device: updatedDevice,
          status: updatedDevice?.status || 'offline',
        };
      }
    }

    case 'listUsers': {
      const data = await controlIdRequest(device, '/users.fcgi', 'POST', { object: 'users' });
      return {
        success: true,
        message: 'Usuários do dispositivo carregados.',
        device: db.getDeviceById?.(device.id),
        data,
      };
    }

    case 'releaseAccess': {
      const data = await controlIdRequest(device, '/execute_actions.fcgi', 'POST', {
        actions: [{
          action: 'door',
          parameters: `door=${Number(params.doorId || 1)}`,
        }],
      });

      return {
        success: true,
        message: `Comando de abertura enviado para a porta ${Number(params.doorId || 1)}.`,
        device: db.getDeviceById?.(device.id),
        data,
      };
    }

    case 'configureDevice': {
      const data = await controlIdRequest(device, '/set_configuration.fcgi', 'POST', params.config || {});
      const updatedDevice = db.updateDevice?.(device.id, {
        configuration: params.config || {},
      });

      return {
        success: true,
        message: 'Configuração aplicada ao dispositivo.',
        device: updatedDevice,
        data,
      };
    }

    default:
      throw new Error(`Ação não suportada: ${action}`);
  }
}

router.get('/', (req, res) => {
  try {
    const devices = req.db.getDevices(req.query.projectId);
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const device = req.db.getDeviceById?.(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const device = req.db.createDevice?.(req.body);
    req.agentController.reloadDevices?.();
    res.status(201).json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const device = req.db.updateDevice?.(req.params.id, req.body);
    req.agentController.reloadDevices?.();
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    req.db.deleteDevice?.(req.params.id);
    req.agentController.reloadDevices?.();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/actions', async (req, res) => {
  try {
    const device = req.db.getDeviceById?.(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const result = await executeDeviceAction(req.db, device, req.body?.action, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/devices/:id/full-resync
 * Clears all users from the device and re-enrolls all active workers.
 */
router.post('/:id/full-resync', async (req, res) => {
  try {
    const device = req.db.getDeviceById?.(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    if (!device.controlid_ip_address) {
      return res.status(400).json({ error: 'Dispositivo sem IP configurado.' });
    }

    console.log(`[full-resync] Starting full resync for device ${device.name} (${device.controlid_ip_address})`);

    // Step 1: Clear all users from device
    const clearResult = await clearAllUsersFromDevice(device);
    if (!clearResult.success) {
      return res.status(500).json({ error: clearResult.error || 'Falha ao limpar dispositivo.' });
    }
    console.log(`[full-resync] Cleared ${clearResult.removed} users from device ${device.name}`);

    // Step 2: Get all active workers from local DB
    const workers = req.db.getWorkers?.() || [];
    const activeWorkers = workers.filter(w => w.status === 'active' || !w.status);
    console.log(`[full-resync] Re-enrolling ${activeWorkers.length} active workers on device ${device.name}`);

    let enrolled = 0;
    let failed = 0;
    const errors = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < activeWorkers.length; i += BATCH_SIZE) {
      const batch = activeWorkers.slice(i, i + BATCH_SIZE);
      for (const worker of batch) {
        try {
          let photoBase64 = null;
          if (worker.photo_url) {
            try {
              photoBase64 = await loadPhotoAsBase64(worker.photo_url);
            } catch (photoErr) {
              // Enroll without photo
            }
          }
          const result = await enrollUserOnDevice(device, worker, photoBase64);
          if (result.success) {
            enrolled++;
          } else {
            failed++;
            errors.push({ worker: worker.name, code: worker.code, error: result.error || result.warning });
          }
        } catch (err) {
          failed++;
          errors.push({ worker: worker.name, code: worker.code, error: err.message });
        }
      }
      console.log(`[full-resync] Progress: ${Math.min(i + BATCH_SIZE, activeWorkers.length)}/${activeWorkers.length}`);
    }

    console.log(`[full-resync] Completed: ${enrolled} enrolled, ${failed} failed`);
    res.json({
      success: true,
      message: `Re-sincronização completa: ${enrolled} cadastrados, ${failed} falhas.`,
      enrolled,
      failed,
      totalWorkers: activeWorkers.length,
      cleared: clearResult.removed,
      errors: errors.slice(0, 20), // Limit error details
    });
  } catch (err) {
    console.error(`[full-resync] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
