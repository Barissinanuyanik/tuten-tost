export async function sendWhatsAppTemplate(env, toPhone, templateName, param1, param2) {
    let phone = toPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) {
        phone = '90' + phone.substring(1);
    } else if (phone.length === 10 && phone.startsWith('5')) {
        phone = '90' + phone;
    }

    const url = `https://graph.facebook.com/v17.0/${env.WHATSAPP_PHONE_ID}/messages`;
    const payload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
            name: templateName,
            language: { code: "tr" },
            components: [{
                type: "body",
                parameters: [
                    { type: "text", text: String(param1) },
                    { type: "text", text: String(param2) }
                ]
            }]
        }
    };

    try {
        await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
            },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("WhatsApp gönderim hatası:", err);
    }
}

export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
        }
    });
}