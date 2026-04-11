function setActiveNav(){
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll("[data-nav]").forEach((a)=>{
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (!href) return;
    const isMatch = href === path || (path === "" && href === "index.html");
    if (isMatch) a.setAttribute("aria-current","page");
    else a.removeAttribute("aria-current");
  });
}

function setYear(){
  const el = document.querySelector("[data-year]");
  if (el) el.textContent = String(new Date().getFullYear());
}

function enableNavFadeIn(){
  const html = document.documentElement;
  if (html?.dataset?.navIn === "1") {
    requestAnimationFrame(() => {
      delete html.dataset.navIn;
    });
  }
}

function isPlainLeftClick(e){
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function enableSlideNav(){
  document.addEventListener("click", (e)=>{
    const a = e.target?.closest?.("a");
    if (!a) return;
    if (!isPlainLeftClick(e)) return;
    if (a.hasAttribute("download")) return;
    if ((a.getAttribute("target") || "").toLowerCase() === "_blank") return;

    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;

    let url;
    try{
      url = new URL(href, location.href);
    }catch{
      return;
    }

    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;

    // Let view transitions handle it when supported.
    if ("startViewTransition" in document) return;

    e.preventDefault();
    try{ sessionStorage.setItem("pumpkin_nav_in", "1"); }catch{}
    document.body.dataset.leaving = "true";
    window.setTimeout(()=>{ location.href = url.toString(); }, 360);
  }, {capture:true});
}

document.addEventListener("DOMContentLoaded", ()=>{
  setActiveNav();
  setYear();
  enableNavFadeIn();
  enableSlideNav();
});
