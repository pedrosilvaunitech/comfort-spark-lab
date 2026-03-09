import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EXTERNAL_API = 'https://biqzwxxiifmzrccdvnxf.supabase.co/functions/v1/client-api';

async function getLicenseKeys(supabaseClient: any): Promise<{ api_key: string; activation_key: string }> {
  const { data, error } = await supabaseClient
    .from('system_config')
    .select('value')
    .eq('key', 'license_keys')
    .single();

  if (error || !data) {
    throw new Error('Chaves de licença não configuradas no sistema');
  }

  const keys = data.value as any;
  if (!keys?.api_key || !keys?.activation_key) {
    throw new Error('Chaves de licença incompletas');
  }

  return { api_key: keys.api_key, activation_key: keys.activation_key };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, payment_id, ticket_id, subject, message, priority } = body;

    // Create supabase client to read config
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // For save_keys, skip reading existing keys
    if (action === 'save_keys') {
      const { new_api_key, new_activation_key } = body;
      if (!new_api_key || !new_activation_key) {
        return new Response(JSON.stringify({ error: 'Chaves obrigatórias' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: upsertError } = await supabaseClient
        .from('system_config')
        .upsert({
          key: 'license_keys',
          value: { api_key: new_api_key, activation_key: new_activation_key },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (upsertError) {
        return new Response(JSON.stringify({ error: 'Falha ao salvar: ' + upsertError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const testRes = await fetch(`${EXTERNAL_API}/license?activation_key=${encodeURIComponent(new_activation_key)}`, {
          headers: { 'x-api-key': new_api_key },
        });
        if (testRes.ok) {
          const testData = await testRes.json();
          return new Response(JSON.stringify({ success: true, license: testData.license }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true, warning: 'Chaves salvas mas teste falhou' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ success: true, warning: 'Chaves salvas mas teste falhou' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get keys from database (server-side only)
    const { api_key, activation_key } = await getLicenseKeys(supabaseClient);

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

      // Special: save keys (called from admin settings)
      case 'save_keys': {
        const { new_api_key, new_activation_key } = body;
        if (!new_api_key || !new_activation_key) {
          return new Response(JSON.stringify({ error: 'Chaves obrigatórias' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Upsert into system_config
        const { error: upsertError } = await supabaseClient
          .from('system_config')
          .upsert({
            key: 'license_keys',
            value: { api_key: new_api_key, activation_key: new_activation_key },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key' });

        if (upsertError) {
          return new Response(JSON.stringify({ error: 'Falha ao salvar: ' + upsertError.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Test connection with new keys
        try {
          const testRes = await fetch(`${EXTERNAL_API}/license?activation_key=${encodeURIComponent(new_activation_key)}`, {
            headers: { 'x-api-key': new_api_key },
          });
          if (testRes.ok) {
            const testData = await testRes.json();
            return new Response(JSON.stringify({ success: true, license: testData.license }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify({ success: true, warning: 'Chaves salvas mas teste falhou' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch {
          return new Response(JSON.stringify({ success: true, warning: 'Chaves salvas mas teste falhou' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

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

      if (contentType.includes('application/json')) {
        const json = await externalRes.json();
        const pixHeader = externalRes.headers.get('X-Pix-Copia-E-Cola') || null;
        return new Response(JSON.stringify({ ...json, pix_copia_e_cola: pixHeader }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

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
