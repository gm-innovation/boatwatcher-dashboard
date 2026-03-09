import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[check-expiring-documents] Starting...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get admin users
    const { data: adminUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (!adminUsers || adminUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No admin users', stats: {} }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserIds = adminUsers.map(u => u.user_id);

    // Get documents with expiry dates
    const { data: documents, error: docsError } = await supabase
      .from('worker_documents')
      .select('id, worker_id, document_type, expiry_date, worker:workers(name, company_id)')
      .not('expiry_date', 'is', null);

    if (docsError) throw docsError;
    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No documents to check', stats: {} }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const stats = { expired: 0, expiring7days: 0, expiring15days: 0, expiring30days: 0, notificationsCreated: 0, workersUpdated: 0 };

    // Check recent notifications to avoid duplicates
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifications } = await supabase
      .from('notifications')
      .select('related_entity_id, type')
      .in('type', ['document_expired', 'document_expiring'])
      .gte('created_at', oneDayAgo);

    const recentKeys = new Set((recentNotifications || []).map(n => `${n.related_entity_id}-${n.type}`));
    const notificationsToCreate: any[] = [];
    const workersToReview = new Set<string>();

    for (const doc of documents as any[]) {
      if (!doc.expiry_date) continue;

      const expiryDate = new Date(doc.expiry_date);
      const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const workerName = doc.worker?.name || 'Trabalhador desconhecido';

      let notificationType: string | null = null;
      let priority = 'low', title = '', message = '';

      if (diffDays < 0) {
        stats.expired++;
        notificationType = 'document_expired';
        priority = 'critical';
        title = 'Documento Vencido';
        message = `O documento ${doc.document_type} de ${workerName} está vencido há ${Math.abs(diffDays)} dias`;
        if (doc.worker_id) workersToReview.add(doc.worker_id);
      } else if (diffDays <= 7) {
        stats.expiring7days++;
        notificationType = 'document_expiring';
        priority = 'high';
        title = 'Documento Vence em Breve';
        message = `O documento ${doc.document_type} de ${workerName} vence em ${diffDays} dias`;
      } else if (diffDays <= 15) {
        stats.expiring15days++;
        notificationType = 'document_expiring';
        priority = 'normal';
        title = 'Documento Próximo do Vencimento';
        message = `O documento ${doc.document_type} de ${workerName} vence em ${diffDays} dias`;
      } else if (diffDays <= 30) {
        stats.expiring30days++;
        notificationType = 'document_expiring';
        priority = 'low';
        title = 'Aviso de Vencimento';
        message = `O documento ${doc.document_type} de ${workerName} vence em ${diffDays} dias`;
      }

      if (notificationType && !recentKeys.has(`${doc.id}-${notificationType}`)) {
        for (const adminId of adminUserIds) {
          notificationsToCreate.push({
            user_id: adminId, type: notificationType, title, message, priority,
            related_entity_type: 'worker_document', related_entity_id: doc.id,
          });
        }
      }
    }

    // Insert notifications
    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await supabase.from('notifications').insert(notificationsToCreate);
      if (insertError) throw insertError;
      stats.notificationsCreated = notificationsToCreate.length;
    }

    // Phase 5: Mark workers with expired docs as pending_review
    if (workersToReview.size > 0) {
      const workerIds = Array.from(workersToReview);
      const { error: updateError } = await supabase
        .from('workers')
        .update({ status: 'pending_review' })
        .in('id', workerIds)
        .in('status', ['active']); // Only update active workers

      if (!updateError) {
        stats.workersUpdated = workerIds.length;
      }
    }

    console.log('[check-expiring-documents] Done:', stats);
    return new Response(
      JSON.stringify({ success: true, stats }),
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
