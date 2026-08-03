(function(){
  window.addEventListener("error",function(event){
    const message=String(event.message||"").trim();
    if(!message)return;
    const box=document.getElementById("auth-inline-message");
    if(box&&!window.__NOMAD_AUTH_MODULE_LOADED__){
      box.textContent="The login system failed to load: "+message;
      box.className="auth-inline-message error";
    }
  });
  setTimeout(function(){
    if(window.__NOMAD_AUTH_MODULE_LOADED__)return;
    const box=document.getElementById("auth-inline-message");
    if(box){
      box.textContent="The login system did not load. Clear the site cache, refresh, and check that JavaScript is allowed.";
      box.className="auth-inline-message error";
    }
  },5000);
})();