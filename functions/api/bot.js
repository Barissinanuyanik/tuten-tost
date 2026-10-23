import { jsonResponse, sendWhatsAppTemplate } from './_utils.js';

export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const data = await request.json();

        if (!data || !data.chatHistory) {
            return jsonResponse({ text: 'Geçersiz veri.' }, 400);
        }

        const apiKey = env.GEMINI_API_KEY;
        const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

        // Ürünleri Çek
        const { results: products } = await env.DB.prepare("SELECT * FROM products ORDER BY id ASC").all();

        let menuHTML = `<div class='w-full max-w-sm mx-auto border border-gray-200 rounded-2xl overflow-hidden shadow-sm my-2 box-border'><div class='bg-red-600 text-white font-black text-center py-2 text-[13px] uppercase tracking-wider'>Tüten Tost Menü</div><div class='p-2 sm:p-3 space-y-2 bg-stone-50'>`;
        
        for (let p of products) {
            let displayName = p.name.replace(/\s*\(\d+x\d+\s*cm\)/i, '');
            if (p.stock > 0) {
                menuHTML += `<div onclick="sendChip('1 Adet ${displayName} İstiyorum')" class='flex justify-between items-center bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:bg-red-50 hover:border-red-200 transition active:scale-95'><div class='flex items-center gap-2 truncate pr-2'><span class='text-lg flex-shrink-0'>🥪</span><span class='font-bold text-gray-800 text-[13px] truncate'>${displayName}</span></div><span class='text-red-600 font-black text-xs bg-red-50 px-2 py-1 rounded-lg border border-red-100 flex-shrink-0'>${p.price} ₺</span></div>`;
            } else {
                menuHTML += `<div class='flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100 opacity-60 cursor-not-allowed'><div class='flex items-center gap-2 truncate pr-2'><span class='text-lg grayscale flex-shrink-0'>🥪</span><span class='font-bold text-gray-500 text-[13px] line-through truncate'>${displayName}</span></div><span class='text-gray-500 font-black text-[10px] bg-gray-200 px-2 py-1 rounded-lg flex-shrink-0'>TÜKENDİ</span></div>`;
            }
        }
        menuHTML += `<div class='mt-2 pt-2 border-t border-gray-200'><div class='font-black text-blue-600 text-xs mb-1 uppercase px-1'>🥤 İçecekler</div><div class='flex justify-between items-center bg-white p-2.5 rounded-xl border border-blue-50 shadow-sm'><span class='font-bold text-gray-700 text-[12px] truncate pr-2'>Kola, Ayran, Gazoz, Limonata</span><span class='text-gray-400 font-bold text-[10px] flex-shrink-0'>Seçime Bağlı</span></div></div></div></div>`;

        const { results: breadStocks } = await env.DB.prepare("SELECT bread_type, MAX(stock) as stock FROM products WHERE bread_type != 'Standart' GROUP BY bread_type").all();
        let stokBilgisi = "";
        for (let bs of breadStocks) {
            stokBilgisi += `${bs.bread_type} Ekmeği: ${bs.stock} Adet, `;
        }

        const summaryTemplate = `<div class='w-full max-w-sm mx-auto my-2 bg-white border border-blue-200 rounded-2xl overflow-hidden shadow-sm box-border'><div class='bg-blue-600 text-white text-center py-2 font-black text-[13px] uppercase tracking-wide'>📋 SİPARİŞ ÖZETİ</div><div class='p-3 sm:p-4 space-y-2.5 bg-stone-50'><div class='flex justify-between items-start border-b border-gray-200 pb-2'><span class='text-gray-500 text-xs font-bold mt-0.5 flex-shrink-0'>Ürünler</span><span class='text-gray-800 font-bold text-[13px] text-right ml-3 break-words'>[URUNLER]</span></div><div class='flex justify-between items-start border-b border-gray-200 pb-2'><span class='text-gray-500 text-xs font-bold mt-0.5 flex-shrink-0'>Adres</span><span class='text-gray-800 font-bold text-[13px] text-right ml-3 break-words'>[ADRES]</span></div><div class='flex justify-between items-center border-b border-gray-200 pb-2'><span class='text-gray-500 text-xs font-bold flex-shrink-0'>Ödeme</span><span class='text-gray-800 font-bold text-[13px] text-right ml-3 break-words'>[ODEME]</span></div><div class='flex justify-between items-center pt-1'><span class='text-gray-800 font-black text-[13px]'>Toplam Tutar</span><span class='text-red-600 font-black text-lg'>[TUTAR] ₺</span></div></div><div class='p-2 bg-white border-t border-gray-200'><button onclick="sendChip('Onaylıyorum')" class='w-full bg-green-500 hover:bg-green-600 text-white font-black py-2.5 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm'><span class='text-base'>✅</span> SİPARİŞİ ONAYLA</button></div></div>`;
        const receiptTemplate = `<div class='w-full max-w-sm mx-auto my-2 bg-white border border-green-200 rounded-2xl overflow-hidden shadow-md box-border'><div class='bg-green-500 text-white text-center py-2.5'><div class='text-2xl mb-0.5'>✅</div><div class='font-black text-[13px] uppercase tracking-wide'>SİPARİŞ ONAYLANDI</div></div><div class='p-3 sm:p-4 space-y-2.5 bg-stone-50'><div class='flex justify-between items-center border-b border-gray-200 pb-2'><span class='text-gray-500 text-xs font-bold flex-shrink-0'>Sipariş No</span><span class='text-gray-800 font-black text-sm'>#[SIPARIS_NO]</span></div><div class='flex justify-between items-center border-b border-gray-200 pb-2'><span class='text-gray-500 text-xs font-bold flex-shrink-0'>Ödenecek Tutar</span><span class='text-red-600 font-black text-sm'>[TUTAR] ₺</span></div><div class='text-center text-gray-600 text-xs font-medium pt-2 leading-relaxed'>Tostunuz özenle hazırlanıp en kısa sürede adresinize ulaştırılacaktır.<br><br>📞 İletişim: <span class='font-bold text-gray-800'>0224 224 24 04</span><br><br>Afiyet olsun! 🔥</div></div></div>`;

        const systemInstruction = `Sen Tüten Tost'un resmi yapay zeka asistanısın. Kurumsal, kibar ve profesyonel bir müşteri temsilcisi gibi iletişim kur. 'Ustam', 'abim', 'hemşerim', 'kardeşim' gibi laubali kelimeler KESİNLİKLE kullanma, müşteriye daima Bey/Hanım şeklinde hitap et. [TEK SORU KURALI]: ASLA aynı mesajda birden fazla soru sorma. Bilgileri adım adım, her mesajda SADECE BİR SORU sorarak topla. [KURUMSAL BİLGİ]: Adresimiz Samanlı Mah. Yiğitler Cd. No:1 Yıldırım / Bursa. İletişim: 0224 224 24 04. Ödemeler sadece Kapıda Nakit veya Havale/EFT ile alınır, POS cihazımız yoktur. Çalışma saatlerimiz: 10:00 - 22:00. Hizmet bölgesi: Sadece Samanlı mahallesi. [STOK BİLGİSİ]: KALAN EKMEK: ${stokBilgisi}. [MENÜ İSTEĞİ]: Müşteri menü isterse veya ürün sorarsa doğrudan 'Tabii ki, işte menümüz:' diyerek şu HTML bloğunu ver: ${menuHTML} [ADIM ADIM SİPARİŞ AKIŞI]: 1. Siparişi anla. 2. SADECE sos/acı isteğini sor. 3. SADECE isim ve telefon al. 4. SADECE teslimat adresini al. 5. SADECE ödeme yöntemini al. 6. [ÖZET ADIMI]: Tüm bilgiler toplandığında müşteriye şu HTML'i bas: ${summaryTemplate} 7. [FİNAL ONAYI]: Müşteri 'Onaylıyorum' dediğinde 'siparis_olustur' fonksiyonunu çağır ve şu fiş HTML'ini bas: ${receiptTemplate}`;

        const tools = [{
            function_declarations: [
                {
                    name: "gecmis_siparis_sorgula",
                    description: "Müşterinin telefon numarasına göre önceki siparişi getirir.",
                    parameters: { type: "OBJECT", properties: { telefon: { type: "STRING" } }, required: ["telefon"] }
                },
                {
                    name: "siparis_olustur",
                    description: "Müşteri siparişi ONAYLADIĞINDA bilgileri veritabanına kaydeder.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            isim: { type: "STRING" },
                            telefon: { type: "STRING" },
                            adres: { type: "STRING" },
                            odeme_yontemi: { type: "STRING" },
                            urunler: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        urun_adi: { type: "STRING" },
                                        adet: { type: "INTEGER" },
                                        fiyat: { type: "NUMBER" },
                                        notlar: { type: "STRING" }
                                    }
                                }
                            },
                            musteri_onayi: { type: "BOOLEAN" }
                        },
                        required: ["isim", "telefon", "adres", "odeme_yontemi", "urunler", "musteri_onayi"]
                    }
                },
                {
                    name: "siparis_durumu_sorgula",
                    description: "Aktif siparişi sorgular.",
                    parameters: { type: "OBJECT", properties: { telefon: { type: "STRING" } }, required: ["telefon"] }
                }
            ]
        }];

        let chatHistory = data.chatHistory;
        let sessionId = data.sessionId ? data.sessionId.replace(/[^a-zA-Z0-9_]/g, '') : 'anon_' + Date.now();

        // Gemini API Çağrısı
        let geminiRes = await fetch(`${apiUrl}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: chatHistory,
                tools: tools
            })
        });

        let geminiData = await geminiRes.json();
        if (!geminiRes.ok || geminiData.error) {
            return jsonResponse({ text: `<span class='text-red-600 font-bold'>⚠️ API Hatası:</span> ${geminiData.error?.message || 'Bilinmeyen hata'}` });
        }

        let parts = geminiData.candidates?.[0]?.content?.parts || [];
        let responseText = "";
        let functionCalls = [];

        for (let part of parts) {
            if (part.text) responseText += part.text;
            if (part.functionCall) functionCalls.push(part.functionCall);
        }

        // Fonksiyon Çalıştırma (Function Calling)
        if (functionCalls.length > 0) {
            chatHistory.push(geminiData.candidates[0].content);
            let functionResponses = [];
            let createdOrderId = null;

            for (let call of functionCalls) {
                let name = call.name;
                let args = call.args || {};

                if (name === 'gecmis_siparis_sorgula') {
                    let tel = (args.telefon || '').replace(/\D/g, '');
                    const lastOrder = await env.DB.prepare("SELECT id, created_at, address FROM orders WHERE phone = ? AND status = 'Teslim Edildi' ORDER BY id DESC LIMIT 1").bind(tel).first();
                    if (lastOrder) {
                        const { results: items } = await env.DB.prepare("SELECT product_name, options FROM order_items WHERE order_id = ?").bind(lastOrder.id).all();
                        functionResponses.push({ name, response: { status: "bulundu", tarih: lastOrder.created_at, items } });
                    } else {
                        functionResponses.push({ name, response: { status: "bulunamadi" } });
                    }
                } 
                else if (name === 'siparis_olustur') {
                    if (!args.musteri_onayi) {
                        functionResponses.push({ name, response: { status: "hata", mesaj: "Onay alınmadı." } });
                        continue;
                    }
                    let isim = args.isim || 'Müşteri';
                    let tel = (args.telefon || '').replace(/\D/g, '');
                    let adres = args.adres || 'Samanlı Mah.';
                    let odeme = args.odeme_yontemi || 'Nakit';
                    let urunler = args.urunler || [];
                    
                    let toplamFiyat = 0;
                    urunler.forEach(u => toplamFiyat += (u.fiyat || 0) * (u.adet || 1));

                    const insOrder = await env.DB.prepare("INSERT INTO orders (customer_name, phone, email, address, order_note, total_price, payment_method, is_paid) VALUES (?, ?, ?, ?, ?, ?, ?, 0)")
                        .bind(isim, tel, 'asistan@tutentost.com', adres, '🤖 Asistan Siparişi', toplamFiyat, odeme).run();
                    
                    createdOrderId = insOrder.meta.last_row_id;

                    const insItem = await env.DB.prepare("INSERT INTO order_items (order_id, product_name, options, drink, price) VALUES (?, ?, ?, 'Yok', ?)");
                    for (let u of urunler) {
                        for (let i = 0; i < (u.adet || 1); i++) {
                            await insItem.bind(createdOrderId, u.urun_adi, u.notlar || 'Standart', u.fiyat || 0).run();
                        }
                    }

                    await sendWhatsAppTemplate(env, tel, "siparis_alindi", isim, createdOrderId);
                    await sendWhatsAppTemplate(env, env.ADMIN_PHONE, "admin_yeni_siparis", `ASİSTAN: ${isim}`, createdOrderId);

                    functionResponses.push({ name, response: { status: "basarili", siparis_no: createdOrderId, tutar: toplamFiyat } });
                }
                else if (name === 'siparis_durumu_sorgula') {
                    let tel = (args.telefon || '').replace(/\D/g, '');
                    const ord = await env.DB.prepare("SELECT status, total_price FROM orders WHERE phone = ? ORDER BY id DESC LIMIT 1").bind(tel).first();
                    if (ord) {
                        functionResponses.push({ name, response: { status: "bulundu", durum: ord.status, tutar: ord.total_price } });
                    } else {
                        functionResponses.push({ name, response: { status: "bulunamadi" } });
                    }
                }
            }

            let funcResParts = functionResponses.map(fr => ({ functionResponse: fr }));
            chatHistory.push({ role: "user", parts: funcResParts });

            let secondRes = await fetch(`${apiUrl}?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ system_instruction: { parts: [{ text: systemInstruction }] }, contents: chatHistory, tools: tools })
            });
            let secondData = await secondRes.json();
            let secondText = "";
            if (secondData.candidates?.[0]?.content?.parts) {
                for (let p of secondData.candidates[0].content.parts) {
                    if (p.text) secondText += p.text;
                }
            }

            if (secondText.trim()) {
                responseText += "\n\n" + secondText.trim();
            } else if (createdOrderId) {
                const ordPrice = await env.DB.prepare("SELECT total_price FROM orders WHERE id = ?").bind(createdOrderId).first();
                responseText += "\n\n" + receiptTemplate.replace('[SIPARIS_NO]', createdOrderId).replace('[TUTAR]', ordPrice.total_price);
            }
        }

        // Sohbet Log Kaydı
        let finalLog = `Seans: ${sessionId}\nAsistan Yanıtı: ${responseText}`;
        await env.DB.prepare("INSERT INTO global_chat_logs (session_id, chat_data) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET chat_data = ?, last_updated = datetime('now', '+3 hours')")
            .bind(sessionId, finalLog, finalLog).run();

        return jsonResponse({ text: responseText.trim() });

    } catch (err) {
        return jsonResponse({ text: `<span class='text-red-600 font-bold'>Bağlantı Hatası:</span> ${err.message}` }, 500);
    }
}