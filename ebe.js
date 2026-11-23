const dialog=document.getElementById("ebe"), form=dialog.querySelector("form"), output=dialog.querySelector("output");
let widget;
window.ebeReady=()=>{widget=turnstile.render("#ebe-check",{sitekey:MATERNALAI_CONFIG.turnstileSiteKey});};
document.getElementById("ask-ebe").onclick=()=>{
  dialog.showModal();
  if(!document.getElementById("ebe-loader")){
    const script=document.createElement("script");
    script.id="ebe-loader";
    script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=ebeReady";
    script.onerror=()=>{output.textContent="Doğrulama yüklenemedi. Kapatıp tekrar deneyin.";script.remove();};
    document.head.append(script);
  }
};
dialog.querySelector(".dismiss").onclick=()=>dialog.close();
form.onsubmit=async event=>{
  event.preventDefault();
  const token=widget!==undefined && turnstile.getResponse(widget);
  if(!token){output.textContent="Önce doğrulamayı tamamlayın.";return;}
  form.elements.send.disabled=true;
  output.textContent="EBE yanıt hazırlıyor…";
  try{
    const res=await fetch(MATERNALAI_CONFIG.supabaseUrl+"/functions/v1/maternalai-api",{
      method:"POST",headers:{"Content-Type":"application/json",apikey:MATERNALAI_CONFIG.supabaseAnonKey},
      body:JSON.stringify({action:"ebe",question:form.elements.question.value.trim(),turnstileToken:token}),signal:AbortSignal.timeout(60000)
    });
    const data=await res.json();
    if(!res.ok || !data.answer)throw Error();
    output.textContent=data.answer;
  }catch{output.textContent="EBE şu anda yanıt veremiyor. Biraz sonra tekrar deneyin.";}
  finally{form.elements.send.disabled=false;turnstile.reset(widget);}
};
