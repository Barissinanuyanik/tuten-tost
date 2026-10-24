import { jsonResponse, sendWhatsAppTemplate } from './_utils.js';

export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const formData = await request.formData();
        
        const action = formData.get('action');

        // Sipariş Durumu Sorgulama
        if (action === 'track') {
            const trackId = formData.get('track_order_id');
            const order = await env.DB.prepare("SELECT id, status, total_price FROM orders WHERE id = ?").bind(trackId).first();
            return jsonResponse({ success: true, order });
        }

        // Yeni Sipariş Oluşturma
        const name = formData.get('name') || 'Müşteri';
        const phone = formData.get('phone') || '';
        const addressDetail = formData.get('adr_serbest') || '';
        const fullAddress = `Samanlı Mah. YILDIRIM/BURSA | Detay: ${addressDetail}`;
        const paymentMethod = formData.get('payment_method') || 'Nakit';
        const customerNote = formData.get('note') || formData.get('ref_kodu') ? `[Sipariş Kodu: ${formData.get('ref_kodu')}]` : '';
        const cartDataRaw = formData.get('cart_data') || '[]';
        
        let cartData = [];
        try {
            cartData = JSON.parse(cartDataRaw);
        } catch (e) {
            cartData = [];
        }

        if (cartData.length === 0) {
            return jsonResponse({ success: false, message: "Sepetiniz boş." }, 400);
        }

        // Stok Kontrolü
        let breadNeeds = {};
        for (let item of cartData) {
            if (item.type === 'toast') {
                const qty = item.qty || 1;
                const prod = await env.DB.prepare("SELECT bread_type, stock FROM products WHERE id = ?").bind(item.id).first();
                if (prod) {
                    if (!breadNeeds[prod.bread_type]) breadNeeds[prod.bread_type] = { need: 0, stock: prod.stock };
                    breadNeeds[prod.bread_type].need += qty;
                }
            }
        }

        for (let bType in breadNeeds) {
            if (breadNeeds[bType].stock < breadNeeds[bType].need) {
                return jsonResponse({ success: false, message: `${bType} ekmeği için yeterli stok kalmadı!` }, 400);
            }
        }

        let subtotal = 0;
        cartData.forEach(item => {
            const unitPrice = item.unitPrice || item.totalPrice || 0;
            subtotal += unitPrice * (item.qty || 1);
        });

        // Müşteri Kaydı
        if (phone) {
            await env.DB.prepare("INSERT OR IGNORE INTO customers (phone, pin) VALUES (?, '0000')").bind(phone).run();
        }

        // Siparişi Ekle
        const insertOrder = await env.DB.prepare(
            "INSERT INTO orders (customer_name, phone, email, address, order_note, total_price, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(name, phone, 'musteri@tutentost.com', fullAddress, customerNote, subtotal, paymentMethod).run();
        
        const orderId = insertOrder.meta.last_row_id;

        // Sipariş Kalemleri ve Stok Düşme
        const insertItem = await env.DB.prepare(
            "INSERT INTO order_items (order_id, product_name, options, drink, price) VALUES (?, ?, ?, ?, ?)"
        );

        for (let item of cartData) {
            const optionsStr = Array.isArray(item.options) ? item.options.join(', ') : 'Standart';
            const qty = item.qty || 1;
            const unitPrice = item.unitPrice || item.totalPrice || 0;
            
            for (let i = 0; i < qty; i++) {
                await insertItem.bind(orderId, item.name, optionsStr, 'Yok', unitPrice).run();
            }
        }

        for (let bType in breadNeeds) {
            await env.DB.prepare("UPDATE products SET stock = stock - ? WHERE bread_type = ? AND stock > 0")
                .bind(breadNeeds[bType].need, bType).run();
        }

        // WhatsApp Bildirimi (Değişken tanımsızsa kodun çökmesini engeller)
        if (env.ADMIN_PHONE) {
            await sendWhatsAppTemplate(env, phone, "siparis_alindi", name, orderId);
            await sendWhatsAppTemplate(env, env.ADMIN_PHONE, "admin_yeni_siparis", `WEB: ${name}`, orderId);
        }

        return jsonResponse({ success: true, order_id: orderId, total: subtotal });

    } catch (err) {
        // Hatayı telefonda ekrana basarak asıl sorunu (örneğin tablo uyuşmazlığı) gösterir
        return jsonResponse({ success: false, message: "HATA NEDENİ: " + (err.message || err.toString()) }, 200);
    }
}
