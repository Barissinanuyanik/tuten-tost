import { jsonResponse } from './_utils.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
    }
    return new Response('Yetkisiz erişim.', { status: 403 });
}

export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const data = await request.json();

        if (data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const msgData = data.entry[0].changes[0].value.messages[0];
            const contactData = data.entry[0].changes[0].value.contacts?.[0] || null;
            
            const phone = msgData.from || '';
            const messageText = msgData.text?.body || '';
            const customerName = contactData?.profile?.name || 'Bilinmeyen Müşteri';

            if (phone && messageText) {
                await env.DB.prepare(
                    "INSERT INTO whatsapp_messages (phone, customer_name, message, direction, is_read) VALUES (?, ?, ?, 'inbound', 0)"
                ).bind(phone, customerName, messageText).run();
            }
        }

        return jsonResponse({ success: true });
    } catch (err) {
        return jsonResponse({ error: err.message }, 500);
    }
}