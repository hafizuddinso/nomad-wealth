// Market research is read-only. It never sends financial-account data to market providers.
(() => {
  const el = id => document.getElementById(id);
  const escape = input => String(input ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
  const input = el("stock-search"), results = el("stock-search-results");
  const ticker = el("market-selected-symbol"), list = el("market-symbol-list");
  let symbols = [], debounce;
  const country = el("market-country"), exchange = el("market-exchange"), providerHint=el("market-provider-hint");
  const exchangeChoices={"US":[["NASDAQ","Nasdaq (public directory)"],["US","US exchanges (Finnhub)"]],"BD":[["BD","Dhaka Stock Exchange (DSE) / Bangladesh provider listings"]],"RU":[["RU","Moscow Exchange (MOEX) / Russia provider listings"]],"GB":[["GB","London Stock Exchange"]],"IN":[["IN","NSE / BSE"]],"JP":[["JP","Tokyo Stock Exchange"]],"DE":[["DE","Frankfurt / Xetra"]],"FR":[["FR","Euronext Paris"]],"CA":[["CA","TSX"]],"AU":[["AU","ASX"]],"CN":[["CN","Shanghai / Shenzhen"]],"HK":[["HK","Hong Kong Exchange"]],"SG":[["SG","Singapore Exchange"]],"FI":[["FI","Nasdaq Helsinki"]],"SE":[["SE","Nasdaq Stockholm"]],"NO":[["NO","Oslo Exchange"]],"DK":[["DK","Nasdaq Copenhagen"]],"ES":[["ES","Madrid Exchange"]],"IT":[["IT","Borsa Italiana"]],"NL":[["NL","Euronext Amsterdam"]],"BE":[["BE","Euronext Brussels"]],"CH":[["CH","SIX Swiss"]],"BR":[["BR","B3 Brazil"]],"MX":[["MX","Bolsa Mexicana"]],"ZA":[["ZA","Johannesburg Exchange"]],"KR":[["KR","Korea Exchange"]],"AE":[["AE","UAE exchanges"]],"SA":[["SA","Saudi Exchange"]],"TR":[["TR","Borsa Istanbul"]],"PK":[["PK","Pakistan Stock Exchange"]],"TH":[["TH","SET"]],"ID":[["ID","Indonesia Exchange"]],"MY":[["MY","Bursa Malaysia"]],"VN":[["VN","Vietnam exchanges"]],"PH":[["PH","Philippine Exchange"]],"NZ":[["NZ","NZX"]],"PL":[["PL","Warsaw Exchange"]],"PT":[["PT","Euronext Lisbon"]],"IE":[["IE","Euronext Dublin"]],"AT":[["AT","Vienna Exchange"]],"CZ":[["CZ","Prague Exchange"]]};
  let activeExchange="NASDAQ",activeCurrency=null;
  function setupExchanges(){
    const choices=exchangeChoices[country.value]||[];
    exchange.innerHTML=choices.length?choices.map(e=>'<option value="'+escape(e[0])+'">'+escape(e[1])+'</option>').join(""):'<option value="">No verified feed configured</option>';
    exchange.disabled=!choices.length;
    activeExchange=exchange.value;
    symbols=[];
    ticker.value="";input.value="";list.innerHTML="";
    if(!choices.length){
      results.textContent="No verified stock directory is configured for this country.";
      providerHint.textContent="Country names are comprehensive; market data availability depends on provider coverage.";
      return;
    }
    providerHint.textContent=activeExchange==="NASDAQ"?"Nasdaq Trader public directory":"Finnhub access needed; availability varies by subscription.";
    loadSymbols();
  }


  async function request(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {signal:controller.signal, cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Market data is unavailable.");
      return data;
    } finally { clearTimeout(timeout); }
  }
  function render(q) {
    const term = String(q || "").trim().toLowerCase();
    if (!term) { results.textContent = "Search by company name or ticker."; return; }
    const matches = symbols.filter(entry => entry.symbol.toLowerCase().includes(term) || entry.name.toLowerCase().includes(term)).slice(0, 24);
    results.innerHTML = matches.length
      ? matches.map(entry => '<button class="market-result-button" type="button" data-market-symbol="'+escape(entry.symbol)+'"><strong>'+escape(entry.symbol)+'</strong><small>'+escape(entry.name)+' · '+escape(entry.currency||"Currency unverified")+'</small></button>').join("")
      : symbols.length ? "No Nasdaq listing found. You can still enter a ticker manually." : "Nasdaq directory is unavailable. Enter a ticker manually.";
  }
  input?.addEventListener("input", () => {clearTimeout(debounce);debounce=setTimeout(()=>render(input.value),120)});
  results?.addEventListener("click", event => {
    const button = event.target.closest("[data-market-symbol]"); if(!button) return;
    ticker.value = button.dataset.marketSymbol;
    activeCurrency=symbols.find(x=>x.symbol===ticker.value)?.currency||null;
    const stockCalc = el("stock-calc-symbol"); if(stockCalc) stockCalc.value = ticker.value;
    const entry = symbols.find(x => x.symbol === ticker.value);
    input.value = entry?.name || ticker.value; render(ticker.value);
  });
  ticker?.addEventListener("input", () => {ticker.value = ticker.value.toUpperCase().replace(/[^A-Z0-9.^-]/g,"")});
  async function loadSymbols() {
    try {
      const requested=activeExchange;
      const data = await request("/api/market?kind=symbols&exchange="+encodeURIComponent(requested));
      if(requested!==activeExchange)return;
      symbols = data.symbols || [];
      if(!symbols.length) throw new Error("No verified listings are available for this market.");
      providerHint.textContent=(data.source||"Provider")+" · "+symbols.length.toLocaleString()+" available listings.";
      list.innerHTML = symbols.slice(0,300).map(x => '<option value="'+escape(x.symbol)+'" label="'+escape(x.name)+'"></option>').join("");
      render(input.value);
    } catch(error) { results.textContent = error.message; }
  }
  async function quote() {
    const symbol = ticker.value.trim().toUpperCase(), box=el("stock-quote-result");
    if(!/^[A-Z0-9.^-]{1,12}$/.test(symbol)){box.innerHTML="<strong>Stock quote</strong><p>Enter a valid ticker.</p>";return}
    box.innerHTML="<strong>Stock quote</strong><p>Checking available quote…</p>";
    try{
      const data=await request("/api/market?kind=quote&exchange="+encodeURIComponent(activeExchange)+"&symbol="+encodeURIComponent(symbol));
      box.innerHTML='<strong>'+escape(symbol)+'</strong><div class="market-price">'+formatPrice(Number(data.price),data.currency||activeCurrency)+'</div><p>'+escape(data.source)+' · '+escape(data.asOf || "Quote time unavailable")+' · '+escape(data.note)+'</p>';
    } catch(error){box.innerHTML='<strong>'+escape(symbol)+' — unavailable</strong><p>'+escape(error.message)+'</p>'}
  }
  el("market-quote-button")?.addEventListener("click", quote);
  async function gold() {
    const box=el("gold-quote-result");if(!box)return;
    box.innerHTML="<strong>Gold · XAU/USD</strong><p>Loading available spot price…</p>";
    try {
      const data=await request("/api/market?kind=gold");
      box.innerHTML='<strong>Gold · XAU/USD</strong><div class="market-price">'+formatPrice(Number(data.price),"USD")+' <small>/ troy oz</small></div><p>'+escape(data.source)+' · '+escape(data.asOf || "Timestamp unavailable")+' · '+escape(data.note)+'</p><button class="secondary" id="gold-refresh" type="button">Refresh</button>';
    } catch(error){box.innerHTML='<strong>Gold · XAU/USD</strong><p>'+escape(error.message)+'</p><button class="secondary" id="gold-refresh" type="button">Retry</button>'}
  }
  el("gold-quote-result")?.addEventListener("click",event=>{if(event.target.closest("#gold-refresh")) gold()});
  function formatPrice(value,currency){
    if(!currency)return value.toLocaleString(undefined,{maximumFractionDigits:4})+" (currency not verified)";
    const native=new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:4}).format(value);
    const app=window.NomadApp;const main=app?.getMainCurrency?.();
    if(main&&main!==currency){const amount=app.inMain(value,currency);if(Number.isFinite(amount))return native+" <small>≈ "+escape(app.money(amount,main))+"</small>";}
    return native;
  }
  country?.addEventListener("change",setupExchanges);
  exchange?.addEventListener("change",()=>{activeExchange=exchange.value;activeCurrency=null;input.value="";ticker.value="";loadSymbols()});
  if(country){const all=window.NOMAD_WEALTH_COUNTRIES||[];country.innerHTML=all.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=>'<option value="'+escape(c.code)+'">'+escape(c.name)+'</option>').join("");country.value="US";setupExchanges();}
  gold();
})();
