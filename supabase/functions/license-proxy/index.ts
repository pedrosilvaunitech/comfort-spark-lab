import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EXTERNAL_API = 'https://biqzwxxiifmzrccdvnxf.supabase.co/functions/v1/client-api';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const { action, api_key, activation_key, payment_id, ticket_id, subject, message, priority } = body;

    if (!api_key || !activation_key) {
      return new Response(JSON.stringify({ error: 'Credenciais não fornecidas' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers: Record<string, string> = {
      'x-api-key': api_key,
      'Content-Type': 'application/json',
    };

    let targetUrl = '';
    let method = 'GET';
    let fetchBody: string | undefined;

    switch (action) {
      case 'get_license':
        targetUrl = `${EXTERNAL_API}/license?activation_key=${encodeURIComponent(activation_key)}`;
        break;

      case 'get_payments':
        targetUrl = `${EXTERNAL_API}/payments?activation_key=${encodeURIComponent(activation_key)}`;
        break;

      case 'get_pix':
        if (!payment_id) {
          return new Response(JSON.stringify({ error: 'payment_id obrigatório' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        targetUrl = `${EXTERNAL_API}/payments/${encodeURIComponent(payment_id)}/pix?activation_key=${encodeURIComponent(activation_key)}`;
        break;

      case 'get_boleto':
        if (!payment_id) {
          return new Response(JSON.stringify({ error: 'payment_id obrigatório' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        targetUrl = `${EXTERNAL_API}/payments/${encodeURIComponent(payment_id)}/boleto?activation_key=${encodeURIComponent(activation_key)}`;
        break;

      case 'create_ticket':
        targetUrl = `${EXTERNAL_API}/support`;
        method = 'POST';
        fetchBody = JSON.stringify({ activation_key, subject, message, priority });
        break;

      case 'get_tickets':
        targetUrl = `${EXTERNAL_API}/support?activation_key=${encodeURIComponent(activation_key)}`;
        break;

      case 'get_ticket_messages':
        if (!ticket_id) {
          return new Response(JSON.stringify({ error: 'ticket_id obrigatório' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        targetUrl = `${EXTERNAL_API}/support/${encodeURIComponent(ticket_id)}/messages`;
        break;

      case 'send_message':
        if (!ticket_id) {
          return new Response(JSON.stringify({ error: 'ticket_id obrigatório' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        targetUrl = `${EXTERNAL_API}/support/${encodeURIComponent(ticket_id)}/messages`;
        method = 'POST';
        fetchBody = JSON.stringify({ activation_key, message });
        break;

      default:
        return new Response(JSON.stringify({ error: 'Ação inválida' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const fetchOptions: RequestInit = { method, headers };
    if (fetchBody) fetchOptions.body = fetchBody;

    const externalRes = await fetch(targetUrl, fetchOptions);
    const contentType = externalRes.headers.get('content-type') || '';

    // For binary responses (PIX image, Boleto PDF), convert to base64
    if (action === 'get_pix' || action === 'get_boleto') {
      if (!externalRes.ok) {
        const errText = await externalRes.text().catch(() => '');
        return new Response(JSON.stringify({ error: `Falha (${externalRes.status}): ${errText}` }), {
          status: externalRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If the external API returns JSON, pass it through
      if (contentType.includes('application/json')) {
        const json = await externalRes.json();
        const pixHeader = externalRes.headers.get('X-Pix-Copia-E-Cola') || null;
        return new Response(JSON.stringify({ ...json, pix_copia_e_cola: pixHeader }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Binary: convert to base64
      const buffer = await externalRes.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const pixHeader = externalRes.headers.get('X-Pix-Copia-E-Cola') || null;

      return new Response(JSON.stringify({
        data_base64: base64,
        content_type: contentType,
        pix_copia_e_cola: pixHeader,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // JSON responses - pass through
    if (!externalRes.ok) {
      const errText = await externalRes.text().catch(() => '');
      return new Response(JSON.stringify({ error: `Falha (${externalRes.status}): ${errText}` }), {
        status: externalRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jsonData = await externalRes.json();
    return new Response(JSON.stringify(jsonData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[license-proxy] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
