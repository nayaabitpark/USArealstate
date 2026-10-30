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

  let allProperties = [];
  async function loadProperties() {
    const grid = $("#propertyGrid");
    if (!client) {
      grid.innerHTML = '<div class="empty-state">Website preview is ready. Add your Supabase publishable key and run supabase-schema.sql to load live property listings.</div>';
      return;
    }
    const { data, error } = await client.from("properties")
      .select("id,title,description,price,listing_type,address,city,state,zip_code,beds,baths,sqft,image_url")
      .eq("is_active", true).order("created_at", {ascending:false});
    if (error) {
      grid.innerHTML = '<div class="empty-state">Property listings are temporarily unavailable. Please try again later.</div>';
      console.error(error);
      return;
    }
    allProperties = data || [];
    renderProperties(allProperties);
  }

  function renderProperties(items) {
    const grid = $("#propertyGrid");
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state">No matching properties yet. Please check back soon or send us an inquiry.</div>';
      return;
    }
    grid.innerHTML = items.map(p => `
      <article class="property-card">
        <div class="property-image">
          <img loading="lazy" src="${escapeHTML(p.image_url || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80")}" alt="${escapeHTML(p.title)}">
          <span class="property-tag">${p.listing_type === "rent" ? "For rent" : "For sale"}</span>
        </div>
        <div class="property-info">
          <p class="property-price">${money(p.price,p.listing_type)}</p>
          <h3>${escapeHTML(p.title)}</h3>
          <p class="property-address">${escapeHTML([p.address,p.city,p.state,p.zip_code].filter(Boolean).join(", "))}</p>
          <div class="property-meta"><span>${Number(p.beds)||0} Beds</span><span>${Number(p.baths)||0} Baths</span>${p.sqft ? `<span>${Number(p.sqft).toLocaleString("en-US")} Sq Ft</span>` : ""}</div>
          <a class="property-link" href="#contact" data-inquiry="${escapeHTML(p.title)}">REQUEST DETAILS ↗</a>
        </div>
      </article>`).join("");
    grid.querySelectorAll("[data-inquiry]").forEach(a => a.addEventListener("click", () => {
      const message = $("#leadForm").elements.message;
      message.value = `I'm interested in: ${a.dataset.inquiry}`;
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

  $("#leadForm").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = $("#leadMessage");
    msg.className = "form-message";
    if (!client) {
      msg.textContent = "The form is in preview mode. Add your Supabase publishable key and database schema to enable submissions.";
      msg.classList.add("error"); return;
    }
    const f = e.currentTarget;
    const v = Object.fromEntries(new FormData(f).entries());
    const payload = {
      full_name: v.full_name.trim(), phone: v.phone.trim(), email: v.email.trim().toLowerCase(),
      interest: v.interest, preferred_location: (v.preferred_location || "").trim() || null,
      message: (v.message || "").trim() || null,
      contact_consent: v.contact_consent === "on",
      marketing_consent: v.marketing_consent === "on",
      source: "website"
    };
    const button = f.querySelector("button[type=submit]");
    button.disabled = true; button.textContent = "Sending…";
    const { error } = await client.from("leads").insert(payload);
    button.disabled = false; button.innerHTML = 'Send my request <span>→</span>';
    if (error) {
      msg.textContent = "We couldn't submit your request right now. Please try again or contact our team.";
      msg.classList.add("error"); console.error(error); return;
    }
    f.reset();
    msg.textContent = "Thank you! Your request has been received. Our team will contact you.";
  });

  loadProperties();
})();