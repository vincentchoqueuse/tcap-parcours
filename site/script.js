/* ==========================================================================
   TCAP · Parcours — application
   - Carte Leaflet (fond classique / relief + tracé coloré par pente)
   - Panneau liste : filtres + parcours ; panneau infos : stats, profil, textes
   - Bureau : panneaux latéraux repliables. Mobile : onglets Liste / Carte, infos en modale.
   - URL : ?id=<slug> ouvre un parcours ; start / type / tag / sort / mode filtrent la vue.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- données et constantes ---------- */
  const ROUTES = window.ROUTES || [];
  const ROUTE_BY_ID = Object.fromEntries(ROUTES.map(r => [r.id, r]));
  const TYPES = [
    ["trail", "Trail"], ["endurance", "Endurance"], ["fractionné", "Fractionné"],
    ["côtes", "Côtes"], ["seuil", "Seuil"], ["course", "Course"],
  ];
  const TYPE_LABEL = Object.fromEntries(TYPES);
  const TAG_ORDER = ["GR34", "littoral", "intérieur", "mixte", "plat", "route", "court", "sortie longue", "départ déporté", "parcours de course"];
  const HIDDEN_TAGS = new Set(["semaine", "séance"]);
  const DEFAULTS = { start: "keralaurent", type: "tous", tag: "tous", sort: "dist" };
  const TRACK_COLOR = "#4f46e5";
  const ICONS = {
    gpx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 19h16"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    chef: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 21h10"/><path d="M7 21v-6"/><path d="M17 21v-6"/><path d="M6 15h12"/><path d="M6 15V9.5a2.5 2.5 0 0 1-1-4.6A3 3 0 0 1 9.3 3a3.5 3.5 0 0 1 5.4 0 3 3 0 0 1 4.3 1.9 2.5 2.5 0 0 1-1 4.6V15"/></svg>',
  };

  /* ---------- état ---------- */
  const query = new URLSearchParams(location.search);
  const state = {
    start: query.get("start") || DEFAULTS.start,
    type: query.get("type") || DEFAULTS.type,
    tag: query.get("tag") || DEFAULTS.tag,
    sort: query.get("sort") || DEFAULTS.sort,
    mode: query.get("mode") === "relief" ? "relief" : "classic",
    routeId: "",
    variantIndex: 0,
    tab: "map",            // mobile : "list" | "map"
    listOpen: true,        // bureau
    infoOpen: false,       // bureau : panneau ; mobile : modale
  };
  const map = { instance: null, base: null, overview: null, overviewLines: {}, track: null, slope: null, extras: null, cursor: null };

  /* ---------- utilitaires ---------- */
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];
  const isMobile = () => window.matchMedia("(max-width: 900px)").matches;
  const typeClass = type => "type-" + type.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const fmtKm = km => km.toLocaleString("fr-FR");
  const routeUrl = id => location.origin + location.pathname.replace(/index\.html$/, "") + "?id=" + id;
  const visibleTags = tags => tags.filter(t => !HIDDEN_TAGS.has(t));

  function haversine(a, b) {
    const R = 6371000, k = Math.PI / 180;
    const dLat = (b[0] - a[0]) * k, dLon = (b[1] - a[1]) * k;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * k) * Math.cos(b[0] * k) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function slopeColor(pct) {
    if (pct < -1) return "#3b82c4";
    if (pct < 4) return "#3c9a4a";
    if (pct < 8) return "#d9c11f";
    if (pct < 12) return "#e07b1a";
    return "#b3171f";
  }
  function toast(message) {
    const el = $("#toast");
    el.textContent = message; el.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 1800);
  }
  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (err) {
      const input = document.createElement("input");
      input.value = text; document.body.appendChild(input); input.select(); document.execCommand("copy"); input.remove();
    }
    toast("Lien copié");
  }

  /* ---------- URL ---------- */
  function buildQuery(routeId) {
    const q = new URLSearchParams();
    for (const key of ["start", "type", "tag", "sort"]) if (state[key] !== DEFAULTS[key]) q.set(key, state[key]);
    if (state.mode === "relief") q.set("mode", "relief");
    if (routeId) q.set("id", routeId);
    const s = q.toString();
    return s ? "?" + s : location.pathname;
  }
  const syncUrl = () => history.replaceState({ id: state.routeId }, "", buildQuery(state.routeId));
  const idFromUrl = () => new URLSearchParams(location.search).get("id") || location.hash.slice(1);

  /* ---------- disposition : panneaux, onglets, modale ---------- */
  function applyLayout() {
    const mobile = isMobile();
    const listVisible = mobile ? state.tab === "list" : state.listOpen;
    $("#panel-list").hidden = !listVisible;
    $("#toggle-list").setAttribute("aria-expanded", String(state.listOpen));
    document.body.classList.toggle("list-closed", !state.listOpen);

    const info = $("#panel-info");
    if (mobile) {
      info.hidden = false;
      info.classList.toggle("is-open", state.infoOpen);
      $("#backdrop").hidden = !state.infoOpen;
    } else {
      info.hidden = !state.infoOpen;
      info.classList.remove("is-open");
      $("#backdrop").hidden = true;
    }
    $("#toggle-info").setAttribute("aria-expanded", String(state.infoOpen));
    document.body.classList.toggle("info-closed", !state.infoOpen);

    $$(".tab").forEach(t => t.classList.toggle("is-active", t.dataset.tab === state.tab));
    $("#map-card").hidden = !(mobile && state.routeId && state.tab === "map");
    setTimeout(() => map.instance && map.instance.invalidateSize(), 30);
  }
  function setInfoOpen(open) { state.infoOpen = open; applyLayout(); }
  function setListOpen(open) { state.listOpen = open; applyLayout(); }
  function setTab(tab) {
    state.tab = tab; applyLayout();
    if (tab === "map") fitCurrent();
  }

  /* ---------- filtres et liste ---------- */
  function fillSelect(el, options, current) {
    el.innerHTML = options.map(([value, label]) => `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`).join("");
  }
  function renderFilters() {
    const countWhere = fn => ROUTES.filter(fn).length;
    fillSelect($("#filter-start"), [["keralaurent", "Keralaurent"], ["deporte", "Déporté"], ["tous", "Tous"]], state.start);
    fillSelect($("#filter-type"), [["tous", "Tous"], ...TYPES.filter(([t]) => ROUTES.some(r => r.type === t)).map(([t, l]) => [t, `${l} (${countWhere(r => r.type === t)})`])], state.type);
    const tagCounts = new Map();
    ROUTES.forEach(r => visibleTags(r.tags).forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)));
    const rank = t => { const i = TAG_ORDER.indexOf(t); return i < 0 ? 99 : i; };
    const tags = [...tagCounts.keys()].sort((a, b) => rank(a) - rank(b)).map(t => [t, `${t} (${tagCounts.get(t)})`]);
    fillSelect($("#filter-tag"), [["tous", "Tous"], ...tags], state.tag);
    fillSelect($("#filter-sort"), [["dist", "Distance"], ["dplus", "D+"], ["time", "Durée"], ["diff", "Difficulté"], ["name", "Nom"]], state.sort);
  }
  function filteredRoutes() {
    const comparators = {
      dist: (a, b) => a.dist_km - b.dist_km,
      dplus: (a, b) => b.dplus - a.dplus,
      time: (a, b) => a.variants[0].moving_s - b.variants[0].moving_s,
      diff: (a, b) => b.difficulty.km_effort - a.difficulty.km_effort,
      name: (a, b) => a.name.localeCompare(b.name, "fr"),
    };
    return ROUTES
      .filter(r => (state.start === "tous" || r.start_group === state.start)
        && (state.type === "tous" || r.type === state.type)
        && (state.tag === "tous" || r.tags.includes(state.tag)))
      .sort(comparators[state.sort] || comparators.dist);
  }
  function renderList() {
    const routes = filteredRoutes();
    $("#route-list").innerHTML = routes.map(r => `
      <li class="${r.id === state.routeId ? "is-selected" : ""}" data-id="${r.id}"><button type="button">
        <div class="name">${r.name}</div>
        <div class="meta">
          <span class="type ${typeClass(r.type)}">${TYPE_LABEL[r.type]}</span>
          <span>${fmtKm(r.dist_km)} km</span><span>D+ ${r.dplus} m</span><span>${r.moving}</span>
          <span class="pill level-${r.difficulty.level}">${r.difficulty.label}</span>
        </div>
      </button></li>`).join("") || `<li class="empty">Aucun parcours avec ces filtres.</li>`;
    $$("#route-list li[data-id] button").forEach(b => b.addEventListener("click", () => openRoute(b.parentElement.dataset.id)));

    const label = `${routes.length} parcours`;
    $("#count-desktop").textContent = label;
    $("#count-mobile").textContent = label;
    $("#tab-list-count").textContent = `(${routes.length})`;
    const activeFilters = ["start", "type", "tag"].filter(k => state[k] !== DEFAULTS[k]).length;
    $("#filters-badge").hidden = !activeFilters;
    $("#filters-badge").textContent = activeFilters;

    // la carte ne montre que les tracés filtrés
    const visible = new Set(routes.map(r => r.id));
    Object.entries(map.overviewLines).forEach(([id, line]) => {
      if (visible.has(id) && !map.overview.hasLayer(line)) map.overview.addLayer(line);
      if (!visible.has(id) && map.overview.hasLayer(line)) map.overview.removeLayer(line);
    });
  }
  function onFilterChange() { renderList(); syncUrl(); if (!state.routeId) fitOverview(); }
  function resetFilters() { Object.assign(state, DEFAULTS); renderFilters(); onFilterChange(); }

  /* ---------- carte ---------- */
  const osmLayer = () => L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" });
  const topoLayer = () => L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: "© OpenStreetMap contributors, SRTM · © OpenTopoMap (CC-BY-SA)" });
  const overviewStyle = () => state.routeId ? { color: "#94a3b8", weight: 2, opacity: .45 } : { color: "#64748b", weight: 3, opacity: .6 };

  function initMap() {
    map.instance = L.map("map").setView([48.36, -4.66], 12);
    map.overview = L.layerGroup().addTo(map.instance);
    ROUTES.forEach(r => {
      const line = L.polyline(r.variants[0].track.map(p => [p[0], p[1]]), overviewStyle());
      line.bindTooltip(`${r.name} · ${fmtKm(r.dist_km)} km · D+ ${r.dplus} m`, { sticky: true });
      line.on("click", () => openRoute(r.id));
      line.on("mouseover", () => line.setStyle({ color: TRACK_COLOR, weight: 5, opacity: 1 }));
      line.on("mouseout", () => line.setStyle(overviewStyle()));
      map.overviewLines[r.id] = line;
      map.overview.addLayer(line);
    });
    setMode(state.mode);
  }
  function restyleOverview() { Object.values(map.overviewLines).forEach(l => l.setStyle(overviewStyle())); }
  function setMode(mode) {
    state.mode = mode;
    $$(".segmented-btn").forEach(b => b.classList.toggle("is-active", b.dataset.mode === mode));
    if (map.base) map.instance.removeLayer(map.base);
    map.base = (mode === "relief" ? topoLayer() : osmLayer()).addTo(map.instance);
    map.base.bringToBack();
    if (map.track) {
      const [show, hide] = mode === "relief" ? [map.slope, map.track] : [map.track, map.slope];
      map.instance.removeLayer(hide); show.addTo(map.instance);
    }
    $("#slope-legend").hidden = mode !== "relief";
  }
  function fitPadding() {
    if (isMobile()) return { paddingTopLeft: [20, 64], paddingBottomRight: [20, state.routeId ? 96 : 20] };
    const css = getComputedStyle(document.documentElement);
    const listW = parseInt(css.getPropertyValue("--panel-list-w")) + 24;
    const infoW = parseInt(css.getPropertyValue("--panel-info-w")) + 24;
    return { paddingTopLeft: [state.listOpen ? listW : 24, 24], paddingBottomRight: [state.infoOpen ? infoW : 24, 24] };
  }
  function fitOverview() {
    const bounds = L.latLngBounds();
    Object.values(map.overviewLines).forEach(l => { if (map.overview.hasLayer(l)) bounds.extend(l.getBounds()); });
    if (bounds.isValid()) map.instance.fitBounds(bounds, { ...fitPadding(), animate: false });
  }
  function fitCurrent() {
    if (map.track) map.instance.fitBounds(map.track.getBounds(), { ...fitPadding(), animate: false });
    else fitOverview();
  }
  function slopeSegments(track) {
    const segments = [];
    for (let i = 0; i < track.length - 1;) {
      let j = i, length = 0;
      while (j < track.length - 1 && length < 80) { length += haversine(track[j], track[j + 1]); j++; }
      const pct = length > 0 ? ((track[j][2] - track[i][2]) / length) * 100 : 0;
      segments.push(L.polyline(track.slice(i, j + 1).map(p => [p[0], p[1]]), { color: slopeColor(pct), weight: 5, opacity: .95 }));
      i = j;
    }
    return segments;
  }
  function clearRouteLayers() {
    [map.track, map.slope, map.extras, map.cursor].forEach(l => l && map.instance.hasLayer(l) && map.instance.removeLayer(l));
    map.track = map.slope = map.extras = map.cursor = null;
  }
  function drawRoute(variant) {
    clearRouteLayers();
    const latlngs = variant.track.map(p => [p[0], p[1]]);
    const divIcon = (className, html, size) => L.divIcon({ className, html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

    map.track = L.polyline(latlngs, { color: TRACK_COLOR, weight: 4, opacity: .95 });
    map.slope = L.layerGroup(slopeSegments(variant.track));
    map.extras = L.layerGroup();
    L.marker(latlngs[0], { icon: divIcon("", '<div class="pin pin-start"></div>', 14), title: "Départ" }).addTo(map.extras);
    if (!variant.loop) L.marker(latlngs[latlngs.length - 1], { icon: divIcon("", '<div class="pin pin-end"></div>', 14), title: "Arrivée" }).addTo(map.extras);
    let distance = 0, nextMarker = 5000;
    for (let i = 1; i < variant.track.length; i++) {
      distance += haversine(variant.track[i - 1], variant.track[i]);
      if (distance >= nextMarker) {
        L.marker(latlngs[i], { icon: L.divIcon({ className: "km-marker", html: String(nextMarker / 1000), iconSize: [20, 17], iconAnchor: [10, 8] }), interactive: false }).addTo(map.extras);
        nextMarker += 5000;
      }
    }
    map.cursor = L.marker(latlngs[0], { icon: divIcon("", '<div class="cursor-marker"></div>', 14), interactive: false });

    map.extras.addTo(map.instance);
    (state.mode === "relief" ? map.slope : map.track).addTo(map.instance);
    restyleOverview();
    fitCurrent();
  }

  /* ---------- profil d'altitude ---------- */
  const PROFILE = { W: 520, H: 240, padL: 44, padR: 10, padT: 20, padB: 28 };

  function renderProfile(variant) {
    const { W, H, padL, padR, padT, padB } = PROFILE;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const profile = variant.profile, total = profile[profile.length - 1][0];
    let eleMin = Infinity, eleMax = -Infinity;
    profile.forEach(([, e]) => { eleMin = Math.min(eleMin, e); eleMax = Math.max(eleMax, e); });
    const tick = [10, 20, 25, 50, 100].find(t => (eleMax - eleMin) / t <= 5) || 100;
    eleMin = Math.floor(eleMin / tick) * tick; eleMax = Math.ceil((eleMax + 1) / tick) * tick;
    const range = Math.max(eleMax - eleMin, tick);
    const x = d => padL + (d / total) * plotW;
    const y = e => padT + plotH - ((e - eleMin) / range) * plotH;

    const line = profile.map(([d, e], i) => `${i ? "L" : "M"}${x(d).toFixed(1)} ${y(e).toFixed(1)}`).join(" ");
    const area = `M${x(0).toFixed(1)} ${padT + plotH} ${line.replace(/^M/, "L")} L${x(total).toFixed(1)} ${padT + plotH} Z`;
    let grid = "";
    for (let e = eleMin; e <= eleMax; e += tick) grid += `<line x1="${padL}" y1="${y(e).toFixed(1)}" x2="${W - padR}" y2="${y(e).toFixed(1)}" class="grid"/><text x="${padL - 6}" y="${y(e).toFixed(1)}" class="axis ylab">${e} m</text>`;
    const step = total > 30 ? 10 : total > 12 ? 4 : 2;
    let xAxis = "";
    for (let d = 0; d <= total + 1e-6; d += step) xAxis += `<text x="${x(d).toFixed(1)}" y="${H - 8}" class="axis xlab">${d} km</text>`;
    const climbs = variant.climbs.map(c => `<rect x="${x(c.from_km).toFixed(1)}" y="${padT}" width="${Math.max(2, x(c.to_km) - x(c.from_km)).toFixed(1)}" height="${plotH}" class="climb"/>`).join("");

    $("#profile").innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Profil d'altitude : ${variant.dist_km} km, D+ ${variant.dplus} m">
      <defs><linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${TRACK_COLOR}" stop-opacity=".35"/><stop offset="100%" stop-color="${TRACK_COLOR}" stop-opacity=".03"/></linearGradient></defs>
      <style>
        .grid{stroke:#e2e8f0}.axis{fill:#64748b;font-family:Inter,system-ui,sans-serif;font-size:12px}.ylab{text-anchor:end;dominant-baseline:middle}.xlab{text-anchor:middle}
        .climb{fill:#f59e0b;fill-opacity:.12}.line{fill:none;stroke:${TRACK_COLOR};stroke-width:2.5;stroke-linejoin:round}
        .cursor{pointer-events:none}.cursor-line{stroke:#0f172a;stroke-width:1;stroke-dasharray:3 3}.cursor-dot{fill:#fff;stroke:${TRACK_COLOR};stroke-width:2.5}
        .cursor-label{fill:#0f172a;font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:12px}.hit{fill:transparent;cursor:crosshair}
      </style>
      ${grid}${climbs}<path d="${area}" fill="url(#profile-fill)"/><path d="${line}" class="line"/>${xAxis}
      <rect class="hit" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}"/>
      <g class="cursor" style="display:none"><line class="cursor-line" y1="${padT}" y2="${padT + plotH}"/><circle class="cursor-dot" r="5"/><text class="cursor-label" y="${padT + 12}" text-anchor="middle"></text></g>
    </svg>`;
    bindProfileCursor(variant, { x, y, total, plotW });
  }
  function bindProfileCursor(variant, geom) {
    const svg = $("#profile svg");
    const cursor = $(".cursor", svg), line = $(".cursor-line", svg), dot = $(".cursor-dot", svg), label = $(".cursor-label", svg), hit = $(".hit", svg);
    const cumulative = [0];
    for (let i = 1; i < variant.track.length; i++) cumulative.push(cumulative[i - 1] + haversine(variant.track[i - 1], variant.track[i]));
    const scale = (geom.total * 1000) / (cumulative[cumulative.length - 1] || 1);
    const stepKm = variant.profile[1] ? variant.profile[1][0] : 0.05;

    function moveTo(clientX) {
      const rect = svg.getBoundingClientRect();
      const fx = (clientX - rect.left) / rect.width * PROFILE.W;
      const d = Math.max(0, Math.min(geom.total, ((fx - PROFILE.padL) / geom.plotW) * geom.total));
      const e = variant.profile[Math.min(variant.profile.length - 1, Math.round(d / stepKm))][1];
      const px = geom.x(d), py = geom.y(e);
      line.setAttribute("x1", px); line.setAttribute("x2", px);
      dot.setAttribute("cx", px); dot.setAttribute("cy", py);
      label.setAttribute("x", Math.max(PROFILE.padL + 45, Math.min(PROFILE.W - 50, px)));
      label.textContent = `km ${d.toFixed(1)} · ${Math.round(e)} m`;
      cursor.style.display = "";
      // point correspondant sur la carte (recherche binaire sur la distance cumulée)
      const target = (d * 1000) / scale;
      let lo = 0, hi = cumulative.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] < target) lo = mid + 1; else hi = mid; }
      if (map.cursor) { map.cursor.setLatLng([variant.track[lo][0], variant.track[lo][1]]); if (!map.instance.hasLayer(map.cursor)) map.cursor.addTo(map.instance); }
    }
    function hide() { cursor.style.display = "none"; if (map.cursor && map.instance.hasLayer(map.cursor)) map.instance.removeLayer(map.cursor); }
    hit.addEventListener("mousemove", e => moveTo(e.clientX));
    hit.addEventListener("mouseleave", hide);
    hit.addEventListener("touchstart", e => moveTo(e.touches[0].clientX), { passive: true });
    hit.addEventListener("touchmove", e => { moveTo(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
  }

  /* ---------- panneau infos ---------- */
  function elevationText(v) {
    const perKm = v.dplus / v.dist_km;
    let text;
    if (perKm < 10) text = `Profil plat (${Math.round(perKm)} m de D+ par km) : on peut rouler, pas de piège.`;
    else if (perKm < 18) text = `Profil vallonné (${Math.round(perKm)} m de D+ par km) : quelques bosses mais rien de bloquant.`;
    else if (perKm < 30) text = `Profil bien vallonné (${Math.round(perKm)} m de D+ par km) : les relances se paient, gérer l'allure dans les montées.`;
    else text = `Profil exigeant (${Math.round(perKm)} m de D+ par km) : beaucoup de montées, prévoir de marcher dans les plus raides.`;
    const steep = v.climbs.filter(c => c.pct >= 10).length;
    if (steep) text += ` ${steep === 1 ? "Une montée dépasse" : steep + " montées dépassent"} 10 % de pente moyenne.`;
    if (!v.loop) text += v.loop_gap_km <= 3 ? ` L'arrivée est à ${v.loop_gap_km} km du départ (retour facile à pied).` : ` Tracé en ligne : l'arrivée est à ${v.loop_gap_km} km du départ, prévoir une navette.`;
    const climbs = v.climbs.slice().sort((a, b) => b.gain - a.gain).slice(0, 8).sort((a, b) => a.from_km - b.from_km);
    const list = climbs.length
      ? `<ul class="climbs">${climbs.map(c => `<li><span class="km">km ${c.from_km} → ${c.to_km}</span><span class="gain">+${c.gain} m</span><span class="detail">${c.len_m >= 1000 ? (c.len_m / 1000).toFixed(1) + " km" : c.len_m + " m"} · ${c.pct} %</span></li>`).join("")}</ul>`
      : `<p class="hint">Aucune montée notable (moins de 30 m de gain d'un coup).</p>`;
    return `<p>${text}</p><p class="hint">D+ ${v.dplus} m · D- ${v.dminus} m · altitude de ${v.alt_min} à ${v.alt_max} m (altimètre barométrique).</p>${list}`;
  }
  function terrainText(v) {
    const lines = [];
    if (v.max_grade >= 6) lines.push(`Pente maximale ${v.max_grade} % sur 100 m (au km ${v.max_grade_km})` + (v.steep_share ? `, ${v.steep_share} % du parcours à plus de 5 % de pente` : "") + ".");
    else lines.push(`Aucune pente forte : ${v.max_grade} % au maximum sur 100 m.`);
    if (v.longest_climb && v.longest_climb.len_m >= 400) lines.push(`Montée la plus longue : ${(v.longest_climb.len_m / 1000).toFixed(1)} km pour +${v.longest_climb.gain} m (km ${v.longest_climb.from_km}).`);
    if (v.biggest_climb && (!v.longest_climb || v.biggest_climb.from_km !== v.longest_climb.from_km)) lines.push(`Plus gros dénivelé d'un coup : +${v.biggest_climb.gain} m sur ${v.biggest_climb.len_m} m (km ${v.biggest_climb.from_km}, ${v.biggest_climb.pct} %).`);
    lines.push(`Durée indicative de ${v.moving} en sortie club (allure tranquille, pauses non comprises).`);
    return lines.map(l => `<p>${l}</p>`).join("");
  }
  function renderInfo(route, variantIndex) {
    const v = route.variants[variantIndex];
    const stat = (value, unit, label) => `<div class="stat"><div class="stat-value">${value}${unit ? `<small>${unit}</small>` : ""}</div><div class="stat-label">${label}</div></div>`;
    $("#info").innerHTML = `
      <div class="tags"><span class="type ${typeClass(route.type)}">${TYPE_LABEL[route.type]}</span>${visibleTags(route.tags).map(t => `<span class="tag">${t}</span>`).join("")}</div>
      <h1>${route.name}</h1>
      <p class="start">Départ : ${route.start}</p>
      <div class="actions">${actionButtons(route, v, false)}</div>
      ${route.variants.length > 1 ? `<div class="variants">${route.variants.map((x, i) => `<button type="button" class="chip${i === variantIndex ? " is-active" : ""}" data-variant="${i}">${x.label}</button>`).join("")}</div>` : ""}
      <div class="stats">
        ${stat(fmtKm(v.dist_km), "km", "Distance")}
        ${stat("+" + v.dplus, "m", "Dénivelé positif")}
        ${stat(v.moving, "", "Durée indicative")}
        ${stat("-" + v.dminus, "m", "Dénivelé négatif")}
        ${stat(v.alt_max, "m", "Altitude max")}
        ${stat(`<span class="pill level-${v.difficulty.level}">${v.difficulty.label}</span>`, "", `${v.difficulty.km_effort} km-effort`)}
      </div>
      <h2>Le parcours</h2>
      <p>${route.description}</p>
      ${route.chef ? `<h2 class="chef-title"><span class="chef-icon">${ICONS.chef}</span>L'avis du Chef</h2>
      <blockquote class="chef"><p>${route.chef}</p><footer>Fab, chef d'orchestre et bourreau bienveillant</footer></blockquote>` : ""}
      <h2>Profil</h2>
      <div id="profile" class="profile"></div>
      <p class="hint">Survolez le profil pour situer le point sur la carte.</p>
      <h2>Le D+ en détail</h2>
      ${elevationText(v)}
      <h2>Terrain</h2>
      ${terrainText(v)}
      <p class="credits">Fonds de carte © OpenStreetMap contributors · relief © OpenTopoMap (CC-BY-SA).</p>`;
    $$("#info [data-variant]").forEach(b => b.addEventListener("click", () => selectRoute(route.id, Number(b.dataset.variant))));
    bindActions($("#info"), route, v);
    renderProfile(v);
  }
  function renderTopbar(route, v) {
    $("#topbar-title").textContent = route ? `${route.name} · ${fmtKm(v.dist_km)} km · D+ ${v.dplus} m · ${v.moving}` : "";
  }
  function actionButtons(route, v, compact) {
    const label = text => compact ? "" : `<span class="label">${text}</span>`;
    return `
      <a class="btn btn-primary" href="${v.gpx}" download title="Télécharger la trace GPX">${ICONS.gpx}${label("GPX")}</a>
      <button type="button" class="btn" data-action="copy" title="Copier le lien">${ICONS.link}${label("Copier le lien")}</button>
      ${navigator.share ? `<button type="button" class="btn" data-action="share" title="Partager">${ICONS.share}${label("Partager")}</button>` : ""}`;
  }
  function bindActions(root, route, v) {
    const copy = $('[data-action="copy"]', root);
    if (copy) copy.addEventListener("click", () => copyToClipboard(routeUrl(route.id)));
    const share = $('[data-action="share"]', root);
    if (share) share.addEventListener("click", () => navigator.share({ title: route.name, text: `${route.name} · ${fmtKm(v.dist_km)} km · D+ ${v.dplus} m · ${v.moving}`, url: routeUrl(route.id) }).catch(() => {}));
  }
  function renderMapCard(route, v) {
    $("#map-card").innerHTML = `
      <div class="map-card-body"><div class="map-card-name">${route.name}</div><div class="map-card-meta">${fmtKm(v.dist_km)} km · D+ ${v.dplus} m · ${v.moving} · ${v.difficulty.label}</div></div>
      <div class="map-card-actions">${actionButtons(route, v, true)}<button type="button" class="btn" id="open-info" title="Infos du parcours">ⓘ</button></div>`;
    bindActions($("#map-card"), route, v);
    $("#open-info").addEventListener("click", () => setInfoOpen(true));
  }

  /* ---------- navigation ---------- */
  function selectRoute(id, variantIndex) {
    const route = ROUTE_BY_ID[id];
    state.routeId = route ? id : "";
    state.variantIndex = route ? variantIndex : 0;
    document.title = route ? `${route.name} · TCAP` : "TCAP · Parcours";
    renderList();
    if (route) {
      const v = route.variants[state.variantIndex];
      renderTopbar(route, v); renderInfo(route, state.variantIndex); renderMapCard(route, v);
      if (isMobile()) state.tab = "map"; else state.infoOpen = true;
      $("#map-hint").hidden = true;
      applyLayout();
      drawRoute(v);
      const selected = $("#route-list .is-selected"); if (selected) selected.scrollIntoView({ block: "nearest" });
    } else {
      renderTopbar(null); $("#info").innerHTML = "";
      clearRouteLayers(); restyleOverview();
      state.infoOpen = false;
      $("#map-hint").hidden = false;
      applyLayout();
      fitOverview();
      if (id) toast("Parcours introuvable : " + id);
    }
  }
  function openRoute(id) {
    history.pushState({ id }, "", buildQuery(id));
    selectRoute(id, 0);
  }

  /* ---------- événements ---------- */
  $("#toggle-list").addEventListener("click", () => setListOpen(!state.listOpen));
  $("#toggle-info").addEventListener("click", () => setInfoOpen(!state.infoOpen));
  $$("[data-close]").forEach(b => b.addEventListener("click", () => (b.dataset.close === "list" ? setListOpen(false) : setInfoOpen(false))));
  $("#backdrop").addEventListener("click", () => setInfoOpen(false));
  $$(".tab").forEach(t => t.addEventListener("click", () => setTab(t.dataset.tab)));
  $$(".segmented-btn").forEach(b => b.addEventListener("click", () => { setMode(b.dataset.mode); syncUrl(); }));
  $("#toggle-filters").addEventListener("click", () => {
    const open = !document.body.classList.contains("filters-open");
    document.body.classList.toggle("filters-open", open);
    $("#toggle-filters").setAttribute("aria-expanded", String(open));
  });
  for (const key of ["start", "type", "tag", "sort"]) $(`#filter-${key}`).addEventListener("change", e => { state[key] = e.target.value; onFilterChange(); });
  $("#reset-filters").addEventListener("click", resetFilters);
  $("#brand").addEventListener("click", e => { e.preventDefault(); openRoute(""); });
  window.addEventListener("popstate", () => selectRoute(idFromUrl(), 0));
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(applyLayout, 100); });

  /* ---------- démarrage ---------- */
  const initialId = idFromUrl();
  initMap();
  renderFilters();
  state.tab = initialId ? "map" : "list";
  selectRoute(initialId, 0);
})();
