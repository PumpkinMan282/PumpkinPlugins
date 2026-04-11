function escHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll("\"","&quot;")
    .replaceAll("'","&#39;");
}

function toId(name){
  return String(name || "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}

function renderCompat(plugins){
  const el = document.querySelector("#compat");
  if (!el) return;
  const apiVersions = Array.from(new Set(plugins.map(p=>p.apiVersion).filter(Boolean))).sort();
  const pluginCount = plugins.length;
  const dependsCount = plugins.filter(p=>(p.depends||[]).length).length;

  el.innerHTML = `
    <div class="feature">
      <h3>Target API</h3>
      <p>${apiVersions.length ? escHtml(apiVersions.join(", ")) : "Unknown"}</p>
    </div>
    <div class="feature">
      <h3>Plugins</h3>
      <p>${pluginCount} jar${pluginCount === 1 ? "" : "s"} indexed</p>
    </div>
    <div class="feature">
      <h3>Dependencies</h3>
      <p>${dependsCount} plugin${dependsCount === 1 ? "" : "s"} declare dependencies</p>
    </div>
  `;
}

function renderDeps(plugins){
  const el = document.querySelector("#deps");
  if (!el) return;

  const byName = new Map();
  for (const p of plugins) byName.set(p.name, p);

  const rows = plugins
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name))
    .map(p=>{
      const deps = (p.depends || []);
      const dl = p.downloadPath ? `<a href="${escHtml(p.downloadPath)}" download>download</a>` : "";
      const guide = p.id ? `<a href="plugins.html?p=${escHtml(p.id)}">guide</a>` : "";
      const links = [guide, dl].filter(Boolean).join(" · ");
      const depsText = deps.length ? deps.map(d=>escHtml(d)).join(", ") : "none";
      return `<p><b>${escHtml(p.name)}</b> — depends: ${depsText}${links ? ` <span style="color:rgba(245,242,248,.65)">(${links})</span>` : ""}</p>`;
    });

  el.innerHTML = rows.join("") || "<p>No plugins found.</p>";
}

async function init(){
  const res = await fetch("data/plugins.json", {cache:"no-store"});
  const plugins = await res.json();
  renderCompat(plugins);
  renderDeps(plugins);
}

document.addEventListener("DOMContentLoaded", ()=>{
  init().catch((e)=>{
    const el = document.querySelector("#deps");
    if (el) el.innerHTML = `<p>Failed to load plugin data: ${escHtml(e?.message || "error")}</p>`;
  });
});

