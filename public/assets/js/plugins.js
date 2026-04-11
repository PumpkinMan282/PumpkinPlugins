const $ = (sel)=>document.querySelector(sel);

function escHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll("\"","&quot;")
    .replaceAll("'","&#39;");
}

function mdToHtml(markdown){
  const lines = String(markdown || "").replaceAll("\r\n","\n").split("\n");
  let html = "";
  let inCode = false;
  let codeBuf = [];
  let listBuf = [];

  function flushList(){
    if (!listBuf.length) return;
    html += "<ul>" + listBuf.map(li=>`<li>${li}</li>`).join("") + "</ul>";
    listBuf = [];
  }
  function flushCode(){
    if (!codeBuf.length) return;
    html += `<pre><code>${escHtml(codeBuf.join("\n"))}</code></pre>`;
    codeBuf = [];
  }

  for (const raw of lines){
    const line = raw ?? "";
    if (line.startsWith("```")){
      if (inCode){
        inCode = false;
        flushCode();
      }else{
        flushList();
        inCode = true;
      }
      continue;
    }
    if (inCode){
      codeBuf.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed){
      flushList();
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.*)$/);
    const h2 = trimmed.match(/^##\s+(.*)$/);
    const h1 = trimmed.match(/^#\s+(.*)$/);
    if (h1 || h2 || h3){
      flushList();
      const text = escHtml((h1||h2||h3)[1]);
      const tag = h1 ? "h1" : h2 ? "h2" : "h3";
      html += `<${tag}>${text}</${tag}>`;
      continue;
    }

    const li = trimmed.match(/^- (.*)$/);
    if (li){
      const item = escHtml(li[1]).replaceAll(/`([^`]+)`/g, (_m, code)=>`<code>${escHtml(code)}</code>`);
      listBuf.push(item);
      continue;
    }

    flushList();
    const para = escHtml(trimmed).replaceAll(/`([^`]+)`/g, (_m, code)=>`<code>${escHtml(code)}</code>`);
    html += `<p>${para}</p>`;
  }

  flushList();
  flushCode();
  return html || "<p>No guide available.</p>";
}

function normalizeId(id){
  return String(id || "").toLowerCase().replaceAll(/[^a-z0-9-]/g,"").trim();
}

function readSelectedId(){
  const url = new URL(location.href);
  const p = url.searchParams.get("p");
  const hash = (location.hash || "").slice(1);
  return normalizeId(p || hash);
}

function setSelectedId(id){
  const url = new URL(location.href);
  if (id) url.searchParams.set("p", id);
  else url.searchParams.delete("p");
  history.replaceState(null, "", url.toString());
}

function renderList({plugins, selectedId, query}){
  const list = $("#pluginList");
  list.innerHTML = "";
  const q = String(query || "").toLowerCase().trim();

  const filtered = plugins.filter(p=>{
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.filename || "").toLowerCase().includes(q) ||
      (p.summary || "").toLowerCase().includes(q) ||
      (p.depends || []).join(" ").toLowerCase().includes(q)
    );
  });

  if (!filtered.length){
    const div = document.createElement("div");
    div.className = "plugin-card";
    div.innerHTML = `<div class="plugin-title"><h3>No matches</h3><span class="ver"></span></div>
      <div class="plugin-meta"><span class="badge">Try a different search</span></div>`;
    list.appendChild(div);
    return;
  }

  for (const p of filtered){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "plugin-card";
    btn.setAttribute("aria-selected", String(p.id === selectedId));
    btn.setAttribute("aria-label", `Open ${p.name} guide`);
    btn.addEventListener("click", ()=>{
      setSelectedId(p.id);
      renderDetail({plugin:p});
      document.querySelectorAll(".plugin-card").forEach(el=>el.setAttribute("aria-selected","false"));
      btn.setAttribute("aria-selected","true");
      const detail = $("#detail");
      if (detail) detail.scrollIntoView({behavior:"smooth", block:"start"});
    });

    const deps = (p.depends || []).length ? `<span class="badge dep">Depends: ${escHtml(p.depends.join(", "))}</span>` : "";
    const api = p.apiVersion ? `<span class="badge api">API: ${escHtml(p.apiVersion)}</span>` : "";

    btn.innerHTML = `
      <div class="plugin-title">
        <h3>${escHtml(p.name)}</h3>
        <span class="ver">v${escHtml(p.version || "")}</span>
      </div>
      <div class="plugin-meta">
        ${api}
        ${deps}
        ${p.filename ? `<span class="badge">${escHtml(p.filename)}</span>` : ""}
      </div>
    `;
    list.appendChild(btn);
  }
}

async function renderDetail({plugin}){
  $("#detailName").textContent = plugin?.name || "Select a plugin";
  $("#detailVersion").textContent = plugin?.version ? `v${plugin.version}` : "";
  $("#detailApi").textContent = plugin?.apiVersion ? `Bukkit api-version: ${plugin.apiVersion}` : "";
  $("#detailDepends").textContent = (plugin?.depends?.length) ? `Depends: ${plugin.depends.join(", ")}` : "Depends: none";

  const summary = (plugin?.summary || "").trim();
  const summaryEl = $("#detailSummary");
  if (summary){
    summaryEl.style.display = "";
    summaryEl.textContent = summary;
  }else{
    summaryEl.style.display = "none";
    summaryEl.textContent = "";
  }

  const dl = $("#downloadBtn");
  if (plugin?.downloadPath){
    dl.removeAttribute("aria-disabled");
    dl.href = plugin.downloadPath;
    dl.setAttribute("download", "");
  }else{
    dl.setAttribute("aria-disabled","true");
    dl.removeAttribute("download");
    dl.href = "#";
  }

  const guide = $("#guide");
  if (!plugin?.guidePath){
    guide.innerHTML = "<p>No guide available.</p>";
    return;
  }
  try{
    const res = await fetch(plugin.guidePath, {cache:"no-store"});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    guide.innerHTML = mdToHtml(md);
  }catch (e){
    guide.innerHTML = `<p>Couldn’t load the guide. (${escHtml(e?.message || "error")})</p>`;
  }
}

async function init(){
  const search = $("#search");
  const res = await fetch("data/plugins.json", {cache:"no-store"});
  const plugins = await res.json();
  const selected = readSelectedId() || (plugins[0]?.id || "");

  renderList({plugins, selectedId:selected, query:""});
  await renderDetail({plugin: plugins.find(p=>p.id===selected) || plugins[0] || null});

  search.addEventListener("input", ()=>{
    const current = readSelectedId();
    renderList({plugins, selectedId:current, query:search.value});
  });

  window.addEventListener("hashchange", async ()=>{
    const id = readSelectedId();
    const p = plugins.find(x=>x.id===id) || null;
    if (p) await renderDetail({plugin:p});
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  init().catch((e)=>{
    const el = $("#pluginList");
    if (el) el.innerHTML = `<div class="plugin-card"><div class="plugin-title"><h3>Failed to load plugins</h3></div><div class="plugin-meta"><span class="badge">${escHtml(e?.message || "error")}</span></div></div>`;
  });
});
