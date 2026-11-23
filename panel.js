const login = document.querySelector("#login");
const statusEl = document.querySelector("#panel-status");
const list = document.querySelector("#questions");
const toolbar = document.querySelector(".toolbar");
const config = window.MATERNALAI_CONFIG || {};
let presenterKey = sessionStorage.getItem("maternalai-presenter-key") || "";

function say(message, error = false) { statusEl.textContent = message; statusEl.className = error ? "error" : ""; }
function endpoint() { return `${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/maternalai-api`; }
async function api(name, options = {}) {
  const response = await fetch(endpoint(), { ...options, method: "POST", headers: { apikey: config.supabaseAnonKey, "Content-Type": "application/json", "x-presenter-key": presenterKey, ...(options.headers || {}) }, body: options.body || JSON.stringify({ action: name }) });
  if (response.status === 401) throw new Error("Parola doğru değil veya oturum sona erdi.");
  if (!response.ok) throw new Error("Sunucuya bağlanılamadı. Yapılandırmayı kontrol et.");
  return response.json();
}
function make(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el; }

async function loadQuestions() {
  say("Sorular yükleniyor…"); list.replaceChildren();
  try {
    const data = await api("presenter");
    login.hidden = true; toolbar.hidden = false;
    const questions = data.questions || [];
    document.querySelector("#summary").textContent = `${questions.length} konu · ${questions.reduce((n, q) => n + Number(q.question_count), 0)} soru`;
    if (!questions.length) list.append(make("p", "empty", "Henüz soru gelmedi. QR bağlantısını sınıfla paylaşabilirsin."));
    questions.forEach((q) => {
      const article = make("article", "question-card");
      const top = make("div", "question-top");
      top.append(make("h2", "", q.representative));
      top.append(make("span", "count", `${q.question_count} soru`));
      article.append(top, make("p", "question-meta", `Son soru: ${new Date(q.latest_at).toLocaleString("tr-TR")}`));
      if (q.examples?.length > 1) { const examples = make("ul", "examples"); q.examples.slice(1).forEach((x) => examples.append(make("li", "", x))); article.append(examples); }
      const answerButton = make("button", "", "Kaynaklı taslak oluştur");
      const result = make("div", "answer"); result.hidden = true;
      answerButton.addEventListener("click", async () => {
        answerButton.disabled = true; answerButton.textContent = "Kaynaklar aranıyor…";
        try {
          const answer = await api("answer", { body: JSON.stringify({ action: "answer", question: q.representative }) });
          result.replaceChildren(make("div", "", answer.answer));
          if (answer.sources?.length) {
            const sources = make("ul", "source-list");
            answer.sources.forEach((s, i) => sources.append(make("li", "", `[${i + 1}] ${s.source}${s.page ? `, s. ${s.page}` : ""} · ${s.kind}`)));
            result.append(sources);
          }
          result.hidden = false;
        } catch (error) { say(error.message, true); }
        finally { answerButton.disabled = false; answerButton.textContent = "Yeniden taslak oluştur"; }
      });
      article.append(answerButton, result); list.append(article);
    });
    say(questions.length ? "" : "Soru kuyruğu hazır.");
  } catch (error) { login.hidden = false; toolbar.hidden = true; say(error.message, true); }
}
login.addEventListener("submit", async (event) => { event.preventDefault(); presenterKey = document.querySelector("#password").value; sessionStorage.setItem("maternalai-presenter-key", presenterKey); await loadQuestions(); });
document.querySelector("#refresh").addEventListener("click", loadQuestions);
if (presenterKey && config.supabaseUrl && !config.supabaseUrl.includes("YOUR_PROJECT")) loadQuestions();
