// Market research is read-only. It never sends financial-account data to market providers.
(() => {
  const el = id => document.getElementById(id);
  const escape = input => String(input ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
  const input = el("stock-search"), results = el("stock-search-results");
  const ticker = el("market-selected-symbol"), list = el("market-symbol-list");
  let symbols = [], debounce;
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
      ? matches.map(entry => '<button class="market-result-button" type="button" data-market-symbol="'+escape(entry.symbol)+'"><strong>'+escape(entry.symbol)+'</strong><small>'+escape(entry.name)+'</small></button>').join("")
      : symbols.length ? "No Nasdaq listing found. You can still enter a ticker manually." : "Nasdaq directory is unavailable. Enter a ticker manually.";
  }
  input?.addEventListener("input", () => {clearTimeout(debounce);debounce=setTimeout(()=>render(input.value),120)});
  results?.addEventListener("click", event => {
    const button = event.target.closest("[data-market-symbol]"); if(!button) return;
    ticker.value = button.dataset.marketSymbol;
    const stockCalc = el("stock-calc-symbol"); if(stockCalc) stockCalc.value = ticker.value;
    const entry = symbols.find(x => x.symbol === ticker.value);
    input.value = entry?.name || ticker.value; render(ticker.value);
  });
  ticker?.addEventListener("input", () => {ticker.value = ticker.value.toUpperCase().replace(/[^A-Z0-9.^-]/g,"")});
  async function loadSymbols() {
    try {
      const data = await request("/api/market?kind=symbols");
      symbols = data.symbols || [];
      if(!symbols.length) throw new Error("Nasdaq listing directory is unavailable.");
      list.innerHTML = symbols.slice(0,300).map(x => '<option value="'+escape(x.symbol)+'" label="'+escape(x.name)+'"></option>').join("");
      render(input.value);
    } catch(error) { results.textContent = error.message; }
  }
  async function quote() {
    const symbol = ticker.value.trim().toUpperCase(), box=el("stock-quote-result");
    if(!/^[A-Z0-9.^-]{1,12}$/.test(symbol)){box.innerHTML="<strong>Stock quote</strong><p>Enter a valid ticker.</p>";return}
    box.innerHTML="<strong>Stock quote</strong><p>Checking available quote…</p>";
    try{
      const data=await request("/api/market?kind=quote&symbol="+encodeURIComponent(symbol));
      box.innerHTML='<strong>'+escape(symbol)+'</strong><div class="market-price">USD '+Number(data.price).toLocaleString(undefined,{maximumFractionDigits:4})+'</div><p>'+escape(data.source)+' · '+escape(data.asOf || "Quote time unavailable")+' · '+escape(data.note)+'</p>';
    } catch(error){box.innerHTML='<strong>'+escape(symbol)+' — unavailable</strong><p>'+escape(error.message)+'</p>'}
  }
  el("market-quote-button")?.addEventListener("click", quote);
  async function gold() {
    const box=el("gold-quote-result");if(!box)return;
    box.innerHTML="<strong>Gold · XAU/USD</strong><p>Loading available spot price…</p>";
    try {
      const data=await request("/api/market?kind=gold");
      box.innerHTML='<strong>Gold · XAU/USD</strong><div class="market-price">USD '+Number(data.price).toLocaleString(undefined,{maximumFractionDigits:2})+' <small>/ troy oz</small></div><p>'+escape(data.source)+' · '+escape(data.asOf || "Timestamp unavailable")+' · '+escape(data.note)+'</p><button class="secondary" id="gold-refresh" type="button">Refresh</button>';
    } catch(error){box.innerHTML='<strong>Gold · XAU/USD</strong><p>'+escape(error.message)+'</p><button class="secondary" id="gold-refresh" type="button">Retry</button>'}
  }
  el("gold-quote-result")?.addEventListener("click",event=>{if(event.target.closest("#gold-refresh")) gold()});
  if(input) loadSymbols();
  gold();
})();
