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
  const ROUTE_BY_NUM = Object.fromEntries(ROUTES.map(r => [String(r.num), r]));
  const resolveId = x => ROUTE_BY_NUM[x] ? ROUTE_BY_NUM[x].id : x;   // accepte le numéro court ou le slug
  const TYPES = [
    ["trail", "Trail"], ["endurance", "Endurance"], ["fractionné", "Fractionné"],
    ["côtes", "Côtes"], ["seuil", "Seuil"], ["course", "Course"], ["ultra", "Ultra"],
  ];
  const TYPE_LABEL = Object.fromEntries(TYPES);
  const TAG_ORDER = ["GR34", "littoral", "intérieur", "mixte", "plat", "route", "court", "sortie longue", "départ déporté", "parcours de course", "en ligne", "Short Orange"];
  const HIDDEN_TAGS = new Set(["semaine", "séance", "Short Orange"]);
  const DIST_MAX = Math.max(10, Math.ceil(Math.max(...ROUTES.map(r => r.dist_km), 0) / 5) * 5);
  const DEFAULTS = { start: "keralaurent", type: "tous", tag: "tous", sort: "dist", dmin: 0, dmax: DIST_MAX };
  const FILTER_KEYS = ["start", "type", "tag", "sort", "dmin", "dmax"];
  // Les traceurs maison : une petite chèvre discrète à côté du titre
  const AUTHORS = { "Short Orange": { emoji: "🐐", title: "Tracé par Short Orange, the GOAT" } };
  const TRACK_COLOR = "#4f46e5";
  const SELECTION_COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#0f766e"];
  const VOTE_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "💪", "🎉", "👀"];   // les 6 premiers sont les réactions rapides de WhatsApp
  const ICONS = {
    gpx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 19h16"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c.6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.3-.2-.5-.3z"/></svg>',
    basket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h18v8H3z"/><path d="M7 12V5h10v7"/><path d="M10 8.5h4"/><path d="M6 12h12"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    chef: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 21h10"/><path d="M7 21v-6"/><path d="M17 21v-6"/><path d="M6 15h12"/><path d="M6 15V9.5a2.5 2.5 0 0 1-1-4.6A3 3 0 0 1 9.3 3a3.5 3.5 0 0 1 5.4 0 3 3 0 0 1 4.3 1.9 2.5 2.5 0 0 1-1 4.6V15"/></svg>',
  };

  /* ---------- état ---------- */
  const query = new URLSearchParams(location.search);
  const initialIds = idsFromUrl();
  const state = {
    start: query.get("start") || (initialIds.length ? "tous" : DEFAULTS.start),   // une sélection partagée ne doit pas être masquée par le filtre de départ
    type: query.get("type") || DEFAULTS.type,
    tag: query.get("tag") || DEFAULTS.tag,
    sort: query.get("sort") || DEFAULTS.sort,
    dmin: clampKm(query.get("dmin"), DEFAULTS.dmin),
    dmax: clampKm(query.get("dmax"), DEFAULTS.dmax),
    mode: query.get("mode") === "relief" ? "relief" : "classic",
    ids: initialIds,        // sélection partagée (?ids=3,12,27) : filtre de base, les autres filtres s'appliquent par-dessus
    routeId: "",
    variantIndex: 0,
    sheet: "peek",         // mobile : feuille inférieure "peek" (en-tête seul), "half" (moitié) ou "open" (dépliée)
  };
  const map = { instance: null, base: null, overview: null, overviewLines: {}, track: null, slope: null, extras: null, cursor: null };

  /* ---------- utilitaires ---------- */
  function clampKm(value, fallback) {
    const n = Number(value);
    return value === null || value === "" || !Number.isFinite(n) ? fallback : Math.max(0, Math.min(DIST_MAX, Math.round(n)));
  }
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];
  const isMobile = () => window.matchMedia("(max-width: 700px)").matches;
  const typeClass = type => "type-" + type.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const fmtKm = km => km.toLocaleString("fr-FR");
  const routeUrl = id => location.origin + location.pathname.replace(/index\.html$/, "") + "?id=" + id;
  const visibleTags = tags => tags.filter(t => !HIDDEN_TAGS.has(t));
  const authorOf = route => AUTHORS[route.author];
  const authorMark = route => authorOf(route) ? ` <span class="author-mark" title="${authorOf(route).title}" aria-label="${authorOf(route).title}">${authorOf(route).emoji}</span>` : "";

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
  async function copyToClipboard(text, message) {
    try { await navigator.clipboard.writeText(text); }
    catch (err) {
      const input = document.createElement("textarea");
      input.value = text; document.body.appendChild(input); input.select(); document.execCommand("copy"); input.remove();
    }
    toast(message || "Lien copié");
  }

  /* ---------- URL ---------- */
  function buildQuery(routeId) {
    const q = new URLSearchParams();
    for (const key of FILTER_KEYS) if (state[key] !== DEFAULTS[key]) q.set(key, state[key]);
    if (state.mode === "relief") q.set("mode", "relief");
    if (state.ids.length) q.set("ids", numsOf(trashOrder(state.ids)));
    if (routeId) q.set("id", routeId);
    const s = q.toString();
    return s ? "?" + s : location.pathname;
  }
  const syncUrl = () => history.replaceState({ id: state.routeId }, "", buildQuery(state.routeId));
  const idFromUrl = () => resolveId(new URLSearchParams(location.search).get("id") || location.hash.slice(1));
  function idsFromUrl() {
    const raw = new URLSearchParams(location.search).get("ids") || "";
    return [...new Set(raw.split(",").map(x => resolveId(x.trim())).filter(id => ROUTE_BY_ID[id]))];
  }
  const numsOf = ids => ids.map(id => ROUTE_BY_ID[id].num).join(",");
  const trashOrder = ids => ids.slice().sort((a, b) => ROUTE_BY_ID[b].difficulty.km_effort - ROUTE_BY_ID[a].difficulty.km_effort);
  const selectionMode = () => state.ids.length > 0;
  const publicMode = selectionMode;   // niveau public : la sélection reçue par lien, sans filtres ni panier
  const voteEmoji = id => selectionMode() ? `<span class="vote-emoji" aria-hidden="true">${VOTE_EMOJIS[selectionIndex(id)] || selectionIndex(id) + 1}</span>` : "";
  function applyMode() { document.body.classList.toggle("mode-vote", publicMode()); }
  const selectionIndex = id => trashOrder(state.ids).indexOf(id);
  const routesUrl = ids => location.origin + location.pathname.replace(/index\.html$/, "") + "?ids=" + numsOf(ids);

  /* ---------- disposition : panneaux, onglets, modale ---------- */
  const SHEET_STATES = ["peek", "half", "open"];
  function sheetVisibleHeight(state_) {
    const panel = $("#panel"), main = $(".main");
    const head = $(state.routeId ? "#detail-head" : "#list-view .panel-head");
    if (state_ === "open") return panel.offsetHeight;
    if (state_ === "half") return Math.round(main.offsetHeight * 0.45);
    return head.offsetHeight + 22;   // 22 px : poignée
  }
  function applySheet(animate) {
    const panel = $("#panel");
    if (!isMobile()) { panel.style.transform = ""; return; }
    panel.style.transition = animate === false ? "none" : "";
    panel.style.transform = `translateY(${panel.offsetHeight - sheetVisibleHeight(state.sheet)}px)`;
  }
  function applyLayout() {
    const hasRoute = !!state.routeId;
    $("#list-view").hidden = hasRoute;
    $("#detail-view").hidden = !hasRoute;
    $("#map-hint").hidden = hasRoute;
    applySheet(); updateExpandButtons();
    if (map.instance) { map.instance.invalidateSize(); setTimeout(() => { map.instance.invalidateSize(); if (!isMobile() || state.sheet !== "open") fitCurrent(); }, 320); }
  }
  function setSheet(mode) { state.sheet = mode; applyLayout(); }
  function updateExpandButtons() {
    const open = isMobile() && state.sheet === "open";
    $$("[data-expand]").forEach(b => { b.hidden = open; });
    $$("[data-collapse]").forEach(b => { b.hidden = !open; });
  }
  function setInfoOpen(open) { setSheet(open ? "open" : "half"); }

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
    renderRange();
  }
  function renderRange() {
    const min = $("#range-min"), max = $("#range-max");
    min.max = max.max = DIST_MAX;
    min.value = state.dmin; max.value = state.dmax;
    const pct = v => (v / DIST_MAX) * 100;
    $("#range-fill").style.left = pct(state.dmin) + "%";
    $("#range-fill").style.right = (100 - pct(state.dmax)) + "%";
    $("#range-value").textContent = state.dmin === DEFAULTS.dmin && state.dmax === DEFAULTS.dmax ? "toutes" : `${state.dmin} – ${state.dmax} km`;
  }
  function onRangeInput(which, value) {
    const v = clampKm(value, DEFAULTS[which]);
    if (which === "dmin") state.dmin = Math.min(v, state.dmax);
    else state.dmax = Math.max(v, state.dmin);
    renderRange();
    onFilterChange();
  }
  function filteredRoutes() {
    const base = selectionMode() ? state.ids.map(id => ROUTE_BY_ID[id]) : ROUTES;
    const comparators = {
      dist: (a, b) => a.dist_km - b.dist_km,
      dplus: (a, b) => b.dplus - a.dplus,
      time: (a, b) => a.variants[0].moving_s - b.variants[0].moving_s,
      diff: (a, b) => b.difficulty.km_effort - a.difficulty.km_effort,
      name: (a, b) => a.name.localeCompare(b.name, "fr"),
    };
    return base
      .filter(r => (state.start === "tous" || r.start_group === state.start)
        && (state.type === "tous" || r.type === state.type)
        && (state.tag === "tous" || r.tags.includes(state.tag))
        && r.dist_km >= state.dmin - 0.5 && r.dist_km <= state.dmax + 0.5)
      .sort(comparators[state.sort] || comparators.dist);
  }
  function renderList() {
    const routes = filteredRoutes();
    const selection = selectionMode();
    $("#route-list").innerHTML = routes.map(r => `
      <li class="${r.id === state.routeId ? "is-selected" : ""}${inBasket(r.id) ? " in-basket" : ""}" data-id="${r.id}">
        ${selection ? "" : `<button type="button" class="check admin-only${inBasket(r.id) ? " is-on" : ""}" data-select="${r.id}" role="checkbox" aria-checked="${inBasket(r.id)}" aria-label="Sélectionner pour le sondage"></button>`}
        <button type="button" class="row">
        <div class="name">${voteEmoji(r.id)}${r.name}</div>
        <div class="meta">
          <span>${fmtKm(r.dist_km)} km</span><span>D+ ${r.dplus} m</span><span>${r.moving}</span><span class="level-text">${r.difficulty.label}</span>
        </div>
      </button></li>`).join("") || `<li class="empty">Aucun parcours avec ces filtres.</li>`;
    $$("#route-list li[data-id] .row").forEach(b => b.addEventListener("click", () => openRoute(b.parentElement.dataset.id)));
    $$("#route-list [data-select]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); toggleBasket(b.dataset.select); }));

    const label = selection ? `Vote : ${routes.length} parcours, réagis sur WhatsApp` : `${routes.length} parcours`;
    $("#count-desktop").textContent = label;
    $("#count-mobile").textContent = label;
    const activeFilters = ["start", "type", "tag"].filter(k => state[k] !== DEFAULTS[k]).length + (state.dmin !== DEFAULTS.dmin || state.dmax !== DEFAULTS.dmax ? 1 : 0) + (selection ? 1 : 0);
    $("#filters-badge").hidden = !activeFilters;
    $("#filters-badge").textContent = activeFilters;

    // la carte ne montre que les tracés filtrés
    const visible = new Set(routes.map(r => r.id));
    Object.entries(map.overviewLines).forEach(([id, line]) => {
      if (visible.has(id) && !map.overview.hasLayer(line)) map.overview.addLayer(line);
      if (!visible.has(id) && map.overview.hasLayer(line)) map.overview.removeLayer(line);
    });
    restyleOverview();
  }
  function setSelection(ids) {
    state.ids = ids.filter(id => ROUTE_BY_ID[id]);
    if (state.ids.length) Object.assign(state, DEFAULTS, { start: "tous" });   // aucun filtre ne doit cacher un parcours de la sélection
    renderFilters(); renderList();
    syncUrl();
    if (!state.routeId) fitOverview();
  }
  function onFilterChange() { renderList(); syncUrl(); if (!state.routeId) fitOverview(); }
  function resetFilters() { Object.assign(state, DEFAULTS); state.ids = []; renderFilters(); onFilterChange(); }

  /* ---------- carte ---------- */
  const osmLayer = () => L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" });
  const topoLayer = () => L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: "© OpenStreetMap contributors, SRTM · © OpenTopoMap (CC-BY-SA)" });
  function overviewStyle(id) {
    if (selectionMode() && state.ids.includes(id)) {
      const color = SELECTION_COLORS[selectionIndex(id) % SELECTION_COLORS.length];
      return state.routeId && state.routeId !== id ? { color, weight: 3, opacity: .5 } : { color, weight: 4, opacity: .9 };
    }
    if (!selectionMode() && inBasket(id)) {   // parcours cochés : en vert du club pour les repérer
      return state.routeId && state.routeId !== id ? { color: "#16a34a", weight: 3, opacity: .6 } : { color: "#16a34a", weight: 4, opacity: .9 };
    }
    return state.routeId ? { color: "#94a3b8", weight: 2, opacity: .45 } : { color: "#64748b", weight: 3, opacity: .6 };
  }

  function initMap() {
    map.instance = L.map("map").setView([48.36, -4.66], 12);
    map.overview = L.layerGroup().addTo(map.instance);
    ROUTES.forEach(r => {
      const line = L.polyline(r.variants[0].track.map(p => [p[0], p[1]]), overviewStyle(r.id));
      line.bindTooltip(`${r.name} · ${fmtKm(r.dist_km)} km · D+ ${r.dplus} m`, { sticky: true });
      line.on("click", () => openRoute(r.id));
      line.on("mouseover", () => line.setStyle({ color: TRACK_COLOR, weight: 5, opacity: 1 }));
      line.on("mouseout", () => line.setStyle(overviewStyle(r.id)));
      map.overviewLines[r.id] = line;
      map.overview.addLayer(line);
    });
    setMode(state.mode);
  }
  function restyleOverview() { Object.entries(map.overviewLines).forEach(([id, l]) => l.setStyle(overviewStyle(id))); }

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
    if (isMobile()) return { paddingTopLeft: [20, 64], paddingBottomRight: [20, sheetVisibleHeight(state.sheet) + 16] };
    return { paddingTopLeft: [24, 24], paddingBottomRight: [24, 24] };   // la carte a déjà la largeur libre entre les panneaux
  }
  const HOME = L.latLng(48.370, -4.640);   // Keralaurent, point de rendez-vous du club
  function fitOverview() {
    if (selectionMode()) {   // lien ?ids= : cadrer la sélection
      const bounds = L.latLngBounds();
      Object.values(map.overviewLines).forEach(l => { if (map.overview.hasLayer(l)) bounds.extend(l.getBounds()); });
      if (bounds.isValid()) { map.instance.fitBounds(bounds, { ...fitPadding(), animate: false }); return; }
    }
    map.instance.fitBounds(HOME.toBounds(7000), { ...fitPadding(), animate: false });   // vue par défaut : 7 km autour de Keralaurent
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
    const source = v.source === "gpx"
      ? "altitudes du modèle de terrain, tracé dessiné et non enregistré : une montre GPS annoncera sans doute 20 à 30 % de D+ en plus"
      : "altimètre barométrique";
    return `<p>${text}</p><p class="hint">D+ ${v.dplus} m · D- ${v.dminus} m · altitude de ${v.alt_min} à ${v.alt_max} m (${source}).</p>${list}`;
  }
  function terrainText(v) {
    const lines = [];
    if (v.max_grade >= 6) lines.push(`Pente maximale ${v.max_grade} % sur 100 m (au km ${v.max_grade_km})` + (v.steep_share ? `, ${v.steep_share} % du parcours à plus de 5 % de pente` : "") + ".");
    else lines.push(`Aucune pente forte : ${v.max_grade} % au maximum sur 100 m.`);
    if (v.longest_climb && v.longest_climb.len_m >= 400) lines.push(`Montée la plus longue : ${(v.longest_climb.len_m / 1000).toFixed(1)} km pour +${v.longest_climb.gain} m (km ${v.longest_climb.from_km}).`);
    if (v.biggest_climb && (!v.longest_climb || v.biggest_climb.from_km !== v.longest_climb.from_km)) lines.push(`Plus gros dénivelé d'un coup : +${v.biggest_climb.gain} m sur ${v.biggest_climb.len_m} m (km ${v.biggest_climb.from_km}, ${v.biggest_climb.pct} %).`);
    lines.push(v.estimated
      ? `Durée estimée à ${v.moving} : tracé jamais chronométré en groupe, calcul à l'allure club habituelle (pauses et ravitos non compris${v.dist_km >= 40 ? ", et sur cette distance la marge est large" : ""}).`
      : `Durée indicative de ${v.moving} en sortie club (allure tranquille, pauses non comprises).`);
    return lines.map(l => `<p>${l}</p>`).join("");
  }
  function renderInfo(route, variantIndex) {
    const v = route.variants[variantIndex];
    const stat = (value, unit, label) => `<div class="stat"><div class="stat-value">${value}${unit ? `<small>${unit}</small>` : ""}</div><div class="stat-label">${label}</div></div>`;
    $("#detail-head").innerHTML = `
      <div class="head-row"><button type="button" class="back" id="back-to-list">← Tous les parcours</button><button type="button" class="close mobile-only" data-collapse aria-label="Fermer la fiche">×</button></div>
      <h1>${voteEmoji(route.id)}${route.name}${authorMark(route)}</h1>
      <p class="meta">${fmtKm(v.dist_km)} km · D+ ${v.dplus} m · ${v.moving} · ${v.difficulty.label}</p>
      <div class="actions"><button type="button" class="btn btn-primary mobile-only" data-expand data-label="Infos">${ICONS.info}<span class="label">Infos</span></button>${actionButtons(route, v, true)}</div>`;
    $("#back-to-list").addEventListener("click", () => openRoute(""));
    bindActions($("#detail-head"), route, v);
    $("#info").innerHTML = `
      <div class="tags"><span class="type ${typeClass(route.type)}">${TYPE_LABEL[route.type]}</span>${visibleTags(route.tags).map(t => `<span class="tag">${t}</span>`).join("")}</div>
      <p class="start">Départ : ${route.start}</p>
      ${route.variants.length > 1 ? `<div class="variants">${route.variants.map((x, i) => `<button type="button" class="chip${i === variantIndex ? " is-active" : ""}" data-variant="${i}">${x.label}</button>`).join("")}</div>` : ""}
      <div class="stats">
        ${stat(fmtKm(v.dist_km), "km", "Distance")}
        ${stat("+" + v.dplus, "m", "Dénivelé positif")}
        ${stat((v.estimated ? "≈ " : "") + v.moving, "", v.estimated ? "Durée estimée" : "Durée indicative")}
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
    renderProfile(v);
  }
  function actionButtons(route, v, withShare) {
    const btn = (attrs, icon, text) => `<${attrs} title="${text}" aria-label="${text}">${icon}<span class="label">${text.split(" ")[0]}</span></${attrs.split(" ")[0]}>`;
    const inVote = inBasket(route.id);
    return `
      ${btn(`a class="btn btn-primary" href="${v.gpx}" download`, ICONS.gpx, "GPX")}
      ${btn(`button type="button" class="btn" data-action="copy"`, ICONS.link, "Lien à copier")}
      ${publicMode() ? "" : btn(`button type="button" class="btn admin-only${inVote ? " is-active" : ""}" data-action="basket"`, inVote ? ICONS.minus : ICONS.plus, inVote ? "Retirer de la sélection" : "Ajouter à la sélection")}
      ${withShare && navigator.share ? btn(`button type="button" class="btn" data-action="share"`, ICONS.share, "Partager") : ""}`;
  }
  function bindActions(root, route, v) {
    const on = (selector, handler) => { const el = $(selector, root); if (el) el.addEventListener("click", handler); };
    on('[data-action="copy"]', () => copyToClipboard(routeUrl(route.id)));
    on('[data-action="share"]', () => navigator.share({ title: route.name, text: `${route.name} · ${fmtKm(v.dist_km)} km · D+ ${v.dplus} m · ${v.moving}`, url: routeUrl(route.id) }).catch(() => {}));
    on('[data-action="basket"]', () => toggleBasket(route.id));
  }
  /* ---------- sélection pour le vote WhatsApp ---------- */
  const BASKET_KEY = "tcap-vote";
  const DEFAULT_TITLE = "Sortie de la semaine : votez !";
  const basket = { ids: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(BASKET_KEY) || "{}");
    basket.ids = (saved.ids || []).filter(id => ROUTE_BY_ID[id]);
  } catch (err) { /* stockage indisponible : la sélection ne survit pas au rechargement */ }
  const inBasket = id => basket.ids.includes(id);
  const basketSorted = () => trashOrder(basket.ids);   // toujours du plus trash au moins trash
  function saveBasket() { try { localStorage.setItem(BASKET_KEY, JSON.stringify({ ids: basket.ids })); } catch (err) { /* ignoré */ } }
  function toggleBasket(id) {
    if (inBasket(id)) { basket.ids = basket.ids.filter(x => x !== id); toast("Retiré de la sélection"); }
    else { basket.ids.push(id); toast(`Ajouté à la sélection (${basket.ids.length})`); }
    onBasketChange();
  }
  function onBasketChange() {
    saveBasket();
    const n = basket.ids.length;
    $("#share-selection").disabled = !n;
    $("#share-selection-count").textContent = n ? ` (${n})` : "";
    $("#clear-selection").hidden = !n;
    if (state.routeId) {   // le bouton Ajouter / Retirer de la fiche
      const route = ROUTE_BY_ID[state.routeId], v = route.variants[state.variantIndex];
      const el = $("#detail-head .actions"); el.innerHTML = `<button type="button" class="btn btn-primary mobile-only" data-expand data-label="Infos">${ICONS.info}<span class="label">Infos</span></button>` + actionButtons(route, v, true); bindActions(el, route, v); updateExpandButtons();
    }
    renderList();
    if (map.instance) restyleOverview();
  }
  function voteMessage() {
    const ids = basketSorted();
    const lines = [`🏃 ${DEFAULT_TITLE}`, ""];
    ids.forEach((id, i) => {
      const r = ROUTE_BY_ID[id];
      lines.push(`${VOTE_EMOJIS[i] || (i + 1) + "."} ${r.name}`, `${fmtKm(r.dist_km)} km, D+ ${r.dplus} m, ${TYPE_LABEL[r.type]}`, "");
    });
    lines.push(`Les tracés sur la carte : ${routesUrl(ids)}`, "");
    lines.push("Vote en réagissant à ce message avec l'emoji du parcours choisi (une seule réaction par personne).");
    return lines.join("\n");
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
      renderInfo(route, state.variantIndex);
      if (isMobile() && state.sheet !== "open") state.sheet = "half";   // mobile : la fiche s'ouvre à moitié, la carte reste visible
      applyLayout();
      drawRoute(v);
      const selected = $("#route-list .is-selected"); if (selected) selected.scrollIntoView({ block: "nearest" });
    } else {
      $("#info").innerHTML = ""; $("#detail-head").innerHTML = "";
      clearRouteLayers(); restyleOverview();
      applyLayout();
      fitOverview();
      if (id) toast("Parcours introuvable : " + id);
    }
  }
  function openRoute(id) {
    history.pushState({ id }, "", buildQuery(id));
    selectRoute(id, 0);
    if (isMobile()) setSheet("half");
  }

  /* ---------- événements ---------- */
  // mobile : toucher la poignée ou l'en-tête bascule entre moitié et dépliée ; glisser choisit la position
  const toggleSheet = () => { if (isMobile()) setSheet(state.sheet === "open" ? "half" : "open"); };
  const drag = { active: false, startY: 0, startOffset: 0, moved: false };
  function dragStart(y) {
    if (!isMobile()) return;
    const panel = $("#panel");
    drag.active = true; drag.moved = false; drag.startY = y;
    drag.startOffset = panel.offsetHeight - sheetVisibleHeight(state.sheet);
  }
  function dragMove(y) {
    if (!drag.active) return;
    const panel = $("#panel"), dy = y - drag.startY;
    if (Math.abs(dy) > 6) drag.moved = true;
    const offset = Math.max(0, Math.min(panel.offsetHeight - sheetVisibleHeight("peek"), drag.startOffset + dy));
    panel.style.transition = "none"; panel.style.transform = `translateY(${offset}px)`;
  }
  function dragEnd(y) {
    if (!drag.active) return;
    drag.active = false;
    if (!drag.moved) return;   // simple toucher : géré par le clic
    const panel = $("#panel"), visible = panel.offsetHeight - Math.max(0, drag.startOffset + (y - drag.startY));
    const best = SHEET_STATES.reduce((a, b) => Math.abs(sheetVisibleHeight(b) - visible) < Math.abs(sheetVisibleHeight(a) - visible) ? b : a);
    setSheet(best);
  }
  document.addEventListener("click", e => {
    if (e.target.closest("[data-expand]")) { e.stopPropagation(); setSheet("open"); }
    else if (e.target.closest("[data-collapse]")) { e.stopPropagation(); setSheet("half"); }
  }, true);
  $$("#sheet-handle, .panel-head").forEach(el => {
    el.addEventListener("touchstart", e => dragStart(e.touches[0].clientY), { passive: true });
    el.addEventListener("touchmove", e => { dragMove(e.touches[0].clientY); if (drag.moved) e.preventDefault(); }, { passive: false });
    el.addEventListener("touchend", e => dragEnd(e.changedTouches[0].clientY));
    el.addEventListener("click", e => { if (drag.moved) { drag.moved = false; return; } if (!e.target.closest("button, a, select, input")) toggleSheet(); });
  });
  // Partager : feuille de partage native (WhatsApp, etc.) ; sinon copie du message
  $("#share-selection").addEventListener("click", async () => {
    const text = voteMessage();
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (err) { if (err.name === "AbortError") return; }
    }
    copyToClipboard(text, "Message copié, colle-le dans WhatsApp");
  });
  $("#clear-selection").addEventListener("click", () => { basket.ids = []; onBasketChange(); toast("Sélection vidée"); });
  $$(".segmented-btn").forEach(b => b.addEventListener("click", () => { setMode(b.dataset.mode); syncUrl(); }));
  $("#toggle-filters").addEventListener("click", () => {
    const open = !document.body.classList.contains("filters-open");
    document.body.classList.toggle("filters-open", open);
    $("#toggle-filters").setAttribute("aria-expanded", String(open));
    if (open) setSheet("open");
  });
  for (const key of ["start", "type", "tag", "sort"]) $(`#filter-${key}`).addEventListener("change", e => { state[key] = e.target.value; onFilterChange(); });
  $("#range-min").addEventListener("input", e => onRangeInput("dmin", e.target.value));
  $("#range-max").addEventListener("input", e => onRangeInput("dmax", e.target.value));
  $("#reset-filters").addEventListener("click", resetFilters);
  $("#brand").addEventListener("click", e => { e.preventDefault(); openRoute(""); });
  window.addEventListener("popstate", () => { state.ids = idsFromUrl(); applyMode(); renderList(); selectRoute(idFromUrl(), 0); });
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { $("#panel").style.transition = "none"; applyLayout(); }, 100); });

  /* ---------- démarrage ---------- */
  const initialId = idFromUrl();
  initMap();
  renderFilters();
  onBasketChange();
  applyMode();
  state.sheet = query.get("sheet") === "open" ? "open" : "half";   // mobile : feuille à mi-hauteur par défaut (dépliée seulement avec &sheet=open)
  document.body.classList.add("no-anim");   // pas de glissement des panneaux au chargement
  selectRoute(initialId, 0);
  setTimeout(() => document.body.classList.remove("no-anim"), 400);
})();
