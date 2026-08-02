(function(){
  function run(){
    var countries=window.NOMAD_WEALTH_COUNTRIES||[];
    var currencies=window.NOMAD_WEALTH_CURRENCIES||["EUR","USD","GBP","RUB","BDT","ALL"];
    var country=document.getElementById("signup-country");
    var currency=document.getElementById("signup-currency");
    if(country&&country.options.length===0){
      var names=null;
      try{names=new Intl.DisplayNames([document.documentElement.lang||"en"],{type:"region"})}catch(e){}
      country.innerHTML='<option value="">Choose a country</option>'+countries.map(function(c){
        var label=names?names.of(c.code):c.name;
        return '<option value="'+c.code+'">'+label+'</option>';
      }).join("");
      country.value="AL";
    }
    if(currency&&currency.options.length===0){
      currency.innerHTML=currencies.map(function(c){return '<option value="'+c+'">'+c+'</option>'}).join("");
      currency.value="EUR";
    }
    if(country&&!country.dataset.authFallbackBound){
      country.dataset.authFallbackBound="1";
      country.addEventListener("change",function(){
        var found=countries.find(function(c){return c.code===country.value});
        if(found&&currency&&currencies.indexOf(found.currency)>=0)currency.value=found.currency;
      });
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run();
  window.addEventListener("load",run);
})();