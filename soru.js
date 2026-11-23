const form = document.querySelector("#question-form");
const input = document.querySelector("#question");
const counter = document.querySelector("#counter");
const status = document.querySelector("#status");
const button = document.querySelector("#submit");
const config = window.MATERNALAI_CONFIG || {};
let captchaId = null;

function renderCaptcha() {
  if (!config.turnstileSiteKey || config.turnstileSiteKey.includes("YOUR_") || !window.turnstile || captchaId !== null) return;
  captchaId = window.turnstile.render("#turnstile", { sitekey: config.turnstileSiteKey, theme: "light" });
}
window.addEventListener("load", renderCaptcha);
const captchaObserver = new MutationObserver(renderCaptcha);
captchaObserver.observe(document.documentElement, { childList: true, subtree: true });

input.addEventListener("input", () => { counter.textContent = `${input.value.length} / 1000`; });
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.className = "";
  if (form.elements.website.value) return;
  const question = input.value.trim();
  if (question.length < 5) { status.textContent = "Sorunu biraz daha ayrıntılı yazar mısın?"; status.className = "error"; return; }
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    status.textContent = "Soru alanı henüz sunucuya bağlanmadı. Lütfen sunum ekibine doğrudan ilet.";
    status.className = "error";
    return;
  }
  if (captchaId === null || !window.turnstile?.getResponse(captchaId)) {
    status.textContent = "Spam korumasının yüklenmesini bekle ve doğrulamayı tamamla.";
    status.className = "error";
    return;
  }
  button.disabled = true;
  button.firstChild.textContent = "Gönderiliyor… ";
  try {
    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/maternalai-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey },
      body: JSON.stringify({ action: "ask", question, website: "", turnstileToken: window.turnstile.getResponse(captchaId) })
    });
    if (!response.ok) throw new Error(response.status === 429 ? "Kısa sürede çok fazla soru gönderildi. Biraz sonra tekrar dene." : "Soru gönderilemedi. Lütfen tekrar dene.");
    input.value = ""; counter.textContent = "0 / 1000";
    status.textContent = "Sorun alındı, teşekkürler!"; status.className = "success";
    window.turnstile.reset(captchaId);
  } catch (error) { status.textContent = error.message || "Bağlantı kurulamadı. Tekrar deneyebilirsin."; status.className = "error"; }
  finally { button.disabled = false; button.firstChild.textContent = "Soruyu gönder "; }
});
