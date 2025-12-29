import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerDocument {
  id: string;
  worker_id: string;
  document_type: string;
  expiry_date: string | null;
  worker?: {
    name: string;
    company_id: string;
  };
}

interface NotificationPayload {
  user_id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  related_entity_type: string;
  related_entity_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[check-expiring-documents] Starting document expiration check...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all admin users to notify
    const { data: adminUsers, error: adminError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminError) {
      console.error('[check-expiring-documents] Error fetching admin users:', adminError);
      throw adminError;
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.log('[check-expiring-documents] No admin users found to notify');
      return new Response(
        JSON.stringify({ success: true, message: 'No admin users to notify', stats: {} }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserIds = adminUsers.map(u => u.user_id);
    console.log(`[check-expiring-documents] Found ${adminUserIds.length} admin users to notify`);

    // Get all worker documents with expiry dates
    const { data: documents, error: docsError } = await supabase
      .from('worker_documents')
      .select(`
        id,
        worker_id,
        document_type,
        expiry_date,
        worker:workers(name, company_id)
      `)
      .not('expiry_date', 'is', null);

    if (docsError) {
      console.error('[check-expiring-documents] Error fetching documents:', docsError);
      throw docsError;
    }

    if (!documents || documents.length === 0) {
      console.log('[check-expiring-documents] No documents with expiry dates found');
      return new Response(
        JSON.stringify({ success: true, message: 'No documents to check', stats: {} }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-expiring-documents] Found ${documents.length} documents to check`);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const stats = {
      expired: 0,
      expiring7days: 0,
      expiring15days: 0,
      expiring30days: 0,
      notificationsCreated: 0,
      skippedDuplicates: 0,
    };

    // Check existing recent notifications to avoid duplicates
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifications } = await supabase
      .from('notifications')
      .select('related_entity_id, type')
      .in('type', ['document_expired', 'document_expiring'])
      .gte('created_at', oneDayAgo);

    const recentNotificationKeys = new Set(
      (recentNotifications || []).map(n => `${n.related_entity_id}-${n.type}`)
    );

    const notificationsToCreate: NotificationPayload[] = [];

    for (const doc of documents as WorkerDocument[]) {
      if (!doc.expiry_date) continue;
      
      const expiryDate = new Date(doc.expiry_date);
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const workerName = doc.worker?.name || 'Trabalhador desconhecido';
      
      let notificationType: string | null = null;
      let priority: string = 'low';
      let title: string = '';
      let message: string = '';

      if (diffDays < 0) {
        // Already expired
        stats.expired++;
        notificationType = 'document_expired';
        priority = 'critical';
        title = 'Documento Vencido';
        message = `O documento ${doc.document_type} de ${workerName} está vencido há ${Math.abs(diffDays)} dias`;
      } else if (diffDays <= 7) {
        // Expires in 7 days or less
        stats.expiring7days++;
        notificationType = 'document_expiring';
        priority = 'high';
        title = 'Documento Vence em Breve';
        message = `O documento ${doc.document_type} de ${workerName} vence em ${diffDays} dias`;
      } else if (diffDays <= 15) {
        // Expires in 15 days or less
        stats.expiring15days++;
        notificationType = 'document_expiring';
        priority = 'normal';
        title = 'Documento Próximo do Vencimento';
        message = `O documento ${doc.document_type} de ${workerName} vence em ${diffDays} dias`;
      } else if (diffDays <= 30) {
        // Expires in 30 days or less
        stats.expiring30days++;
        notificationType = 'document_expiring';
        priority = 'low';
        title = 'Aviso de Vencimento';
        message = `O documento ${doc.document_type} de ${workerName} vence em ${diffDays} dias`;
      }

      if (notificationType) {
        const notificationKey = `${doc.id}-${notificationType}`;
        
        if (recentNotificationKeys.has(notificationKey)) {
          stats.skippedDuplicates++;
          continue;
        }

        // Create notification for each admin
        for (const adminId of adminUserIds) {
          notificationsToCreate.push({
            user_id: adminId,
            type: notificationType,
            title,
            message,
            priority,
            related_entity_type: 'worker_document',
            related_entity_id: doc.id,
          });
        }
      }
    }

    // Batch insert notifications
    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notificationsToCreate);

      if (insertError) {
        console.error('[check-expiring-documents] Error inserting notifications:', insertError);
        throw insertError;
      }

      stats.notificationsCreated = notificationsToCreate.length;
      console.log(`[check-expiring-documents] Created ${stats.notificationsCreated} notifications`);
    }

    console.log('[check-expiring-documents] Check completed:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Document check completed',
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[check-expiring-documents] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
