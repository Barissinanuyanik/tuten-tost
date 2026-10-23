import { jsonResponse, sendWhatsAppTemplate } from './_utils.js';

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'dashboard';

    // 1. GİRİŞ KONTROLÜ
    if (action === 'login') {
        const formData = await request.formData();
        const user = formData.get('username');
        const pass = formData.get('password');
        
        if (user === env.ADMIN_USER && pass === env.ADMIN_PASS) {
            return new Response(null, {
                status: 302,
                headers: { "Location": "/admin.html?logged=true" }
            });
        }
        return jsonResponse({ success: false, message: "Hatalı kullanıcı adı veya şifre." }, 401);
    }

    // 2. DASHBOARD VE İSTATİSTİKLER (GET)
    if (action === 'data') {
        const filterDate = url.searchParams.get('filter_date') || new Date().toISOString().split('T')[0];
        
        const { results: orders } = await env.DB.prepare("SELECT * FROM orders WHERE DATE(created_at) = ? ORDER BY id DESC").bind(filterDate).all();
        const { results: activeOrders } = await env.DB.prepare("SELECT * FROM orders WHERE status NOT IN ('Teslim Edildi', 'İptal Edildi') ORDER BY id DESC").all();
        const { results: expenses } = await env.DB.prepare("SELECT * FROM expenses WHERE DATE(created_at) = ? ORDER BY id DESC").bind(filterDate).all();
        const { results: products } = await env.DB.prepare("SELECT * FROM products ORDER BY id ASC").all();
        const { results: customers } = await env.DB.prepare("SELECT * FROM customers ORDER BY id DESC").all();
        const { results: chatLogs } = await env.DB.prepare("SELECT * FROM global_chat_logs ORDER BY last_updated DESC LIMIT 50").all();
        const { results: waMessages } = await env.DB.prepare("SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT 100").all();

        // Gelir Gider Hesapla
        const income = orders.filter(o => o.is_paid === 1 && o.status !== 'İptal Edildi').reduce((acc, o) => acc + o.total_price, 0);
        const expense = expenses.filter(e => e.is_paid === 1).reduce((acc, e) => acc + e.amount, 0);

        return jsonResponse({
            success: true,
            stats: { income, expense, net: income - expense },
            orders,
            activeOrders,
            expenses,
            products,
            customers,
            chatLogs,
            waMessages
        });
    }

    // 3. İŞLEMLER (POST - Sipariş Durumu, Masraf Ekleme, Ürün Güncelleme vb.)
    if (request.method === 'POST') {
        const formData = await request.formData();
        const subAction = formData.get('sub_action');

        if (subAction === 'update_status') {
            const orderId = formData.get('order_id');
            const status = formData.get('status');
            const cancelReason = formData.get('cancel_reason') || null;

            await env.DB.prepare("UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?").bind(status, cancelReason, orderId).run();
            
            const ord = await env.DB.prepare("SELECT customer_name, phone FROM orders WHERE id = ?").bind(orderId).first();
            if (ord && ord.phone) {
                if (status === 'Yolda') await sendWhatsAppTemplate(env, ord.phone, "siparis_yola_cikti", ord.customer_name, orderId);
                else if (status === 'Teslim Edildi') await sendWhatsAppTemplate(env, ord.phone, "siparis_teslim_edildi_v2", ord.customer_name, orderId);
                else if (status === 'İptal Edildi') await sendWhatsAppTemplate(env, ord.phone, "siparis_iptal", ord.customer_name, orderId);
            }
            return jsonResponse({ success: true });
        }

        if (subAction === 'add_expense') {
            const vendor = formData.get('vendor_name') || 'Genel Masraf';
            const desc = formData.get('description');
            const qty = formData.get('quantity') || 1;
            const amount = formData.get('amount');
            const isPaid = formData.get('is_paid') ? 1 : 0;

            await env.DB.prepare("INSERT INTO expenses (vendor_name, description, quantity, amount, is_paid) VALUES (?, ?, ?, ?, ?)").bind(vendor, desc, qty, amount, isPaid).run();
            return jsonResponse({ success: true });
        }

        if (subAction === 'send_wa') {
            const phone = formData.get('wa_phone');
            const message = formData.get('wa_message');

            await env.DB.prepare("INSERT INTO whatsapp_messages (phone, customer_name, message, direction, is_read) VALUES (?, 'Biz', ?, 'outbound', 1)").bind(phone, message).run();
            await sendWhatsAppTemplate(env, phone, "ozel_mesaj", message, ""); // Özel metin gönderimi için
            return jsonResponse({ success: true });
        }
    }

    return jsonResponse({ error: "Geçersiz istek" }, 400);
}