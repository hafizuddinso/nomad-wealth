// Vercel serverless read-only market adapter. Never include the API token in client files.
const validSymbol = symbol => /^[A-Z0-9.^-]{1,12}$/.test(symbol);
const error = (res,status,message) => res.status(status).json({error:message});
let catalog = {at:0,entries:[]};
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
      if(catalog.entries.length && Date.now()-catalog.at < 86400000) return res.status(200).json({symbols:catalog.entries,source:"Nasdaq Trader"});
      const response=await fetch("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",{signal:AbortSignal.timeout(8500)});
      if(!response.ok) throw new Error("Nasdaq directory unavailable.");
      const rows=(await response.text()).split(/\r?\n/).slice(1).map(line=>line.split("|"));
      const entries=rows.filter(parts=>parts.length>=8 && validSymbol(parts[0]) && parts[3]!=="Y").map(parts=>({symbol:parts[0],name:parts[1]}));
      if(entries.length < 1000) throw new Error("Nasdaq directory returned incomplete listings.");
      catalog={at:Date.now(),entries};
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
    return res.status(200).json({price,currency:"USD",source:"Finnhub",asOf:data.t?new Date(data.t*1000).toISOString():null,note:"May be delayed; check the exchange for official pricing."});
  } catch(cause) { return error(res,503,cause instanceof Error?cause.message:"Market data unavailable."); }
};
