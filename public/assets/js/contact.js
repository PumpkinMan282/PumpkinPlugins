const $ = (sel)=>document.querySelector(sel);

function escHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll("\"","&quot;")
    .replaceAll("'","&#39;");
}

function showToast(kind, msg){
  const host = $("#toast");
  host.innerHTML = `<div class="toast ${kind === "ok" ? "ok" : "err"}">${escHtml(msg)}</div>`;
}

async function submitContact(e){
  e.preventDefault();
  const btn = $("#sendBtn");
  btn.disabled = true;
  btn.textContent = "Sending…";
  $("#toast").innerHTML = "";

  const payload = {
    name: $("#name").value.trim(),
    contact: $("#contact").value.trim(),
    subject: $("#subject").value.trim(),
    message: $("#message").value.trim(),
    website: $("#website").value.trim() // honeypot
  };

  if (!payload.name || !payload.contact || !payload.message){
    btn.disabled = false;
    btn.textContent = "Send message";
    showToast("err", "Please include your name, a contact method, and your message.");
    return;
  }

  try{
    const res = await fetch("/api/contact", {
      method:"POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=> ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

    $("#form").reset();
    showToast("ok", "Sent. I’ll get back to you soon.");
  }catch (err){
    showToast("err", `Couldn’t send: ${err?.message || "error"}. If you’re running the site statically, you’ll need the local server enabled for the form to work.`);
  }finally{
    btn.disabled = false;
    btn.textContent = "Send message";
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  $("#form").addEventListener("submit", submitContact);
});
