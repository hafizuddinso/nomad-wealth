// Vercel serverless read-only market adapter. Never include the API token in client files.
const validSymbol = symbol => /^[A-Z0-9.^-]{1,12}$/.test(symbol);
const error = (res,status,message) => res.status(status).json({error:message});
const markets=new Set(["NASDAQ","US","BD","RU","GB","IN","JP","DE","FR","CA","AU","CN","HK","SG","FI","SE","NO","DK","ES","IT","NL","BE","CH","BR","MX","ZA","KR","AE","SA","TR","PK","TH","ID","MY","VN","PH","NZ","PL","PT","IE","AT","CZ"]);
const catalog=new Map();
async function getJSON(url,headers) {
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(8500)});
  if(!response.ok) throw new Error("Market source returned "+response.status);
  return await response.json();
}
module.exports = async (req,res) => {
  res.setHeader("Cache-Control","public, s-maxage=180, stale-while-revalidate=300");
  const kind=String(req.query?.kind || "");
  if(!["symbols","quote","gold"].includes(kind)) return error(res,400,"Unsupported market request.");
  try {
    if(kind==="symbols"){
      const exchange=String(req.query.exchange||"NASDAQ").toUpperCase();
      if(!markets.has(exchange))return error(res,400,"This exchange does not have a configured market feed.");
      const cached=catalog.get(exchange);
      if(cached && Date.now()-cached.at < 86400000) return res.status(200).json({symbols:cached.entries,source:cached.source});
      if(exchange!=="NASDAQ"){
        const key=process.env.FINNHUB_API_KEY;
        if(!key)return error(res,503,"Listings for this country require FINNHUB_API_KEY in Vercel. Coverage may not include this exchange.");
        const rows=await getJSON("https://finnhub.io/api/v1/stock/symbol?exchange="+encodeURIComponent(exchange),{"X-Finnhub-Token":key});
        if(!Array.isArray(rows))throw Error("Market directory is not supported by this provider.");
        const entries=rows.filter(x=>validSymbol(x.symbol||"")&&x.description).slice(0,25000).map(x=>({symbol:x.symbol,name:x.description,currency:/^[A-Z]{3}$/.test(x.currency||"")?x.currency:null}));
        if(!entries.length)throw Error("No verified listings returned for this market or subscription.");
        catalog.set(exchange,{at:Date.now(),entries,source:"Finnhub"});
        return res.status(200).json({symbols:entries,source:"Finnhub"});
      }
      const response=await fetch("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",{signal:AbortSignal.timeout(8500)});
      if(!response.ok) throw new Error("Nasdaq directory unavailable.");
      const rows=(await response.text()).split(/\r?\n/).slice(1).map(line=>line.split("|"));
      const entries=rows.filter(parts=>parts.length>=8 && validSymbol(parts[0]) && parts[3]!=="Y").map(parts=>({symbol:parts[0],name:parts[1],currency:"USD"}));
      if(entries.length < 1000) throw new Error("Nasdaq directory returned incomplete listings.");
      catalog.set(exchange,{at:Date.now(),entries,source:"Nasdaq Trader"});
      return res.status(200).json({symbols:entries,source:"Nasdaq Trader"});
    }
    if(kind==="gold"){
      const data=await getJSON("https://api.gold-api.com/price/XAU");
      const price=Number(data.price);
      if(!Number.isFinite(price)||price<=0) throw new Error("Gold price currently unavailable.");
      return res.status(200).json({price,currency:"USD",source:"Gold API",asOf:data.updatedAt||null,note:"Indicative spot price; may be delayed."});
    }
    const symbol=String(req.query?.symbol||"").trim().toUpperCase();
    if(!validSymbol(symbol)) return error(res,400,"Enter a valid ticker symbol.");
    const key=process.env.FINNHUB_API_KEY;
    if(!key) return error(res,503,"Individual stock quotes require FINNHUB_API_KEY in Vercel. Nasdaq name search works without a key.");
    const data=await getJSON("https://finnhub.io/api/v1/quote?symbol="+encodeURIComponent(symbol),{"X-Finnhub-Token":key});
    const price=Number(data.c);
    if(!Number.isFinite(price)||price<=0) return error(res,404,"No quote was returned for this ticker.");
    const exchange=String(req.query.exchange||"NASDAQ").toUpperCase();
    const verified=catalog.get(exchange)?.entries?.find(entry=>entry.symbol===symbol);
    return res.status(200).json({price,currency:exchange==="NASDAQ"?"USD":verified?.currency||null,source:"Finnhub",asOf:data.t?new Date(data.t*1000).toISOString():null,note:"May be delayed; check the exchange for official pricing."});
  } catch(cause) { return error(res,503,cause instanceof Error?cause.message:"Market data unavailable."); }
};
