(() => {
  const $ = (s) => document.querySelector(s);
  const supabaseReady = () => window.supabase && window.SUPABASE_URL &&
    window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.includes("PASTE_");
  const client = supabaseReady()
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
    : null;

  $("#year").textContent = new Date().getFullYear();
  $("#menuToggle").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
  $("#mainNav").querySelectorAll("a").forEach(a => a.addEventListener("click", () => $("#mainNav").classList.remove("open")));

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const money = (amount, type) => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "Contact for price";
    return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n) + (type === "rent" ? " / month" : "");
  };
  const TYPE_LABELS = { house:"House", apartment:"Apartment", condo:"Condo", townhouse:"Townhouse", room:"Room", other:"Property" };
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const FALLBACK_IMG = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80";

  const form = $("#leadForm");
  const chip = $("#selectedProperty");
  let allProperties = [];

  /* ---- property the visitor is asking about ---- */
  function selectProperty(p) {
    form.elements.property_id.value = p.id;
    $("#selectedPropertyTitle").textContent = p.title;
    $("#selectedPropertyMeta").textContent = [
      money(p.price, p.listing_type),
      [p.address, p.city, p.state].filter(Boolean).join(", ")
    ].filter(Boolean).join(" · ");
    chip.hidden = false;
    if (!form.elements.interest.value) form.elements.interest.value = p.listing_type === "rent" ? "rent" : "buy";
  }
  function clearProperty() {
    form.elements.property_id.value = "";
    chip.hidden = true;
  }
  $("#clearProperty").addEventListener("click", clearProperty);

  /* ---- load + render listings ---- */
  async function loadProperties() {
    const grid = $("#propertyGrid");
    if (!client) {
      grid.innerHTML = '<div class="empty-state">Website preview is ready. Add your Supabase publishable key and run supabase-schema.sql to load live property listings.</div>';
      return;
    }
    const { data, error } = await client.from("properties")
      .select("id,title,description,price,listing_type,property_type,address,city,state,zip_code,beds,baths,sqft,image_url")
      .eq("is_active", true).order("created_at", {ascending:false});
    if (error) {
      grid.innerHTML = '<div class="empty-state">Property listings are temporarily unavailable. Please try again later.</div>';
      console.error(error);
      return;
    }
    allProperties = data || [];
    renderProperties(allProperties);
    openFromLink();
  }

  // A shared link like index.html?property=<id> highlights that listing and pre-selects it in the form.
  function openFromLink() {
    const id = new URLSearchParams(location.search).get("property");
    if (!id || !UUID_RE.test(id)) return;
    const p = allProperties.find(x => x.id === id);
    if (!p) return;
    selectProperty(p);
    const card = document.getElementById("property-" + id);
    if (card) {
      card.classList.add("highlight");
      card.scrollIntoView({behavior:"smooth", block:"center"});
    }
  }

  function renderProperties(items) {
    const grid = $("#propertyGrid");
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state">No matching properties yet. Please check back soon or send us an inquiry.</div>';
      return;
    }
    grid.innerHTML = items.map(p => {
      const beds = Number(p.beds) || 0;
      return `
      <article class="property-card" id="property-${escapeHTML(p.id)}">
        <div class="property-image">
          <img loading="lazy" src="${escapeHTML(p.image_url || FALLBACK_IMG)}" alt="${escapeHTML(p.title)}">
          <span class="property-tag">${p.listing_type === "rent" ? "For rent" : "For sale"}</span>
        </div>
        <div class="property-info">
          <p class="property-price">${money(p.price,p.listing_type)}</p>
          <h3>${escapeHTML(p.title)}</h3>
          <p class="property-address">${escapeHTML([p.address,p.city,p.state,p.zip_code].filter(Boolean).join(", "))}</p>
          <div class="property-meta"><span>${beds ? beds + " Beds" : "Studio"}</span><span>${Number(p.baths)||0} Baths</span><span>${escapeHTML(TYPE_LABELS[p.property_type] || "Property")}</span>${p.sqft ? `<span>${Number(p.sqft).toLocaleString("en-US")} Sq Ft</span>` : ""}</div>
          <a class="property-link" href="#contact" data-id="${escapeHTML(p.id)}">REQUEST DETAILS ↗</a>
        </div>
      </article>`;
    }).join("");
    grid.querySelectorAll("[data-id]").forEach(a => a.addEventListener("click", () => {
      const p = allProperties.find(x => x.id === a.dataset.id);
      if (p) selectProperty(p);
    }));
  }

  $("#searchForm").addEventListener("submit", e => {
    e.preventDefault();
    const type = $("#filterType").value;
    const location = $("#filterLocation").value.trim().toLowerCase();
    const beds = Number($("#filterBeds").value || 0);
    const filtered = allProperties.filter(p => {
      const place = [p.address,p.city,p.state,p.zip_code].join(" ").toLowerCase();
      return (!type || p.listing_type === type) && (!location || place.includes(location)) && (!beds || Number(p.beds) >= beds);
    });
    renderProperties(filtered);
    $("#properties").scrollIntoView({behavior:"smooth"});
  });

  /* ---- inquiry form ---- */
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const msg = $("#leadMessage");
    msg.className = "form-message";
    if (!client) {
      msg.textContent = "The form is in preview mode. Add your Supabase publishable key and database schema to enable submissions.";
      msg.classList.add("error"); return;
    }
    const v = Object.fromEntries(new FormData(form).entries());
    const email = (v.email || "").trim().toLowerCase();
    const payload = {
      full_name: v.full_name.trim(), phone: v.phone.trim(), email: email || null,
      interest: v.interest, preferred_location: (v.preferred_location || "").trim() || null,
      message: (v.message || "").trim() || null,
      property_id: UUID_RE.test(v.property_id || "") ? v.property_id : null,
      contact_consent: v.contact_consent === "on",
      marketing_consent: v.marketing_consent === "on",
      source: "website"
    };
    const button = form.querySelector("button[type=submit]");
    button.disabled = true; button.textContent = "Sending…";
    let { error } = await client.from("leads").insert(payload);
    if (error && error.code === "23503" && payload.property_id) {
      // the listing was removed while the visitor was typing: still keep the inquiry
      payload.property_id = null;
      ({ error } = await client.from("leads").insert(payload));
    }
    button.disabled = false; button.innerHTML = 'Send my request <span>→</span>';
    if (error) {
      msg.textContent = "We couldn't submit your request right now. Please try again or contact our team.";
      msg.classList.add("error"); console.error(error); return;
    }
    form.reset();
    clearProperty();
    msg.textContent = "Thank you! Your request has been received. Our team will contact you.";
  });

  loadProperties();
})();
