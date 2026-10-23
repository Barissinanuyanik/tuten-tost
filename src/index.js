const DEFAULT_PRODUCTS = [
  { id: 1, name: "Karışık Tost (Büyük Boy)", description: "%100 Dana Sucuk ve Taze Kaşar", price: 120, img: "img/karisiktam.webp", stock: 100, bread_type: "14x14 cm" },
  { id: 2, name: "Karışık Tost (Orta Boy)", description: "%100 Dana Sucuk ve Taze Kaşar", price: 90, img: "img/karisikyarim.webp", stock: 100, bread_type: "11x11 cm" },
  { id: 3, name: "Kaşarlı Tost (Büyük Boy)", description: "Bol Aknaz Kaşar Peynirli Sıcak Tost", price: 100, img: "img/kasarlitam.webp", stock: 100, bread_type: "14x14 cm" }
];

async function initDB(db) {
  if (!db) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT '', price REAL NOT NULL, img TEXT DEFAULT 'img/kasarlitam.webp', stock INTEGER NOT NULL DEFAULT 100, bread_type TEXT DEFAULT 'Standart')`),
    db.prepare(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT DEFAULT 'musteri@tutentost.com', address TEXT NOT NULL, order_note TEXT DEFAULT '', total_price REAL NOT NULL, payment_method TEXT DEFAULT 'Nakit', status TEXT DEFAULT 'Hazırlanıyor', cancel_reason TEXT DEFAULT NULL, is_paid INTEGER DEFAULT 0, chat_log TEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, product_name TEXT NOT NULL, options TEXT DEFAULT 'Standart', drink TEXT DEFAULT 'Yok', price REAL NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, vendor_name TEXT NOT NULL, description TEXT NOT NULL, quantity REAL DEFAULT 1, amount REAL NOT NULL, is_paid INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL UNIQUE, name TEXT DEFAULT 'İsimsiz Müşteri', pin TEXT DEFAULT '0000', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS global_chat_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL UNIQUE, chat_data TEXT, last_updated DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS whatsapp_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, customer_name TEXT DEFAULT 'Müşteri', message TEXT NOT NULL, direction TEXT DEFAULT 'inbound', is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)
  ]);
  const countObj = await db.prepare("SELECT COUNT(*) as cnt FROM products").first();
  if (!countObj || countObj.cnt === 0) {
    for (const p of DEFAULT_PRODUCTS) {
      await db.prepare("INSERT INTO products (name, description, price, img, stock, bread_type) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(p.name, p.description, p.price, p.img, p.stock, p.bread_type).run();
    }
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json;charset=UTF-8" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/api/")) {
      try {
        if (env.DB) await initDB(env.DB);

        // 1. ÜRÜNLERİ LİSTELE (/api/products)
        if (path === "/api/products" && request.method === "GET") {
          if (!env.DB) return jsonResponse(DEFAULT_PRODUCTS);
          const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY CASE WHEN stock > 0 THEN 0 ELSE 1 END ASC, id ASC").all();
          return jsonResponse(results);
        }

        // 2. SİPARİŞ OLUŞTURMA VE SORGULAMA (/api/orders)
        if (path === "/api/orders" && request.method === "POST") {
          if (!env.DB) return jsonResponse({ success: false, message: "Veritabanı (D1) bağlantısı henüz yapılandırılmadı." });
          const formData = await request.formData();
          const action = formData.get("action") || "create";

          if (action === "track") {
            const trackId = parseInt(formData.get("track_order_id") || "0", 10);
            const order = await env.DB.prepare("SELECT id, status, total_price FROM orders WHERE id = ?").bind(trackId).first();
            return jsonResponse({ success: !!order, order });
          }

          const name = formData.get("name") || "Müşteri";
          const phone = formData.get("phone") || "";
          const adrSerbest = formData.get("adr_serbest") || "";
          const refKodu = formData.get("ref_kodu") || "";
          const paymentMethod = formData.get("payment_method") || "Nakit";
          const cartDataRaw = formData.get("cart_data") || "[]";
          const cartData = JSON.parse(cartDataRaw);

          if (!Array.isArray(cartData) || cartData.length === 0) {
            return jsonResponse({ success: false, message: "Sepetiniz boş." });
          }

          let subtotal = 0;
          for (const item of cartData) {
            const qty = parseInt(item.qty || 1, 10);
            const unitPrice = parseFloat(item.unitPrice || item.totalPrice || 0);
            subtotal += unitPrice * qty;
          }

          const fullAddress = `Samanlı Mah. YILDIRIM/BURSA | Detay: ${adrSerbest}`;
          const note = refKodu ? `[Sipariş Kodu: ${refKodu}]` : "";

          await env.DB.prepare("INSERT OR IGNORE INTO customers (phone, name) VALUES (?, ?)").bind(phone, name).run();

          const insertOrder = await env.DB.prepare(
            "INSERT INTO orders (customer_name, phone, address, order_note, total_price, payment_method, status, is_paid) VALUES (?, ?, ?, ?, ?, ?, 'Hazırlanıyor', 0)"
          ).bind(name, phone, fullAddress, note, subtotal, paymentMethod).run();

          const orderId = insertOrder.meta.last_row_id;

          for (const item of cartData) {
            const qty = parseInt(item.qty || 1, 10);
            const unitPrice = parseFloat(item.unitPrice || item.totalPrice || 0);
            const optionsStr = Array.isArray(item.options) ? item.options.join(", ") : "Standart";
            for (let i = 0; i < qty; i++) {
              await env.DB.prepare("INSERT INTO order_items (order_id, product_name, options, drink, price) VALUES (?, ?, ?, 'Yok', ?)")
                .bind(orderId, item.name, optionsStr, unitPrice).run();
            }
            if (item.type === "toast" && item.id) {
              const prod = await env.DB.prepare("SELECT bread_type FROM products WHERE id = ?").bind(item.id).first();
              if (prod && prod.bread_type && prod.bread_type !== "Standart") {
                await env.DB.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE bread_type = ?").bind(qty, prod.bread_type).run();
              } else {
                await env.DB.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?").bind(qty, item.id).run();
              }
            }
          }

          return jsonResponse({ success: true, order_id: orderId, subtotal });
        }

        // 3. YÖNETİCİ PANELİ API (/api/admin)
        if (path === "/api/admin") {
          const filterDate = url.searchParams.get("filter_date") || new Date().toISOString().split("T")[0];
          
          if (!env.DB) {
            return jsonResponse({ stats: { income: 0, expense: 0, net: 0 }, activeOrders: [], completedOrders: [], expenses: [], customers: [], waMessages: [], chatLogs: [], products: DEFAULT_PRODUCTS });
          }

          if (request.method === "GET") {
            const action = url.searchParams.get("action");
            
            if (action === "check_new") {
              const lastId = parseInt(url.searchParams.get("last_id") || "0", 10);
              const newOrdersObj = await env.DB.prepare("SELECT COUNT(*) as cnt FROM orders WHERE id > ?").bind(lastId).first();
              return jsonResponse({ new_orders: newOrdersObj?.cnt || 0 });
            }

            const incomeObj = await env.DB.prepare("SELECT SUM(total_price) as total FROM orders WHERE is_paid = 1 AND status != 'İptal Edildi' AND DATE(created_at) = ?").bind(filterDate).first();
            const expenseObj = await env.DB.prepare("SELECT SUM(amount) as total FROM expenses WHERE is_paid = 1 AND DATE(created_at) = ?").bind(filterDate).first();
            const income = incomeObj?.total || 0;
            const expense = expenseObj?.total || 0;

            const { results: activeOrders } = await env.DB.prepare("SELECT * FROM orders WHERE status NOT IN ('Teslim Edildi', 'İptal Edildi') ORDER BY id DESC").all();
            const { results: completedOrders } = await env.DB.prepare("SELECT * FROM orders WHERE status IN ('Teslim Edildi', 'İptal Edildi') AND DATE(created_at) = ? ORDER BY id DESC").bind(filterDate).all();
            const { results: expenses } = await env.DB.prepare("SELECT * FROM expenses WHERE DATE(created_at) = ? ORDER BY id DESC").bind(filterDate).all();
            const { results: customers } = await env.DB.prepare("SELECT * FROM customers ORDER BY id DESC").all();
            const { results: waMessages } = await env.DB.prepare("SELECT * FROM whatsapp_messages ORDER BY id DESC LIMIT 100").all();
            const { results: chatLogs } = await env.DB.prepare("SELECT * FROM global_chat_logs ORDER BY last_updated DESC LIMIT 100").all();
            const { results: products } = await env.DB.prepare("SELECT * FROM products ORDER BY id DESC").all();
            const latestOrder = await env.DB.prepare("SELECT id FROM orders ORDER BY id DESC LIMIT 1").first();

            const unpaidOrdersGrouped = await env.DB.prepare("SELECT customer_name, SUM(total_price) as total_debt, COUNT(id) as item_count FROM orders WHERE is_paid = 0 AND status != 'İptal Edildi' GROUP BY customer_name ORDER BY customer_name ASC").all();
            const unpaidExpensesGrouped = await env.DB.prepare("SELECT vendor_name, SUM(amount) as total_debt, COUNT(id) as item_count FROM expenses WHERE is_paid = 0 GROUP BY vendor_name ORDER BY vendor_name ASC").all();

            return jsonResponse({
              stats: { income, expense, net: income - expense },
              latest_order_id: latestOrder?.id || 0,
              activeOrders,
              completedOrders,
              expenses,
              customers,
              waMessages,
              chatLogs,
              products,
              unpaidOrdersGrouped: unpaidOrdersGrouped.results,
              unpaidExpensesGrouped: unpaidExpensesGrouped.results
            });
          }

          if (request.method === "POST") {
            const body = await request.json();
            const act = body.action;

            if (act === "update_status") {
              await env.DB.prepare("UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?").bind(body.status, body.cancel_reason || null, body.order_id).run();
              return jsonResponse({ success: true });
            }
            if (act === "toggle_payment") {
              await env.DB.prepare("UPDATE orders SET is_paid = ? WHERE id = ?").bind(body.is_paid ? 1 : 0, body.order_id).run();
              return jsonResponse({ success: true });
            }
            if (act === "add_expense") {
              await env.DB.prepare("INSERT INTO expenses (vendor_name, description, quantity, amount, is_paid, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(body.vendor_name, body.description, body.quantity || 1, body.amount, body.is_paid ? 1 : 0, filterDate + ' ' + new Date().toTimeString().split(' ')[0]).run();
              return jsonResponse({ success: true });
            }
            if (act === "delete_expense") {
              await env.DB.prepare("DELETE FROM expenses WHERE id = ?").bind(body.expense_id).run();
              return jsonResponse({ success: true });
            }
            if (act === "delete_customer") {
              await env.DB.prepare("DELETE FROM customers WHERE id = ?").bind(body.customer_id).run();
              return jsonResponse({ success: true });
            }
            if (act === "save_product") {
              if (body.id) {
                await env.DB.prepare("UPDATE products SET name = ?, price = ?, stock = ?, bread_type = ? WHERE id = ?")
                  .bind(body.name, body.price, body.stock, body.bread_type || "Standart", body.id).run();
              }
              return jsonResponse({ success: true });
            }
            return jsonResponse({ success: false });
          }
        }
        // 4. YAPAY ZEKA ASİSTAN API (/api/bot)
        if (path === "/api/bot" && request.method === "POST") {
          const data = await request.json();
          const chatHistory = data.chatHistory || [];
          const sessionId = data.sessionId || "anon_" + Date.now();
          const apiKey = env.GEMINI_API_KEY || "";
          const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

          let products = DEFAULT_PRODUCTS;
          if (env.DB) {
            const res = await env.DB.prepare("SELECT * FROM products ORDER BY id ASC").all();
            if (res.results && res.results.length > 0) products = res.results;
          }

          let menuHTML = "<div class='w-full max-w-sm mx-auto border border-gray-200 rounded-2xl overflow-hidden shadow-sm my-2 box-border'><div class='bg-red-600 text-white font-black text-center py-2 text-[13px] uppercase tracking-wider'>Tüten Tost Menü</div><div class='p-2 sm:p-3 space-y-2 bg-stone-50'>";
          for (const p of products) {
            const displayName = p.name.replace(/\s*\(\d+x\d+\s*cm\)/i, "");
            if (p.stock > 0) {
              menuHTML += `<div onclick="sendChip('1 Adet ${displayName} İstiyorum')" class='flex justify-between items-center bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:bg-red-50 hover:border-red-200 transition active:scale-95'><div class='flex items-center gap-2 truncate pr-2'><span class='text-lg flex-shrink-0'>🥪</span><span class='font-bold text-gray-800 text-[13px] truncate'>${displayName}</span></div><span class='text-red-600 font-black text-xs bg-red-50 px-2 py-1 rounded-lg border border-red-100 flex-shrink-0'>${p.price} TL</span></div>`;
            } else {
              menuHTML += `<div class='flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100 opacity-60 cursor-not-allowed'><div class='flex items-center gap-2 truncate pr-2'><span class='text-lg grayscale flex-shrink-0'>🥪</span><span class='font-bold text-gray-500 text-[13px] line-through truncate'>${displayName}</span></div><span class='text-gray-500 font-black text-[10px] bg-gray-200 px-2 py-1 rounded-lg flex-shrink-0'>TÜKENDİ</span></div>`;
            }
          }
          menuHTML += "</div></div>";

          const systemInstruction = `Sen Tüten Tost'un resmi yapay zeka asistanısın. Kurumsal, kibar ve profesyonel bir müşteri temsilcisi gibi iletişim kur. Adresimiz Samanlı Mah. Yiğitler Cd. No:1 Yıldırım / Bursa. İletişim: 0224 224 24 04. Ödemeler sadece Kapıda Nakit veya Havale/EFT ile alınır. Çalışma saatlerimiz: 10:00 - 22:00. Hizmet bölgesi: Sadece Samanlı mahallesi. Müşteri menüyü görmek isterse doğrudan şu HTML bloğunu ver: ${menuHTML}`;

          const geminiRes = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemInstruction }] },
              contents: chatHistory
            })
          });

          const geminiData = await geminiRes.json();
          const replyText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Merhabalar, siparişinizi ana sayfamızdan veya 0224 224 24 04 numaralı hattımızdan iletebilirsiniz.";

          if (env.DB) {
            await env.DB.prepare("INSERT INTO global_chat_logs (session_id, chat_data, last_updated) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET chat_data = excluded.chat_data, last_updated = CURRENT_TIMESTAMP")
              .bind(sessionId, JSON.stringify(chatHistory)).run();
          }

          return jsonResponse({ text: replyText });
        }

        return jsonResponse({ error: "API uç noktası bulunamadı." }, 404);
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // Statik Dosyaları (public/) Sun
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Sayfa bulunamadı.", { status: 404 });
  }
};
