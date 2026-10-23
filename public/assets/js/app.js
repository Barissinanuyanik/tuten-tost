let deferredPrompt;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js');
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showPWABanner();
});

if (isIOS && !isStandalone) {
    setTimeout(showPWABanner, 2000);
}

// Sabit header.html ve footer.html dosyalarını tüm sayfalara yükler
async function loadHeaderAndFooter() {
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
        try {
            const res = await fetch('/header.html');
            if (res.ok) {
                headerContainer.innerHTML = await res.text();
            }
        } catch (err) {
            console.error('Header yüklenemedi:', err);
        }
    }

    const footerContainer = document.getElementById('footer-container');
    if (footerContainer) {
        try {
            const res = await fetch('/footer.html');
            if (res.ok) {
                footerContainer.innerHTML = await res.text();
                initAsistanBubble();
            }
        } catch (err) {
            console.error('Footer yüklenemedi:', err);
        }
    }

    updateCartUI();
    toggleBankInfo();
}

document.addEventListener("DOMContentLoaded", () => {
    loadHeaderAndFooter();
});

// Asistan penceresi açma/kapatma ve bildirim balonu fonksiyonları
window.openChatIframe = function() {
    const container = document.getElementById('asistan-iframe-container');
    const widget = document.getElementById('asistan-widget');
    if (!container || !widget) return;

    container.style.transform = 'translateY(0)';
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
    widget.style.display = 'none';
};

window.closeChatIframe = function() {
    const container = document.getElementById('asistan-iframe-container');
    const widget = document.getElementById('asistan-widget');
    if (!container || !widget) return;

    container.style.transform = 'translateY(150%)';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    setTimeout(() => { widget.style.display = 'flex'; }, 300);
};

function initAsistanBubble() {
    setTimeout(() => {
        const widget = document.getElementById('asistan-widget');
        const bubble = document.getElementById('asistan-bubble');
        if (widget && bubble && widget.style.display !== 'none') {
            bubble.classList.remove('hidden');
            setTimeout(() => {
                bubble.classList.add('hidden');
            }, 8000);
        }
    }, 5000);
}

function showPWABanner() {
    if (!isStandalone && !localStorage.getItem('tuten_pwa_closed')) {
        setTimeout(() => {
            const banner = document.getElementById('pwa-install-banner');
            if (banner) banner.style.transform = 'translateY(0)';
        }, 15000);
    }
}

function closePWABanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.transform = 'translateY(-150%)';
    localStorage.setItem('tuten_pwa_closed', 'true');
}

async function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            const banner = document.getElementById('pwa-install-banner');
            if (banner) banner.style.display = 'none';
        }
        deferredPrompt = null;
    } else if (isIOS) {
        window.location.href = '/app.html';
    } else {
        alert("Uygulama zaten yüklü veya tarayıcınız bu özelliği şu an desteklemiyor.");
    }
}

function formatPhone(input) {
    let val = input.value.replace(/\D/g, '');
    if (val.length > 0 && val[0] !== '0') {
        val = '0' + val;
    }
    input.value = val;
}

function toggleBankInfo() {
    const havaleRadio = document.querySelector('input[name="payment_method"][value="Havale / EFT"]');
    const bankBox = document.getElementById('bank-info-box');
    if (!bankBox) return;
    if (havaleRadio && havaleRadio.checked) bankBox.classList.remove('hidden');
    else bankBox.classList.add('hidden');
}

let cart = [];
const savedCart = sessionStorage.getItem('tuten_cart');
if (savedCart) {
    try { cart = JSON.parse(savedCart); } catch (e) { cart = []; }
}

function addToCart(id, name, basePrice) {
    const aciInput = document.querySelector(`input[name="aci_${id}"]:checked`);
    if (!aciInput) {
        alert("Lütfen acı durumunu seçiniz.");
        return;
    }
    const aci = aciInput.value;
    const ketcap = document.getElementById(`ketcap_${id}`).checked;
    const mayonez = document.getElementById(`mayonez_${id}`).checked;
    const salca = document.getElementById(`salca_${id}`).checked;
    const sade = document.getElementById(`sade_${id}`).checked;

    if (!ketcap && !mayonez && !salca && !sade) {
        alert("Lütfen en az bir sos seçiniz. Sos istemiyorsanız 'Sade' seçeneğini işaretleyiniz.");
        return;
    }

    let optionsArr = [aci];
    if (sade) {
        optionsArr.push("Sade");
    } else {
        if (ketcap) optionsArr.push("Ketçaplı");
        if (mayonez) optionsArr.push("Mayonezli");
        if (salca) optionsArr.push("Salçalı");
    }

    const toastQty = parseInt(document.getElementById(`toast_qty_${id}`).value) || 1;
    const drinkSelect = document.getElementById(`drink_${id}`);
    const drinkName = drinkSelect.value;
    const drinkPrice = parseInt(drinkSelect.options[drinkSelect.selectedIndex].getAttribute('data-price')) || 0;

    if (toastQty > 0) {
        cart.push({
            id: id,
            type: 'toast',
            name: name,
            options: optionsArr,
            unitPrice: basePrice,
            totalPrice: basePrice * toastQty,
            qty: toastQty
        });
    }

    if (drinkName !== 'Yok') {
        cart.push({
            id: 'drink_' + drinkName,
            type: 'drink',
            name: drinkName,
            options: ['Soğuk İçecek'],
            unitPrice: drinkPrice,
            totalPrice: drinkPrice,
            qty: 1
        });
    }

    saveCart();
    updateCartUI();
}

function updateCartUI() {
    const cartCountEl = document.getElementById('cart-count');
    let totalItems = 0;
    let totalAmt = 0;

    cart.forEach(item => {
        totalItems += item.qty;
        totalAmt += item.totalPrice;
    });

    if (cartCountEl) cartCountEl.innerText = totalItems;

    const cartItemsDiv = document.getElementById('cart-items');
    const emptyMsg = document.getElementById('empty-cart-msg');
    const form = document.getElementById('checkout-form');
    const priceArea = document.getElementById('total-price-area');

    if (!cartItemsDiv) return;
    cartItemsDiv.innerHTML = '';

    if (cart.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        if (form) form.classList.add('hidden');
        if (priceArea) priceArea.classList.add('hidden');
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    if (form) form.classList.remove('hidden');
    if (priceArea) {
        priceArea.classList.remove('hidden');
        priceArea.classList.add('flex');
    }

    cart.forEach((item, index) => {
        cartItemsDiv.innerHTML += `
            <div class="bg-stone-50 p-3 rounded-xl text-xs border border-gray-200">
                <div class="flex justify-between font-bold text-gray-900 mb-1">
                    <span><span class="text-red-600 bg-red-100 px-1.5 rounded mr-1">${item.qty}x</span> ${item.name}</span>
                    <span class="text-red-600">${item.totalPrice} TL</span>
                </div>
                <p class="text-gray-500 text-[11px]">${item.options.join(', ')}</p>
                <button type="button" onclick="removeFromCart(${index})" class="text-red-500 font-bold mt-1 text-right w-full">Sil</button>
            </div>
        `;
    });

    const cartTotalEl = document.getElementById('cart-total');
    const cartDataInput = document.getElementById('cart_data_input');
    if (cartTotalEl) cartTotalEl.innerText = totalAmt + ' TL';
    if (cartDataInput) cartDataInput.value = JSON.stringify(cart);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function clearCart() {
    cart = [];
    saveCart();
    updateCartUI();
}

function saveCart() {
    sessionStorage.setItem('tuten_cart', JSON.stringify(cart));
}