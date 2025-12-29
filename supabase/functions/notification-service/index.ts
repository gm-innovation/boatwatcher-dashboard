import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  type: 'device_offline' | 'document_expiring' | 'document_expired' | 'access_denied' | 'worker_irregular';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  related_entity_type?: string;
  related_entity_id?: string;
  user_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[notification-service] Starting notification check...');

    const notifications: NotificationPayload[] = [];

    // 1. Check for offline devices (offline for more than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: offlineDevices, error: devicesError } = await supabase
      .from('devices')
      .select('id, name, status, updated_at')
      .eq('status', 'offline')
      .lt('updated_at', fiveMinutesAgo);

    if (devicesError) {
      console.error('[notification-service] Error fetching devices:', devicesError);
    } else if (offlineDevices && offlineDevices.length > 0) {
      console.log(`[notification-service] Found ${offlineDevices.length} offline devices`);
      
      for (const device of offlineDevices) {
        notifications.push({
          type: 'device_offline',
          title: 'Dispositivo Offline',
          message: `O dispositivo "${device.name}" está offline há mais de 5 minutos`,
          priority: 'high',
          related_entity_type: 'device',
          related_entity_id: device.id
        });
      }
    }

    // 2. Check for expiring documents (30, 15, 7 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: expiringDocs, error: docsError } = await supabase
      .from('worker_documents')
      .select(`
        id,
        document_type,
        expiry_date,
        worker_id,
        workers(name)
      `)
      .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0])
      .gte('expiry_date', now.toISOString().split('T')[0]);

    if (docsError) {
      console.error('[notification-service] Error fetching documents:', docsError);
    } else if (expiringDocs && expiringDocs.length > 0) {
      console.log(`[notification-service] Found ${expiringDocs.length} expiring documents`);
      
      for (const doc of expiringDocs) {
        const expiryDate = new Date(doc.expiry_date);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        
        let priority: 'high' | 'medium' | 'low' = 'low';
        if (daysUntilExpiry <= 7) priority = 'high';
        else if (daysUntilExpiry <= 15) priority = 'medium';

        const workerName = (doc.workers as any)?.name || 'Trabalhador';
        
        notifications.push({
          type: 'document_expiring',
          title: 'Documento Vencendo',
          message: `${doc.document_type} de ${workerName} vence em ${daysUntilExpiry} dias`,
          priority,
          related_entity_type: 'worker_document',
          related_entity_id: doc.id
        });
      }
    }

    // 3. Check for expired documents
    const { data: expiredDocs, error: expiredError } = await supabase
      .from('worker_documents')
      .select(`
        id,
        document_type,
        expiry_date,
        worker_id,
        workers(name)
      `)
      .lt('expiry_date', now.toISOString().split('T')[0]);

    if (expiredError) {
      console.error('[notification-service] Error fetching expired documents:', expiredError);
    } else if (expiredDocs && expiredDocs.length > 0) {
      console.log(`[notification-service] Found ${expiredDocs.length} expired documents`);
      
      for (const doc of expiredDocs) {
        const workerName = (doc.workers as any)?.name || 'Trabalhador';
        
        notifications.push({
          type: 'document_expired',
          title: 'Documento Vencido',
          message: `${doc.document_type} de ${workerName} está vencido`,
          priority: 'high',
          related_entity_type: 'worker_document',
          related_entity_id: doc.id
        });
      }
    }

    // 4. Check for repeated access denials (3+ in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: deniedAccess, error: accessError } = await supabase
      .from('access_logs')
      .select('worker_id, worker_name')
      .eq('access_status', 'denied')
      .gte('timestamp', oneHourAgo);

    if (accessError) {
      console.error('[notification-service] Error fetching access logs:', accessError);
    } else if (deniedAccess && deniedAccess.length > 0) {
      // Group by worker
      const denialsByWorker = deniedAccess.reduce((acc, log) => {
        if (log.worker_id) {
          acc[log.worker_id] = acc[log.worker_id] || { count: 0, name: log.worker_name };
          acc[log.worker_id].count++;
        }
        return acc;
      }, {} as Record<string, { count: number; name: string }>);

      for (const [workerId, data] of Object.entries(denialsByWorker)) {
        if (data.count >= 3) {
          notifications.push({
            type: 'access_denied',
            title: 'Acessos Negados Repetidos',
            message: `${data.name || 'Trabalhador'} teve ${data.count} acessos negados na última hora`,
            priority: 'high',
            related_entity_type: 'worker',
            related_entity_id: workerId
          });
        }
      }
    }

    // Insert notifications (avoiding duplicates by checking recent similar notifications)
    let insertedCount = 0;
    const oneHourAgoDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    for (const notification of notifications) {
      // Check if similar notification already exists
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', notification.type)
        .eq('related_entity_id', notification.related_entity_id || '')
        .gte('created_at', oneHourAgoDate)
        .limit(1);

      if (!existing || existing.length === 0) {
        const { error: insertError } = await supabase
          .from('notifications')
          .insert({
            type: notification.type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            related_entity_type: notification.related_entity_type,
            related_entity_id: notification.related_entity_id,
            user_id: notification.user_id || null
          });

        if (insertError) {
          console.error('[notification-service] Error inserting notification:', insertError);
        } else {
          insertedCount++;
        }
      }
    }

    console.log(`[notification-service] Completed. Created ${insertedCount} new notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        checked: {
          offlineDevices: offlineDevices?.length || 0,
          expiringDocuments: expiringDocs?.length || 0,
          expiredDocuments: expiredDocs?.length || 0,
          accessDenials: deniedAccess?.length || 0
        },
        notificationsCreated: insertedCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[notification-service] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
