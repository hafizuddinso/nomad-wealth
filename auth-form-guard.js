(function(){
  const authForms=["login-form","signup-form","otp-form","forgot-form","reset-form"];
  function protect(form){
    if(!form||form.dataset.urlGuard==="1")return;
    form.dataset.urlGuard="1";
    form.addEventListener("submit",function(event){
      event.preventDefault();
      // Do not stop propagation: the real app handler can still process the form.
      setTimeout(function(){
        if(!window.NomadApp){
          const box=document.getElementById("auth-inline-message");
          if(box){
            box.textContent="The login system did not finish loading. Refresh the page and try again.";
            box.className="auth-inline-message error";
          }
        }
      },1200);
    },true);
  }
  function init(){authForms.forEach(id=>protect(document.getElementById(id)))}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();