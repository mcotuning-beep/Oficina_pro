// Edge Function: send-os-notification
//
// Disparada por um Database Webhook no INSERT da tabela "ordens". Busca
// todas as inscrições (subscriptions) salvas em push_subscriptions e envia
// uma notificação push pra cada uma — é assim que o admin recebe o aviso no
// celular quando uma O.S. nova é criada em qualquer aparelho.
//
// Este arquivo é só a cópia de referência guardada no repositório; o
// deploy de fato é feito colando este código no editor de Edge Functions
// do painel do Supabase (não é buildado pelo Vite nem faz parte do app).
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails("mailto:mcotuning@gmail.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    if (payload.type !== "INSERT") return new Response("ignorado (não é insert)");

    const os = payload.record || {};
    const numero = os.numero ? "#" + String(os.numero).padStart(4, "0") : "";
    const cliente = os.cliente || "Cliente não informado";
    const detalhe = [os.veiculo, os.placa].filter(Boolean).join(" · ") || "Nova ordem de serviço";

    const notifPayload = JSON.stringify({
      title: "🔧 Nova O.S. " + numero + " — " + cliente,
      body: detalhe,
      url: "/",
    });

    const res = await fetch(
      SUPABASE_URL + "/rest/v1/push_subscriptions?select=endpoint,p256dh,auth",
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: "Bearer " + SERVICE_ROLE_KEY } }
    );
    const subs = await res.json();

    await Promise.allSettled((subs || []).map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        notifPayload
      ).catch(async (err) => {
        // Inscrição expirada ou revogada (usuário desinstalou/limpou dados) —
        // remove do banco pra não ficar tentando enviar pra sempre.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await fetch(
            SUPABASE_URL + "/rest/v1/push_subscriptions?endpoint=eq." + encodeURIComponent(s.endpoint),
            { method: "DELETE", headers: { apikey: SERVICE_ROLE_KEY, Authorization: "Bearer " + SERVICE_ROLE_KEY } }
          );
        }
      })
    ));

    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("erro: " + e.message, { status: 500 });
  }
});
