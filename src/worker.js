const fields = [
  "id","title","subtitle","author","series","seriesOrder","description","fullDescription",
  "bookPages","genre","publicationStatus","publicationDate","isbn","bookFormat","purchaseLink",
  "amazonLink","googlePlayBooksLink","featuredBook","hardcoverAvailable","paperbackAvailable",
  "eBookAvailable","audiobookAvailable","signedCopyAvailable","signedHardcoverPrice",
  "signedPaperbackPrice","directOrderInstructions","signedCopyContactEmail","signedCopyInstructions",
  "signedContactEmail","slug","coverUrl"
];
const boolFields = new Set(["featuredBook","hardcoverAvailable","paperbackAvailable","eBookAvailable","audiobookAvailable","signedCopyAvailable"]);
const headers = {"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers});
function safeBook(row) {
  const out={...row};
  for (const k of boolFields) out[k]=!!Number(out[k]||0);
  return out;
}
function slugify(s){return String(s||"book").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"book";}
function isAuthorized(request,env){
  const token=env.ADMIN_TOKEN;
  if(!token) return false;
  return request.headers.get("authorization")==="Bearer "+token;
}
function toDb(book){
  const out={};
  for(const k of fields){
    let v=book[k] ?? "";
    if(k==="id") v=String(v||crypto.randomUUID());
    if(boolFields.has(k)) v=(v===true||v===1||String(v).toLowerCase()==="true"||String(v)==="1")?1:0;
    out[k]=v;
  }
  if(!out.slug) out.slug=slugify(out.title)+(out.seriesOrder?("-"+slugify(out.seriesOrder)):"");
  if(!out.author) out.author="R. E. Smith";
  return out;
}
async function listBooks(env){
  const {results=[]}=await env.DB.prepare("SELECT * FROM books ORDER BY CASE WHEN publicationDate GLOB '[0-9][0-9][0-9][0-9]*' THEN publicationDate ELSE '' END DESC, title COLLATE NOCASE ASC").all();
  return results.map(safeBook);
}
export default {
 async fetch(request,env){
   const url=new URL(request.url);
   if(!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
   if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{...headers,"access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-allow-headers":"content-type,authorization"}});
   try {
    if(url.pathname==="/api/books" && request.method==="GET"){
      const books=await listBooks(env);
      const q=(url.searchParams.get("q")||"").toLowerCase().trim();
      const series=url.searchParams.get("series")||"";
      const genre=url.searchParams.get("genre")||"";
      const status=url.searchParams.get("status")||"";
      const featured=url.searchParams.get("featured")==="1";
      let result=books.filter(b=>{
        const hay=[b.title,b.subtitle,b.series,b.genre,b.description,b.fullDescription,b.isbn].join(" ").toLowerCase();
        return (!q||hay.includes(q))&&(!series||b.series===series)&&(!genre||b.genre===genre)&&(!status||b.publicationStatus===status)&&(!featured||b.featuredBook);
      });
      return json({books:result,total:result.length});
    }
    if(url.pathname==="/api/admin/check" && request.method==="GET"){
      return json({authorized:isAuthorized(request,env),configured:!!env.ADMIN_TOKEN});
    }
    if(url.pathname==="/api/admin/books" && request.method==="POST"){
      if(!isAuthorized(request,env)) return json({error:"Unauthorized. Check the admin token."},401);
      const body=await request.json();
      const batch=Array.isArray(body.books)?body.books:[body];
      if(batch.length>1000) return json({error:"Import limited to 1,000 books at a time."},413);
      const stmts=[];
      for(const raw of batch){
        if(!raw.title||!String(raw.title).trim()) continue;
        const b=toDb(raw);
        const cols=fields;
        const vals=cols.map(k=>b[k]);
        const placeholders=cols.map(()=>"?").join(",");
        const updates=cols.filter(k=>k!=="id").map(k=>`${k}=excluded.${k}`).join(",");
        stmts.push(env.DB.prepare(`INSERT INTO books (${cols.join(",")}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}, updatedAt=CURRENT_TIMESTAMP`).bind(...vals));
      }
      if(stmts.length) await env.DB.batch(stmts);
      return json({saved:stmts.length});
    }
    if(url.pathname.startsWith("/api/admin/books/") && request.method==="DELETE"){
      if(!isAuthorized(request,env)) return json({error:"Unauthorized."},401);
      const id=decodeURIComponent(url.pathname.split("/").pop());
      const result=await env.DB.prepare("DELETE FROM books WHERE id=?").bind(id).run();
      return json({deleted:result.meta.changes||0});
    }
    if(url.pathname.startsWith("/api/admin/books/") && request.method==="PUT"){
      if(!isAuthorized(request,env)) return json({error:"Unauthorized."},401);
      const id=decodeURIComponent(url.pathname.split("/").pop());
      const b=toDb({...await request.json(),id});
      const cols=fields.filter(k=>k!=="id");
      await env.DB.prepare(`INSERT INTO books (${fields.join(",")}) VALUES (${fields.map(()=>"?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${cols.map(k=>`${k}=excluded.${k}`).join(",")},updatedAt=CURRENT_TIMESTAMP`).bind(...fields.map(k=>b[k])).run();
      return json({book:safeBook(await env.DB.prepare("SELECT * FROM books WHERE id=?").bind(id).first())});
    }
    return json({error:"Not found"},404);
   } catch(e){return json({error:"Server error",detail:env.ENVIRONMENT==="development"?String(e):"Please check database setup and try again."},500);}
 }
};
