(function(){
  function setTab(id){
    document.querySelectorAll("[data-auth-tab]").forEach(button=>button.classList.toggle("active",button.dataset.authTab===id));
    const target=id==="signup-view"?document.querySelector("#show-signup"):document.querySelector("#show-login");
    target?.click();
    document.querySelector(".auth-panel")?.scrollTo({top:0,behavior:"smooth"});
  }
  document.addEventListener("click",event=>{
    const tab=event.target.closest("[data-auth-tab]");
    if(tab)setTab(tab.dataset.authTab);
  });
  window.addEventListener("online",()=>document.querySelector("#auth-inline-message")?.classList.add("hidden"));
  window.addEventListener("offline",()=>{
    const box=document.querySelector("#auth-inline-message");
    if(box){box.textContent="You are offline. Connect to the internet to log in.";box.className="auth-inline-message error";}
  });
})();