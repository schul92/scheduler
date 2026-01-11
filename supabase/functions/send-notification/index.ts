/**
 * Send Notification Edge Function
 *
 * Sends push notifications to team members when:
 * - They are assigned to a service
 *
 * Uses Expo Push Notification API
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS headers for local development
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Expo Push API endpoint
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

interface NotificationRequest {
  serviceId: string;
  type: 'assignment';
}

/**
 * Send push notifications via Expo Push API
 */
async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) {
    console.log('[SendNotification] No messages to send');
    return;
  }

  try {
    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('[SendNotification] Expo Push API response:', JSON.stringify(result));

    // Check for errors in the response
    if (result.data) {
      result.data.forEach((ticket: any, index: number) => {
        if (ticket.status === 'error') {
          console.error(`[SendNotification] Error sending to ${messages[index].to}:`, ticket.message);
        }
      });
    }
  } catch (error) {
    console.error('[SendNotification] Failed to send push notifications:', error);
    throw error;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { serviceId, type }: NotificationRequest = await req.json();

    console.log('[SendNotification] Request:', { serviceId, type });

    if (!serviceId || type !== 'assignment') {
      return new Response(
        JSON.stringify({ error: 'Invalid request: serviceId and type=assignment required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, name, service_date, start_time, team_id')
      .eq('id', serviceId)
      .single();

    if (serviceError || !service) {
      console.error('[SendNotification] Service not found:', serviceError);
      return new Response(
        JSON.stringify({ error: 'Service not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get team info for the notification
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', service.team_id)
      .single();

    // Get all assigned members with their push tokens
    const { data: assignments, error: assignError } = await supabase
      .from('service_assignments')
      .select(`
        id,
        team_member_id,
        team_member:team_members!inner (
          id,
          user_id,
          notifications_enabled,
          user:users!inner (
            id,
            push_token,
            preferred_language
          )
        )
      `)
      .eq('service_id', serviceId);

    if (assignError) {
      console.error('[SendNotification] Error fetching assignments:', assignError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch assignments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SendNotification] Found assignments:', assignments?.length || 0);

    // Build notification messages
    const messages: ExpoPushMessage[] = [];

    for (const assignment of assignments || []) {
      const member = assignment.team_member as any;
      const user = member?.user;

      // Skip if no push token or notifications disabled
      if (!user?.push_token) {
        console.log('[SendNotification] Skipping - no push token for member:', member?.id);
        continue;
      }

      if (member?.notifications_enabled === false) {
        console.log('[SendNotification] Skipping - notifications disabled for member:', member?.id);
        continue;
      }

      // Format date for display
      const serviceDate = new Date(service.service_date);
      const dateStr = `${serviceDate.getMonth() + 1}/${serviceDate.getDate()}`;

      // Build localized message
      const isKorean = user.preferred_language === 'ko';
      const title = isKorean ? '예배 배정 알림' : 'Service Assignment';
      const body = isKorean
        ? `${dateStr} ${service.name}에 배정되었습니다`
        : `You've been assigned to ${service.name} on ${dateStr}`;

      messages.push({
        to: user.push_token,
        title,
        body,
        data: {
          type: 'assignment',
          serviceId: service.id,
          teamId: service.team_id,
          date: service.service_date,
        },
        sound: 'default',
        channelId: 'default',
      });
    }

    console.log('[SendNotification] Sending', messages.length, 'notifications');

    // Send notifications
    await sendExpoPushNotifications(messages);

    return new Response(
      JSON.stringify({
        success: true,
        sent: messages.length,
        serviceId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SendNotification] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
