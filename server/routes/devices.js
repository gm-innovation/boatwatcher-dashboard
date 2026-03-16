const express = require('express');
const router = express.Router();
const { controlIdRequest } = require('../lib/controlid');

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

module.exports = router;
