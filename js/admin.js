(() => {
  const $ = s => document.querySelector(s);
  const ready = window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.includes("PASTE_");
  const db = ready ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
  const loginPanel=$("#loginPanel"), dashboard=$("#dashboard");
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const say=(el,msg,bad=false)=>{el.textContent=msg;el.className="form-message"+(bad?" error":"")};
  if(!db){say($("#loginMessage"),"Add your Supabase publishable key in js/config.js before signing in.",true);$("#loginForm button").disabled=true;return;}

  async function isAdmin(userId){
    const {data,error}=await db.from("admin_users").select("user_id").eq("user_id",userId).maybeSingle();
    return !error && !!data;
  }
  async function showSession(){
    const {data:{session}}=await db.auth.getSession();
    if(!session){loginPanel.hidden=false;dashboard.hidden=true;return;}
    const allowed=await isAdmin(session.user.id);
    if(!allowed){await db.auth.signOut();loginPanel.hidden=false;dashboard.hidden=true;say($("#loginMessage"),"This account is not authorized as an administrator.",true);return;}
    loginPanel.hidden=true;dashboard.hidden=false;loadLeads();loadProperties();
  }
  $("#loginForm").addEventListener("submit",async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);const btn=e.currentTarget.querySelector("button");btn.disabled=true;
    const {error}=await db.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});
    btn.disabled=false;
    if(error){say($("#loginMessage"),"Sign-in failed. Check your email and password.",true);return;}
    await showSession();
  });
  $("#logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();await showSession();});
  db.auth.onAuthStateChange(()=>{setTimeout(showSession,0);});

  async function loadLeads(){
    const body=$("#leadsBody");body.innerHTML='<tr><td colspan="6">Loading…</td></tr>';
    const {data,error}=await db.from("leads").select("id,created_at,full_name,phone,email,interest,preferred_location,status").order("created_at",{ascending:false}).limit(500);
    if(error){body.innerHTML='<tr><td colspan="6">Could not load leads. Check admin permissions and RLS policies.</td></tr>';return;}
    if(!data.length){body.innerHTML='<tr><td colspan="6">No customer inquiries yet.</td></tr>';return;}
    body.innerHTML=data.map(l=>`<tr><td>${new Date(l.created_at).toLocaleDateString("en-US")}</td><td><b>${esc(l.full_name)}</b></td><td>${esc(l.phone)}<br>${esc(l.email)}</td><td>${esc(l.interest)}</td><td>${esc(l.preferred_location||"—")}</td><td><select class="status-select" data-lead="${l.id}">${["new","contacted","qualified","closed"].map(s=>`<option value="${s}" ${l.status===s?"selected":""}>${s}</option>`).join("")}</select></td></tr>`).join("");
    body.querySelectorAll("[data-lead]").forEach(sel=>sel.addEventListener("change",async()=>{const {error}=await db.from("leads").update({status:sel.value}).eq("id",sel.dataset.lead);if(error)alert("Could not update lead status.");}));
  }
  $("#refreshLeads").addEventListener("click",loadLeads);

  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));
    $("#leadsPanel").hidden=btn.dataset.tab!=="leads";$("#propertiesPanel").hidden=btn.dataset.tab!=="properties";
  }));
  async function loadProperties(){
    const body=$("#propertiesBody");body.innerHTML='<tr><td colspan="5">Loading…</td></tr>';
    const {data,error}=await db.from("properties").select("id,title,city,state,price,listing_type,is_active").order("created_at",{ascending:false});
    if(error){body.innerHTML='<tr><td colspan="5">Could not load properties.</td></tr>';return;}
    body.innerHTML=data.length?data.map(p=>`<tr><td>${esc(p.title)}</td><td>${esc([p.city,p.state].filter(Boolean).join(", "))}</td><td>${Number(p.price).toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0})}</td><td>${esc(p.listing_type)}</td><td><button class="status-select" data-property="${p.id}" data-active="${p.is_active}">${p.is_active?"Deactivate":"Activate"}</button></td></tr>`).join(""):'<tr><td colspan="5">No properties added.</td></tr>';
    body.querySelectorAll("[data-property]").forEach(b=>b.addEventListener("click",async()=>{const next=b.dataset.active!=="true";const {error}=await db.from("properties").update({is_active:next}).eq("id",b.dataset.property);if(error)alert("Could not update property.");else loadProperties();}));
  }
  $("#propertyForm").addEventListener("submit",async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);const msg=$("#propertyMessage");
    const payload={title:f.get("title").trim(),listing_type:f.get("listing_type"),price:Number(f.get("price")),image_url:f.get("image_url")||null,address:f.get("address")||null,city:f.get("city")||null,state:(f.get("state")||"").toUpperCase()||null,zip_code:f.get("zip_code")||null,beds:Number(f.get("beds")||0),baths:Number(f.get("baths")||0),sqft:Number(f.get("sqft")||0)||null,description:f.get("description")||null,is_active:true};
    const {error}=await db.from("properties").insert(payload);
    if(error){say(msg,"Could not add property. Check required fields and admin permissions.",true);return;}
    e.currentTarget.reset();say(msg,"Property added successfully.");loadProperties();
  });
  showSession();
})();