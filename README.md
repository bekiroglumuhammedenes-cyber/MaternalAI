# MaternalAI

Gebelik döneminde ortam konforu ve ergonomi için tasarlanan öğrenci projesi.

[Proje sitesi](https://bekiroglumuhammedenes-cyber.github.io/MaternalAI/) · [Web sunumu](https://bekiroglumuhammedenes-cyber.github.io/MaternalAI/sunum.html) · [PowerPoint](MaternalAI.pptx)

Muhammed Enes Bekiroğlu · Berat Pulat · Emirhan Efe Turhan

Kamera yazılımının üç deneme karesi sunumda yer alır. QR soru akışı `soru.html`, sunumcu paneli `panel.html`, Supabase Edge Functions ve veritabanı şeması `supabase/` altındadır.

## QR soru ve RAG MVP kurulumu

1. Supabase projesi oluşturup `supabase/migrations/202611230001_questions_and_rag.sql` dosyasını SQL Editor'da çalıştırın. `vector` uzantısının etkin olduğuna emin olun.
2. Bu dağıtım için `soru-config.js` Supabase proje URL'si, publishable key ve Cloudflare Turnstile site key ile yapılandırılmıştır. Başka bir projeye taşırsanız bu üç public istemci değerini değiştirin. Secret key'leri bu dosyaya koymayın.
3. `supabase/functions/maternalai-api/index.ts` işlevini Supabase CLI ile `supabase functions deploy maternalai-api --no-verify-jwt` komutuyla yayınlayın. `supabase/config.toml`, JWT doğrulamasını bu işlev için kapatır; sunumcu paneli ayrıca kendi parolasıyla korunur.
4. Supabase Edge Functions'ın varsayılan `SUPABASE_URL` ve `SUPABASE_SECRET_KEYS` değerleri otomatik gelir. Custom function secret olarak OpenAI API anahtarı (`OPENAI_API_KEY`), Turnstile panelindeki gizli anahtar (`TURNSTILE_SECRET_KEY`) ve güçlü, uzun bir sunumcu parolası (`PRESENTER_PASSWORD`) ekleyin. Anahtarlar yalnızca sunucuda kalır.
5. Rapor/kaynak parçalarını yerel terminalden yüklemek için `pip install pypdf requests` kurun; `OPENAI_API_KEY`, `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` ortam değişkenlerini tanımlayın. `python tools/ingest.py rapor.pdf posture_mediapipe.py` komutunu çalıştırın. Kaynak dosya adları ve PDF sayfaları parçalarla birlikte saklanır.
6. GitHub Pages bu depoda `gh-pages` dalından yayımlanır. Site arayüzü dosyalarını bu dala gönderip GitHub Pages dağıtımının tamamlanmasını bekleyin. Soru formu `https://bekiroglumuhammedenes-cyber.github.io/MaternalAI/soru.html`, ekip paneli `/panel.html` adresinde açılır. QR görseli `assets/soru.png` doğrudan soru formunu açar.

Sunum panelinde aynı parola yalnızca `sessionStorage` içinde oturum boyunca tutulur ve HTTPS üzerinden işlevlere gönderilir. Parolayı ekiple güvenli kanaldan paylaşın; öğrenci sayfasına eklemeyin. Uygulama soru tablolarında isim, hesap, IP veya cihaz kimliği tutmaz. Turnstile spam kontrolü sırasında Cloudflare istek güvenliği sinyallerini işleyebilir; formda kişisel/sağlık bilgisi paylaşılmaması gerektiği belirtilir. Turnstile her gönderimde doğrulanır; ayrıca Supabase/OpenAI kullanım limitlerini belirleyin. Birbirine benzer her soru ilk temsilci soruyla karşılaştırılır; 0,85 cosine benzerliği eşiği başlangıç ayarıdır. Yanıt taslağını sınıfa sunmadan önce kaynaklarla doğrulayın.
