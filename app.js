const STORAGE_KEY = "control-puestos-secure-v1";
const ACCOUNTS_KEY = "control-puestos-accounts-v1";
const LEGACY_STORAGE_KEY = "control-puestos-v1";
const PBKDF2_ITERATIONS = 250000;

const tabs = [
  "Resumen",
  "Eventos",
  "Contratos",
  "Otrosi",
  "Supervision",
  "Informes",
  "Novedades",
  "Investigacion",
  "Seguridad",
  "Instalaciones",
];

const docTabs = {
  Contratos: "contrato",
  Otrosi: "otrosi",
  Supervision: "supervision",
  Informes: "informe_reaccion",
  Novedades: "novedad",
  Investigacion: "investigacion",
  Seguridad: "estudio_seguridad",
  Instalaciones: "estado_instalaciones",
};

const riskConfig = {
  normal: { label: "Normal", color: "#29b35a" },
  bajo: { label: "Bajo", color: "#ffb020" },
  medio: { label: "Medio", color: "#ff7a21" },
  alto: { label: "Alto", color: "#ef3340" },
  critico: { label: "Critico", color: "#a40018" },
};

let state = { activeMapId: null, maps: [] };
let activeMapId = null;
let selectedPointId = null;
let activeTab = "Resumen";
let leafletMap;
let markers = new Map();
let cryptoKey = null;
let vaultSalt = null;
let activeAccountId = null;
let authMode = "login";
let pendingSave = Promise.resolve();
let deferredInstallPrompt = null;
let coordinatePreviewMarker = null;

const el = {
  authScreen: document.querySelector("#authScreen"),
  authTitle: document.querySelector("#authTitle"),
  authProfile: document.querySelector("#authProfile"),
  authAccountSelect: document.querySelector("#authAccountSelect"),
  authAccountName: document.querySelector("#authAccountName"),
  authAccountPhoto: document.querySelector("#authAccountPhoto"),
  authIntro: document.querySelector("#authIntro"),
  authPassword: document.querySelector("#authPassword"),
  authPasswordConfirm: document.querySelector("#authPasswordConfirm"),
  authSubmit: document.querySelector("#authSubmit"),
  authNewAccount: document.querySelector("#authNewAccount"),
  authBackupFile: document.querySelector("#authBackupFile"),
  authImportBackup: document.querySelector("#authImportBackup"),
  authMessage: document.querySelector("#authMessage"),
  profileNameLabel: document.querySelector("#profileNameLabel"),
  profileAvatar: document.querySelector("#profileAvatar"),
  securityBtn: document.querySelector("#securityBtn"),
  lockBtn: document.querySelector("#lockBtn"),
  mapSelect: document.querySelector("#mapSelect"),
  newMapBtn: document.querySelector("#newMapBtn"),
  editMapBtn: document.querySelector("#editMapBtn"),
  deleteMapQuickBtn: document.querySelector("#deleteMapQuickBtn"),
  coordinateInput: document.querySelector("#coordinateInput"),
  coordinateStatus: document.querySelector("#coordinateStatus"),
  locateCoordinateBtn: document.querySelector("#locateCoordinateBtn"),
  excelInput: document.querySelector("#excelInput"),
  sheetMode: document.querySelector("#sheetMode"),
  importBtn: document.querySelector("#importBtn"),
  clearMapBtn: document.querySelector("#clearMapBtn"),
  importStatus: document.querySelector("#importStatus"),
  searchInput: document.querySelector("#searchInput"),
  zoneFilter: document.querySelector("#zoneFilter"),
  communeFilter: document.querySelector("#communeFilter"),
  riskFilter: document.querySelector("#riskFilter"),
  clearFiltersBtn: document.querySelector("#clearFiltersBtn"),
  fullListBtn: document.querySelector("#fullListBtn"),
  totalPoints: document.querySelector("#totalPoints"),
  redPoints: document.querySelector("#redPoints"),
  eventCount: document.querySelector("#eventCount"),
  visibleCount: document.querySelector("#visibleCount"),
  pointList: document.querySelector("#pointList"),
  addPointBtn: document.querySelector("#addPointBtn"),
  fitBtn: document.querySelector("#fitBtn"),
  installAppBtn: document.querySelector("#installAppBtn"),
  drawer: document.querySelector("#detailDrawer"),
  detailTitle: document.querySelector("#detailTitle"),
  detailSubtitle: document.querySelector("#detailSubtitle"),
  closeDrawerBtn: document.querySelector("#closeDrawerBtn"),
  tabs: document.querySelector("#tabs"),
  tabContent: document.querySelector("#tabContent"),
  modal: document.querySelector("#modal"),
  modalTitle: document.querySelector("#modalTitle"),
  modalBody: document.querySelector("#modalBody"),
  modalCancel: document.querySelector("#modalCancel"),
  modalConfirm: document.querySelector("#modalConfirm"),
};

init();

function init() {
  registerPwa();
  bindAuthEvents();
  renderAuthScreen();
}

function bindAuthEvents() {
  el.authSubmit.addEventListener("click", handleAuthSubmit);
  el.authNewAccount.addEventListener("click", () => {
    authMode = authMode === "create" ? "login" : "create";
    renderAuthScreen();
  });
  el.authAccountSelect.addEventListener("change", () => {
    activeAccountId = el.authAccountSelect.value;
    setActiveAccountId(activeAccountId);
    renderAuthScreen();
  });
  el.authImportBackup.addEventListener("click", importEncryptedBackupFromAuth);
  [el.authPassword, el.authPasswordConfirm, el.authAccountName].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") handleAuthSubmit();
    });
  });
}

function renderAuthScreen() {
  const vault = getVault();
  const accounts = getAccountsStore();
  const hasAccounts = accounts.accounts.length > 0;
  const selectedAccount = getSelectedAccount();
  if (!vault && !hasAccounts) authMode = "create";
  el.authScreen.classList.remove("hidden");
  el.authPassword.value = "";
  el.authPasswordConfirm.value = "";
  el.authAccountName.value = "";
  el.authAccountPhoto.value = "";
  el.authMessage.textContent = "";

  el.authAccountSelect.style.display = hasAccounts && authMode === "login" ? "block" : "none";
  el.authAccountName.style.display = authMode === "create" ? "block" : "none";
  el.authAccountPhoto.style.display = authMode === "create" ? "block" : "none";
  el.authPasswordConfirm.style.display = authMode === "create" ? "block" : "none";
  el.authNewAccount.style.display = hasAccounts ? "block" : "none";
  el.authBackupFile.style.display = "block";
  el.authImportBackup.style.display = "block";
  el.authNewAccount.textContent = authMode === "create" ? "Usar cuenta existente" : "Crear otra cuenta";

  if (hasAccounts) {
    el.authAccountSelect.innerHTML = accounts.accounts
      .map((account) => `<option value="${account.id}" ${account.id === activeAccountId ? "selected" : ""}>${escapeHtml(account.name || "Cuenta")}</option>`)
      .join("");
  }

  if (authMode === "login" && selectedAccount) {
    el.authTitle.textContent = selectedAccount.name || "Cuenta segura";
    el.authIntro.textContent = "Ingresa tu clave para desbloquear esta cuenta.";
    renderAuthAvatar(selectedAccount.photo, selectedAccount.name);
    el.authSubmit.textContent = "Desbloquear";
  } else if (vault && !hasAccounts) {
    el.authTitle.textContent = "Acceso seguro";
    el.authIntro.textContent = "Ingresa tu clave para desbloquear la informacion cifrada.";
    renderAuthAvatar("", "CP");
    el.authPasswordConfirm.style.display = "none";
    el.authSubmit.textContent = "Desbloquear";
  } else {
    el.authTitle.textContent = "Nueva cuenta";
    el.authIntro.textContent = "Crea un perfil local cifrado con su propia clave.";
    renderAuthAvatar("", "CP");
    el.authSubmit.textContent = "Crear cuenta segura";
  }
  setTimeout(() => el.authPassword.focus(), 50);
}

function renderAuthAvatar(photo, name) {
  const avatar = document.querySelector(".auth-avatar");
  if (!avatar) return;
  avatar.innerHTML = photo
    ? `<img src="${photo}" alt="${escapeAttr(name || "Cuenta")}">`
    : escapeHtml((name || "CP").slice(0, 2).toUpperCase());
}

async function handleAuthSubmit() {
  const vault = getVault();
  const password = el.authPassword.value;
  const confirmPassword = el.authPasswordConfirm.value;
  if (password.length < 8) {
    el.authMessage.textContent = "Usa minimo 8 caracteres.";
    return;
  }

  el.authSubmit.disabled = true;
  el.authSubmit.textContent = authMode === "login" && vault ? "Desbloqueando..." : "Creando...";
  try {
    if (authMode === "login" && vault) {
      await unlockVault(password, vault);
    } else {
      if (password !== confirmPassword) {
        el.authMessage.textContent = "Las claves no coinciden.";
        return;
      }
      await createVault(password);
      authMode = "login";
    }
    el.authScreen.classList.add("hidden");
    el.authPassword.value = "";
    el.authPasswordConfirm.value = "";
    startApp();
  } catch (error) {
    el.authMessage.textContent = "Clave incorrecta o datos cifrados no disponibles.";
  } finally {
    el.authSubmit.disabled = false;
    renderAuthScreenButton();
  }
}

function renderAuthScreenButton() {
  el.authSubmit.textContent = authMode === "login" && getVault() ? "Desbloquear" : "Crear cuenta segura";
}

function startApp() {
  if (!state.maps.length) {
    const map = createMap("Pitalito", [1.8539, -76.0505], 13);
    state.maps.push(map);
    activeMapId = map.id;
    state.activeMapId = map.id;
    saveState();
  }
  if (!activeMapId && state.maps.length) {
    activeMapId = state.maps[0].id;
    state.activeMapId = activeMapId;
    saveState();
  }
  state.profile = state.profile || { name: "", photo: "" };

  if (!leafletMap) {
    initMap();
    bindEvents();
  } else {
    leafletMap.setView(getActiveMap().center, getActiveMap().zoom);
  }
  render();
  renderProfile();
}

function initMap() {
  const active = getActiveMap();
  leafletMap = L.map("map", { zoomControl: true }).setView(active.center, active.zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(leafletMap);
}

function bindEvents() {
  el.securityBtn.addEventListener("click", openSecurityModal);
  el.lockBtn.addEventListener("click", lockApp);
  el.mapSelect.addEventListener("change", () => {
    activeMapId = el.mapSelect.value;
    state.activeMapId = activeMapId;
    selectedPointId = null;
    const active = getActiveMap();
    leafletMap.setView(active.center, active.zoom);
    saveState();
    closeDrawer();
    render();
  });

  el.newMapBtn.addEventListener("click", openMapModal);
  el.editMapBtn.addEventListener("click", openEditMapModal);
  el.deleteMapQuickBtn.addEventListener("click", deleteActiveMap);
  el.locateCoordinateBtn.addEventListener("click", locateCoordinateFromSidebar);
  el.coordinateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") locateCoordinateFromSidebar();
  });
  el.importBtn.addEventListener("click", importExcel);
  el.clearMapBtn.addEventListener("click", clearActiveMapPoints);
  el.searchInput.addEventListener("input", render);
  el.zoneFilter.addEventListener("change", render);
  el.communeFilter.addEventListener("change", render);
  el.riskFilter.addEventListener("change", render);
  el.clearFiltersBtn.addEventListener("click", () => {
    el.searchInput.value = "";
    el.zoneFilter.value = "";
    el.communeFilter.value = "";
    el.riskFilter.value = "";
    render();
  });
  el.fullListBtn.addEventListener("click", openFullListModal);
  el.addPointBtn.addEventListener("click", openPointModal);
  el.fitBtn.addEventListener("click", fitVisiblePoints);
  el.installAppBtn.addEventListener("click", installApp);
  el.closeDrawerBtn.addEventListener("click", closeDrawer);
  el.modalCancel.addEventListener("click", closeModal);
}

function registerPwa() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(console.warn);
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    el.installAppBtn?.classList.remove("hidden");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    el.installAppBtn?.classList.add("hidden");
  });
}

async function installApp() {
  if (!deferredInstallPrompt) {
    alert("Si tu navegador lo permite, usa el menu de Chrome/Edge y elige Instalar app.");
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  el.installAppBtn.classList.add("hidden");
}

function render() {
  renderMapOptions();
  renderZoneOptions();
  renderCommuneOptions();
  renderPoints();
  renderStats();
  if (selectedPointId) renderDrawer();
}

function renderMapOptions() {
  el.mapSelect.innerHTML = state.maps
    .map((map) => `<option value="${map.id}" ${map.id === activeMapId ? "selected" : ""}>${escapeHtml(map.name)}</option>`)
    .join("");
}

function renderZoneOptions() {
  const current = el.zoneFilter.value;
  const zones = [...new Set(getActivePoints().map((p) => p.zone).filter(Boolean))].sort();
  el.zoneFilter.innerHTML = `<option value="">Todas las zonas</option>${zones
    .map((zone) => `<option value="${escapeHtml(zone)}">${escapeHtml(zone)}</option>`)
    .join("")}`;
  el.zoneFilter.value = zones.includes(current) ? current : "";
}

function renderCommuneOptions() {
  const current = el.communeFilter.value;
  const communes = [...new Set(getActivePoints().map((p) => p.commune).filter(Boolean))].sort();
  el.communeFilter.innerHTML = `<option value="">Todas las comunas</option>${communes
    .map((commune) => `<option value="${escapeHtml(commune)}">${escapeHtml(commune)}</option>`)
    .join("")}`;
  el.communeFilter.value = communes.includes(current) ? current : "";
}

function renderPoints() {
  const points = getFilteredPoints();
  markers.forEach((marker) => marker.remove());
  markers.clear();

  points.forEach((point) => {
    const risk = getRisk(point);
    const alarm = ["alto", "critico"].includes(risk)
      ? `<div class="marker-siren" aria-hidden="true"><span></span></div>`
      : "";
    const icon = L.divIcon({
      className: "risk-marker",
      html: `
        <div class="marker-wrap ${risk}">
          ${alarm}
          <div class="marker-pulse" style="--risk-color:${riskConfig[risk].color}"></div>
          <div class="marker-house" style="--pin-color:${riskConfig[risk].color}">
            <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="22" cy="22" r="21" fill="var(--pin-color)"/>
              <circle cx="22" cy="22" r="21" stroke="white" stroke-width="2"/>
              <rect x="28" y="11" width="5" height="10" fill="white"/>
              <polygon points="22,8 38,24 6,24" fill="white"/>
              <rect x="9" y="23" width="26" height="15" fill="white"/>
              <rect x="18" y="30" width="8" height="8" fill="var(--pin-color)"/>
            </svg>
            <span>${point.events.length}</span>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
    const marker = L.marker([point.lat, point.lng], { icon })
      .addTo(leafletMap)
      .bindPopup(renderMarkerPopup(point, risk), {
        className: "thought-popup",
        closeButton: false,
        offset: [0, -14],
      });
    marker.on("popupopen", () => {
      const openButton = document.querySelector(`[data-open-point="${point.id}"]`);
      const shareButton = document.querySelector(`[data-share-point="${point.id}"]`);
      if (openButton) openButton.addEventListener("click", () => openPoint(point.id));
      if (shareButton) shareButton.addEventListener("click", () => sharePointByWhatsApp(point));
    });
    markers.set(point.id, marker);
  });

  el.visibleCount.textContent = `${points.length} visibles`;
  el.pointList.innerHTML = points.length
    ? points.map(renderPointItem).join("")
    : `<div class="muted">No hay puestos para mostrar.</div>`;

  document.querySelectorAll("[data-point-id]").forEach((button) => {
    button.addEventListener("click", () => openPoint(button.dataset.pointId));
  });
}

function renderMarkerPopup(point, risk) {
  const cover = point.coverImage
    ? `<button class="popup-cover-btn" data-open-point="${point.id}" type="button">
        <img src="${point.coverImage}" alt="Imagen del puesto ${escapeAttr(point.name || "")}">
      </button>`
    : "";
  return `
    <div class="thought-card">
      ${cover}
      <strong>${escapeHtml(point.name || "Puesto")}</strong>
      <span>${escapeHtml(point.site || point.zone || "Sin sede")}</span>
      <div class="thought-row">
        <b style="color:${riskConfig[risk].color}">${point.events.length}</b>
        <span>${point.events.length === 1 ? "evento" : "eventos"} · ${riskConfig[risk].label}</span>
      </div>
      <button class="popup-share-btn" data-share-point="${point.id}">Enviar por WhatsApp</button>
      <button data-open-point="${point.id}">Abrir ficha</button>
    </div>
  `;
}

function renderPointItem(point) {
  const risk = getRisk(point);
  return `
    <button class="point-item" data-point-id="${point.id}">
      <span class="dot ${risk}"></span>
      <span>
        <h3>${escapeHtml(point.name || "Sin nombre")}</h3>
        <p>${escapeHtml(point.site || point.address || "Sin sede")} · ${escapeHtml(point.zone || "Sin zona")}</p>
      </span>
      <span class="muted">${point.events.length}</span>
    </button>
  `;
}

function renderStats() {
  const points = getActivePoints();
  el.totalPoints.textContent = points.length;
  el.redPoints.textContent = points.filter((p) => ["alto", "critico"].includes(getRisk(p))).length;
  el.eventCount.textContent = points.reduce((sum, p) => sum + p.events.length, 0);
}

function openPoint(pointId) {
  selectedPointId = pointId;
  activeTab = "Resumen";
  el.drawer.classList.add("open");
  el.drawer.setAttribute("aria-hidden", "false");
  focusPointOnMap(pointId);
  renderDrawer();
}

function focusPointOnMap(pointId) {
  const point = getPoint(pointId);
  if (!point || !leafletMap) return;
  const marker = markers.get(pointId);
  const targetZoom = Math.max(leafletMap.getZoom(), 17);
  leafletMap.flyTo([point.lat, point.lng], targetZoom, {
    animate: true,
    duration: 0.8,
  });
  if (marker) {
    setTimeout(() => marker.openPopup(), 650);
  }
}

function closeDrawer() {
  selectedPointId = null;
  el.drawer.classList.remove("open");
  el.drawer.setAttribute("aria-hidden", "true");
}

function renderDrawer() {
  const point = getPoint(selectedPointId);
  if (!point) return closeDrawer();
  const risk = getRisk(point);
  el.detailTitle.textContent = point.name || "Puesto sin nombre";
  el.detailSubtitle.textContent = `${point.site || "Sin sede"} · ${riskConfig[risk].label}`;
  renderCounters(point, risk);
  el.tabs.innerHTML = `<button class="tab-share-btn" data-share-current-point type="button">Compartir ubicacion</button>` + tabs
    .map((tab) => `<button class="tab-btn ${tab === activeTab ? "active" : ""}" data-tab="${tab}">${tab}</button>`)
    .join("");
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab;
      renderDrawer();
    });
  });
  document.querySelector("[data-share-current-point]")?.addEventListener("click", () => sharePoint(point));

  if (activeTab === "Resumen") el.tabContent.innerHTML = renderSummary(point);
  else if (activeTab === "Eventos") el.tabContent.innerHTML = renderEvents(point);
  else el.tabContent.innerHTML = renderDocuments(point, docTabs[activeTab]);

  bindDrawerForms(point);
  bindFileActions(point);
}

function renderCounters(point, risk) {
  let counterBar = document.querySelector("#counterBar");
  if (!counterBar) {
    counterBar = document.createElement("div");
    counterBar.id = "counterBar";
    counterBar.className = "counter-bar";
    el.tabs.parentNode.insertBefore(counterBar, el.tabs);
  }
  counterBar.innerHTML = `
    <div>
      <strong>${point.events.length}</strong>
      <span>Eventos</span>
    </div>
    <div>
      <strong>${point.documents.length}</strong>
      <span>Documentos</span>
    </div>
    <div>
      <strong style="color:${riskConfig[risk].color}">${riskConfig[risk].label}</strong>
      <span>Vulnerabilidad</span>
    </div>
  `;
}

function renderSummary(point) {
  const risk = getRisk(point);
  const docs = point.documents.length;
  const cover = point.coverImage
    ? `<img class="cover-image" src="${point.coverImage}" alt="Imagen del puesto">`
    : `<div class="cover-empty">Sin imagen del puesto</div>`;
  return `
    <div class="cover-box">
      ${cover}
      <input id="coverInput" type="file" accept="image/*">
      <div class="form-row">
        <button id="saveCoverBtn" class="primary">Guardar imagen</button>
        ${point.coverImage ? `<button id="removeCoverBtn" class="secondary danger-outline">Quitar imagen</button>` : ""}
      </div>
    </div>
    <div class="info-grid">
      ${infoCard("Institucion", point.name)}
      ${infoCard("Sede", point.site)}
      ${infoCard("Servicio", point.service)}
      ${infoCard("Direccion", point.address)}
      ${infoCard("Rector / responsable", point.manager)}
      ${infoCard("Zona", point.zone)}
      ${infoCard("Comuna", point.commune)}
      ${infoCard("Tipo", point.kind)}
      ${infoCard("Eventos acumulados", String(point.events.length))}
      ${infoCard("Nivel", riskConfig[risk].label)}
      ${infoCard("Documentos", String(docs))}
      ${infoCard("Coordenadas", `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`)}
    </div>
    <h3 class="section-title">Compartir ubicacion</h3>
    <div class="share-actions">
      <button id="shareWhatsAppBtn" class="secondary" type="button">WhatsApp</button>
      <button id="copyLocationBtn" class="secondary" type="button">Copiar enlace</button>
      <a class="download-link" href="${escapeAttr(getMapsUrl(point))}" target="_blank" rel="noopener">Abrir mapa</a>
    </div>
    <h3 class="section-title">Editar datos basicos</h3>
    <div class="form-row">
      <input id="editName" value="${escapeAttr(point.name)}" placeholder="Nombre">
      <input id="editSite" value="${escapeAttr(point.site)}" placeholder="Sede">
    </div>
    <input id="editAddress" value="${escapeAttr(point.address)}" placeholder="Direccion">
    <div class="form-row">
      <input id="editZone" value="${escapeAttr(point.zone)}" placeholder="Zona">
      <input id="editCommune" value="${escapeAttr(point.commune)}" placeholder="Comuna">
    </div>
    <button id="savePointBtn" class="primary">Guardar cambios</button>
    <button id="deletePointBtn" class="danger-btn">Eliminar solo este puesto</button>
  `;
}

function renderEvents(point) {
  const eventTypes = [...new Set(point.events.map((event) => event.type).filter(Boolean))].sort();
  return `
    <div class="form-row">
      <select id="eventType">
        <option>Robo</option>
        <option>Dano</option>
        <option>Ingreso no autorizado</option>
        <option>Vandalismo</option>
        <option>Alarma</option>
        <option>Novedad operativa</option>
        <option>Otro</option>
      </select>
      <input id="eventDate" type="date" value="${new Date().toISOString().slice(0, 10)}">
    </div>
    <textarea id="eventDescription" placeholder="Descripcion del evento"></textarea>
    <input id="eventFile" type="file" accept=".pdf,image/*">
    <button id="addEventBtn" class="primary">Registrar evento</button>
    <div class="event-toolbar">
      <input id="eventSearchInput" type="search" placeholder="Buscar en eventos...">
      <select id="eventTypeFilter">
        <option value="">Todos los eventos</option>
        ${eventTypes.map((type) => `<option value="${escapeAttr(type)}">${escapeHtml(type)}</option>`).join("")}
      </select>
    </div>
    <h3 class="section-title">Eventos acumulados</h3>
    <div id="eventList">
      ${renderEventList(point.events)}
    </div>
  `;
}

function renderEventList(events) {
  return events.length ? events.map(renderEventItem).join("") : `<p class="muted">Sin eventos registrados.</p>`;
}

function renderEventItem(event) {
  const fileActions = renderFileActions(event);
  return `
    <article class="event-item">
      <h4>${escapeHtml(event.type)} · ${escapeHtml(event.date)}</h4>
      <p>${escapeHtml(event.description || "Sin descripcion")}</p>
      ${event.fileName ? `<p>Archivo: ${escapeHtml(event.fileName)}</p>` : ""}
      ${fileActions}
      <button class="secondary mini-action" data-view-event="${event.id}">Ver detalle</button>
      <button class="mini-danger" data-delete-event="${event.id}">Eliminar evento</button>
    </article>
  `;
}

function renderDocuments(point, type) {
  const docs = point.documents.filter((doc) => doc.type === type);
  return `
    <input id="docTitle" placeholder="Nombre del documento">
    <textarea id="docDescription" placeholder="Descripcion u observaciones"></textarea>
    <input id="docFile" type="file" accept=".pdf,image/*,.doc,.docx">
    <button id="addDocBtn" class="primary">Guardar documento</button>
    <h3 class="section-title">Documentos acumulados</h3>
    ${docs.length ? docs.map(renderDocItem).join("") : `<p class="muted">Sin documentos en esta pestana.</p>`}
  `;
}

function renderDocItem(doc) {
  const fileActions = renderFileActions(doc);
  return `
    <article class="doc-item">
      <h4>${escapeHtml(doc.title || doc.fileName || "Documento")}</h4>
      <p>${escapeHtml(doc.description || "Sin descripcion")}</p>
      <p>${escapeHtml(doc.date)} · ${escapeHtml(doc.fileName || "Sin archivo")}</p>
      ${fileActions}
      <button class="mini-danger" data-delete-doc="${doc.id}">Eliminar documento</button>
    </article>
  `;
}

function bindDrawerForms(point) {
  const savePointBtn = document.querySelector("#savePointBtn");
  const shareWhatsAppBtn = document.querySelector("#shareWhatsAppBtn");
  if (shareWhatsAppBtn) {
    shareWhatsAppBtn.addEventListener("click", () => sharePointLocation(point));
  }

  const copyLocationBtn = document.querySelector("#copyLocationBtn");
  if (copyLocationBtn) {
    copyLocationBtn.addEventListener("click", () => copyPointLocation(point));
  }

  if (savePointBtn) {
    savePointBtn.addEventListener("click", () => {
      point.name = document.querySelector("#editName").value.trim();
      point.site = document.querySelector("#editSite").value.trim();
      point.address = document.querySelector("#editAddress").value.trim();
      point.zone = document.querySelector("#editZone").value.trim();
      point.commune = document.querySelector("#editCommune").value.trim();
      touchActiveMap();
      saveState();
      render();
    });
  }

  const deletePointBtn = document.querySelector("#deletePointBtn");
  if (deletePointBtn) {
    deletePointBtn.addEventListener("click", () => {
      const ok = confirm(`Eliminar el puesto "${point.name || point.site || "sin nombre"}" del mapa actual?`);
      if (!ok) return;
      const active = getActiveMap();
      active.points = active.points.filter((item) => item.id !== point.id);
      selectedPointId = null;
      touchActiveMap();
      saveState();
      closeDrawer();
      render();
    });
  }

  const saveCoverBtn = document.querySelector("#saveCoverBtn");
  if (saveCoverBtn) {
    saveCoverBtn.addEventListener("click", async () => {
      const file = document.querySelector("#coverInput").files[0];
      if (!file) {
        alert("Selecciona una imagen primero.");
        return;
      }
      const storedFile = await readStoredImage(file);
      if (!storedFile) return;
      point.coverImage = storedFile;
      point.coverImageName = file.name;
      touchActiveMap();
      saveState();
      renderDrawer();
    });
  }

  const removeCoverBtn = document.querySelector("#removeCoverBtn");
  if (removeCoverBtn) {
    removeCoverBtn.addEventListener("click", () => {
      const ok = confirm("Quitar la imagen de identificacion de este puesto?");
      if (!ok) return;
      point.coverImage = "";
      point.coverImageName = "";
      touchActiveMap();
      saveState();
      renderDrawer();
    });
  }

  const addEventBtn = document.querySelector("#addEventBtn");
  if (addEventBtn) {
    addEventBtn.addEventListener("click", async () => {
      const file = document.querySelector("#eventFile").files[0];
      const storedFile = await readStoredFile(file);
      point.events.unshift({
        id: crypto.randomUUID(),
        type: document.querySelector("#eventType").value,
        date: document.querySelector("#eventDate").value,
        description: document.querySelector("#eventDescription").value.trim(),
        fileName: file?.name || "",
        fileType: file?.type || "",
        fileData: storedFile,
        createdAt: new Date().toISOString(),
      });
      touchActiveMap();
      saveState();
      render();
    });
  }

  const eventSearchInput = document.querySelector("#eventSearchInput");
  const eventTypeFilter = document.querySelector("#eventTypeFilter");
  if (eventSearchInput && eventTypeFilter) {
    const refreshEventList = () => {
      const query = eventSearchInput.value.trim().toLowerCase();
      const type = eventTypeFilter.value;
      const filtered = point.events.filter((event) => {
        const text = [event.type, event.date, event.description, event.fileName].join(" ").toLowerCase();
        return (!query || text.includes(query)) && (!type || event.type === type);
      });
      document.querySelector("#eventList").innerHTML = renderEventList(filtered);
      bindEventListActions(point);
      bindFileActions(point);
    };
    eventSearchInput.addEventListener("input", refreshEventList);
    eventTypeFilter.addEventListener("change", refreshEventList);
  }

  bindEventListActions(point);

  const addDocBtn = document.querySelector("#addDocBtn");
  if (addDocBtn) {
    addDocBtn.addEventListener("click", async () => {
      const file = document.querySelector("#docFile").files[0];
      const storedFile = await readStoredFile(file);
      point.documents.unshift({
        id: crypto.randomUUID(),
        type: docTabs[activeTab],
        title: document.querySelector("#docTitle").value.trim(),
        description: document.querySelector("#docDescription").value.trim(),
        fileName: file?.name || "",
        fileType: file?.type || "",
        fileData: storedFile,
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      });
      touchActiveMap();
      saveState();
      renderDrawer();
      renderStats();
    });
  }

  document.querySelectorAll("[data-delete-doc]").forEach((button) => {
    button.addEventListener("click", () => {
      const docId = button.dataset.deleteDoc;
      const ok = confirm("Eliminar este documento del puesto?");
      if (!ok) return;
      point.documents = point.documents.filter((doc) => doc.id !== docId);
      touchActiveMap();
      saveState();
      renderDrawer();
      renderStats();
    });
  });
}

function bindEventListActions(point) {
  document.querySelectorAll("[data-delete-event]").forEach((button) => {
    button.addEventListener("click", () => {
      const eventId = button.dataset.deleteEvent;
      const ok = confirm("Eliminar este evento acumulado?");
      if (!ok) return;
      point.events = point.events.filter((event) => event.id !== eventId);
      touchActiveMap();
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-view-event]").forEach((button) => {
    button.addEventListener("click", () => {
      const event = point.events.find((item) => item.id === button.dataset.viewEvent);
      if (event) openEventDetail(point, event);
    });
  });
}

function openEventDetail(point, event) {
  openModal("Detalle del evento", `
    <div class="info-grid">
      ${infoCard("Puesto", point.name || "Sin nombre")}
      ${infoCard("Sede", point.site || "Sin sede")}
      ${infoCard("Tipo", event.type)}
      ${infoCard("Fecha", event.date)}
      ${infoCard("Archivo", event.fileName || "Sin archivo")}
      ${infoCard("Registrado", event.createdAt ? new Date(event.createdAt).toLocaleString() : "Sin dato")}
    </div>
    <h3 class="section-title">Descripcion</h3>
    <div class="event-detail-text">${escapeHtml(event.description || "Sin descripcion")}</div>
    ${renderFileActions(event)}
  `, () => {});
  el.modalConfirm.textContent = "Cerrar";
  bindFileActions(point);
}

function renderFileActions(record) {
  if (!record.fileData) return "";
  return `
    <div class="file-actions">
      <button class="secondary" data-open-file="${record.id}">Ver archivo</button>
      <a class="download-link" href="${record.fileData}" download="${escapeAttr(record.fileName || "archivo")}">Descargar</a>
    </div>
  `;
}

function bindFileActions(point) {
  document.querySelectorAll("[data-open-file]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.openFile;
      const record = [...point.events, ...point.documents].find((item) => item.id === id);
      if (!record?.fileData) return;
      const win = window.open("", "_blank");
      if (!win) {
        window.location.href = record.fileData;
        return;
      }
      win.document.write(`
        <title>${escapeHtml(record.fileName || "Archivo")}</title>
        <iframe src="${record.fileData}" style="border:0;width:100%;height:100vh"></iframe>
      `);
    });
  });
}

function readStoredFile(file) {
  if (!file) return Promise.resolve("");
  const maxBytes = 4 * 1024 * 1024;
  if (file.size > maxBytes) {
    alert("Este MVP local guarda archivos de hasta 4 MB. En la siguiente etapa con backend se podran subir PDFs grandes.");
    return Promise.resolve("");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readStoredImage(file) {
  if (!file) return Promise.resolve("");
  if (!file.type.startsWith("image/")) {
    alert("Selecciona un archivo de imagen.");
    return Promise.resolve("");
  }
  const maxBytes = 3 * 1024 * 1024;
  if (file.size > maxBytes) {
    alert("La imagen debe pesar maximo 3 MB en este MVP local.");
    return Promise.resolve("");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function importExcel() {
  const file = el.excelInput.files[0];
  if (!file) {
    el.importStatus.textContent = "elige un archivo";
    return;
  }
  el.importStatus.textContent = "analizando...";
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const imported = [];
  const errors = [];

  const mode = el.sheetMode.value;
  const sheetNames = mode === "all" ? workbook.SheetNames : workbook.SheetNames.slice(0, 1);
  sheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
    const parsed = parseSheet(rows, sheetName);
    imported.push(...parsed.points);
    errors.push(...parsed.errors);
  });

  if (mode === "first" && !imported.length) {
    for (const sheetName of workbook.SheetNames.slice(1)) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
      const parsed = parseSheet(rows, sheetName);
      imported.push(...parsed.points);
      errors.push(...parsed.errors);
      if (imported.length) break;
    }
  }

  if (!imported.length) {
    el.importStatus.textContent = "sin puestos validos";
    alert(`No encontre puestos con coordenadas validas. Errores: ${errors.length}`);
    return;
  }

  el.importStatus.textContent = "ubicando mapa...";
  const target = await resolveImportTargetMap(file.name, workbook.SheetNames, imported);
  const active = target.map;
  const changedMap = activeMapId !== active.id;
  activeMapId = active.id;
  state.activeMapId = active.id;
  if (changedMap) {
    el.searchInput.value = "";
    el.zoneFilter.value = "";
    el.communeFilter.value = "";
    el.riskFilter.value = "";
  }

  const existingKeys = new Set(active.points.map((p) => pointKey(p)));
  let created = 0;
  let updated = 0;

  imported.forEach((point) => {
    const key = pointKey(point);
    const existing = active.points.find((p) => pointKey(p) === key);
    if (existingKeys.has(key) && existing) {
      Object.assign(existing, { ...point, id: existing.id, events: existing.events, documents: existing.documents });
      updated++;
    } else {
      active.points.push(point);
      existingKeys.add(key);
      created++;
    }
  });

  if (active.points.length) {
    const avgLat = active.points.reduce((sum, p) => sum + p.lat, 0) / active.points.length;
    const avgLng = active.points.reduce((sum, p) => sum + p.lng, 0) / active.points.length;
    active.center = [avgLat, avgLng];
  }

  touchActiveMap();
  saveState();
  render();
  fitVisiblePoints();
  el.importStatus.textContent = `${created} nuevos, ${updated} actualizados`;
  alert(`Importacion lista.\nMapa: ${active.name}${target.reason ? `\nDetectado por: ${target.reason}` : ""}\nModo: ${mode === "all" ? "todas las hojas" : "primera hoja valida"}\nNuevos: ${created}\nActualizados: ${updated}\nFilas con error: ${errors.length}`);
}

async function resolveImportTargetMap(fileName, sheetNames, importedPoints) {
  const detectedName = detectImportPlaceName([fileName, ...sheetNames].join(" "));
  const importedCenter = getPointsCenter(importedPoints);
  const nearestPlace = importedCenter ? getNearestKnownPlace(importedCenter.lat, importedCenter.lng) : null;
  let place = "";
  let reason = "";

  if (nearestPlace && nearestPlace.distanceKm <= 35) {
    place = nearestPlace.name;
    reason = "coordenadas del Excel";
  }

  if (!place && importedCenter) {
    try {
      const reverseData = await reverseGeocodePoint(importedCenter.lat, importedCenter.lng);
      place = normalizePlaceQuery(getPlaceNameFromReverseData(reverseData, ""));
      reason = place ? "ciudad detectada por coordenadas" : "";
    } catch (error) {
      place = "";
    }
  }

  if (!place && detectedName) {
    place = detectedName;
    reason = "nombre del archivo u hoja";
  }

  if (place) {
    return getOrCreateImportMap(place, importedCenter, reason);
  }

  if (importedCenter) {
    const nearby = findGenericNearbyMap(importedCenter.lat, importedCenter.lng, 5) || findClosestMap(importedCenter.lat, importedCenter.lng, 5);
    if (nearby) {
      return { map: nearby, reason: "coordenadas cercanas a un mapa existente" };
    }

    const map = createMap(`Mapa ${importedCenter.lat.toFixed(6)}, ${importedCenter.lng.toFixed(6)}`, [importedCenter.lat, importedCenter.lng], 13);
    state.maps.push(map);
    return { map, reason: "mapa creado por coordenadas" };
  }

  return { map: getActiveMap(), reason: "" };
}

function getOrCreateImportMap(place, importedCenter, reason) {
  let map = findMapByPlaceName(place);
  if (map) {
    return { map, reason };
  }

  if (importedCenter) {
    const nearbyGeneric = findGenericNearbyMap(importedCenter.lat, importedCenter.lng, 8);
    if (nearbyGeneric) {
      nearbyGeneric.name = toTitleCase(place);
      nearbyGeneric.center = [importedCenter.lat, importedCenter.lng];
      nearbyGeneric.updatedAt = new Date().toISOString();
      return { map: nearbyGeneric, reason: `${reason} (mapa renombrado)` };
    }
  }

  const known = getKnownPlace(place);
  const center = importedCenter
    ? [importedCenter.lat, importedCenter.lng]
    : known
      ? [known.lat, known.lon]
      : getActiveMap().center;
  map = createMap(toTitleCase(place), center, 13);
  state.maps.push(map);
  return { map, reason: `${reason} (mapa creado)` };
}

function detectImportPlaceName(text) {
  const normalized = normalizePlaceQuery(text);
  const match = getKnownPlaces().find((place) => place.keys.some((key) => normalized.includes(key)));
  return match ? match.name : "";
}

function findMapByPlaceName(placeName) {
  const normalizedPlace = normalizePlaceQuery(placeName);
  return state.maps.find((map) => {
    const normalizedMap = normalizePlaceQuery(map.name);
    return normalizedMap.includes(normalizedPlace) || normalizedPlace.includes(normalizedMap);
  });
}

function getPointsCenter(points) {
  if (!points.length) return null;
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
}

function getNearestKnownPlace(lat, lng) {
  return getKnownPlaces()
    .map((place) => ({
      ...place,
      distanceKm: distanceBetween(place.lat, place.lon, lat, lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}

function findGenericNearbyMap(lat, lng, maxDistanceKm) {
  return state.maps.find((map) => isGenericMapName(map.name) && distanceBetween(map.center[0], map.center[1], lat, lng) <= maxDistanceKm);
}

function findClosestMap(lat, lng, maxDistanceKm) {
  let closest = null;
  let closestKm = Infinity;
  state.maps.forEach((map) => {
    const distanceKm = distanceBetween(map.center[0], map.center[1], lat, lng);
    if (Number.isFinite(distanceKm) && distanceKm < closestKm) {
      closest = map;
      closestKm = distanceKm;
    }
  });
  return closestKm <= maxDistanceKm ? closest : null;
}

function isGenericMapName(name) {
  return /^mapa\s+-?\d/i.test(normalizePlaceQuery(name)) || normalizePlaceQuery(name) === "nuevo mapa";
}

function getKnownPlaces() {
  return [
    { name: "pitalito", keys: ["pitalito", "pitalito huila"], lat: 1.8539, lon: -76.0505 },
    { name: "neiva", keys: ["neiva", "neiva huila"], lat: 2.9273, lon: -75.2819 },
    { name: "garzon", keys: ["garzon", "garzon huila"], lat: 2.1961, lon: -75.6276 },
    { name: "la plata", keys: ["la plata", "la plata huila"], lat: 2.3934, lon: -75.8923 },
    { name: "timana", keys: ["timana", "timana huila"], lat: 1.9714, lon: -75.9339 },
  ];
}

function toTitleCase(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseSheet(rows, sheetName) {
  const headerIndex = rows.findIndex((row) => normalizeRow(row).some((cell) => ["coordenadas", "coordenada"].includes(cell)));
  if (headerIndex < 0) return { points: [], errors: [] };

  const headers = normalizeRow(rows[headerIndex]);
  const index = {
    name: findColumn(headers, ["ie educativa", "institucion", "ie"]),
    site: findColumn(headers, ["sede", "alcaldia educacion", "alcaldia edificio"]),
    service: findColumn(headers, ["tipo"]),
    address: findColumn(headers, ["direcciones", "direccion"]),
    coords: findColumn(headers, ["coordenadas", "coordenada"]),
    manager: findColumn(headers, ["rector", "responsable"]),
    kind: findColumn(headers, ["urbano", "rural", "tipo"], 1),
    zone: findColumn(headers, ["zona"]),
    commune: findColumn(headers, ["comuna"]),
  };

  const points = [];
  const errors = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (!row.some(Boolean)) return;
    const rawCoords = readCell(row, index.coords);
    const coords = parseCoordinates(rawCoords);
    if (!coords) {
      errors.push({ sheetName, row: headerIndex + offset + 2, reason: "coordenadas invalidas", rawCoords });
      return;
    }
    points.push({
      id: crypto.randomUUID(),
      name: readCell(row, index.name),
      site: readCell(row, index.site),
      service: readCell(row, index.service),
      address: readCell(row, index.address),
      manager: readCell(row, index.manager),
      kind: readCell(row, index.kind),
      zone: readCell(row, index.zone),
      commune: readCell(row, index.commune),
      lat: coords.lat,
      lng: coords.lng,
      events: [],
      documents: [],
      source: sheetName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
  return { points, errors };
}

function parseCoordinates(value) {
  let text = String(value || "").replace(/\u00a0/g, " ").trim();
  text = text.replace(/^°/, "1°");
  if (!text) return null;

  const decimal = text.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (decimal && !/[NSEW]/i.test(text)) {
    return { lat: Number(decimal[1]), lng: Number(decimal[2]) };
  }

  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)\s*['’′]?\s*(\d+(?:\.\d+)?)?\s*["”″]?\s*([NSEW])/gi)];
  if (matches.length < 2) return null;

  const values = matches.slice(0, 2).map((match) => {
    const deg = Number(match[1] || 0);
    const min = Number(match[2] || 0);
    const sec = Number(match[3] || 0);
    const hemi = match[4].toUpperCase();
    const sign = ["S", "W"].includes(hemi) ? -1 : 1;
    return sign * (deg + min / 60 + sec / 3600);
  });
  return { lat: values[0], lng: values[1] };
}

function clearActiveMapPoints() {
  const active = getActiveMap();
  if (!active.points.length) {
    alert("Este mapa no tiene puestos para limpiar.");
    return;
  }
  const ok = confirm(`Esto quitara ${active.points.length} puestos del mapa "${active.name}".`);
  if (!ok) return;
  active.points = [];
  selectedPointId = null;
  touchActiveMap();
  saveState();
  closeDrawer();
  render();
}

function openEditMapModal() {
  const active = getActiveMap();
  openModal("Editar mapa", `
    <input id="mapNameInput" placeholder="Nombre del mapa" value="${escapeAttr(active.name)}">
    <div class="form-row">
      <input id="mapLatInput" inputmode="decimal" placeholder="Latitud" value="${Number(active.center[0]).toFixed(6)}">
      <input id="mapLngInput" inputmode="decimal" placeholder="Longitud" value="${Number(active.center[1]).toFixed(6)}">
    </div>
    <button id="findMapLocationBtn" class="secondary full" type="button">Buscar ubicacion por nombre</button>
    <div class="form-row">
      <input id="mapZoomInput" type="number" min="1" max="19" step="1" placeholder="Zoom" value="${active.zoom || 13}">
      <button id="deleteMapBtn" class="danger-btn compact" type="button">Eliminar mapa</button>
    </div>
  `, () => {
    const coords = readMapModalCoordinates();
    if (!coords) return alert("Coordenadas invalidas. Revisa latitud y longitud.");
    active.name = document.querySelector("#mapNameInput").value.trim() || active.name;
    active.center = [coords.lat, coords.lng];
    active.zoom = Number(document.querySelector("#mapZoomInput").value) || 13;
    touchActiveMap();
    saveState();
    leafletMap.setView(active.center, active.zoom);
    render();
  });

  bindMapLocationSearch();
  bindMapCoordinatePreview();
  document.querySelector("#deleteMapBtn").addEventListener("click", () => {
    if (deleteActiveMap()) closeModal();
  });
}

function deleteActiveMap() {
  const active = getActiveMap();
  if (state.maps.length <= 1) {
    alert("Debe existir al menos un mapa.");
    return false;
  }
  const ok = confirm(
    `Vas a eliminar SOLO este mapa seleccionado:\n\n"${active.name}"\n\nLos otros mapas NO se borraran.\n\n¿Confirmas eliminar este mapa?`
  );
  if (!ok) return false;
  state.maps = state.maps.filter((map) => map.id !== active.id);
  activeMapId = state.maps[0].id;
  state.activeMapId = activeMapId;
  selectedPointId = null;
  saveState();
  closeDrawer();
  leafletMap.setView(getActiveMap().center, getActiveMap().zoom);
  render();
  return true;
}

function openMapModal() {
  openModal("Crear mapa", `
    <input id="mapNameInput" placeholder="Nombre del mapa o ciudad" value="">
    <div class="form-row">
      <input id="mapLatInput" inputmode="decimal" placeholder="Latitud" value="1.8539">
      <input id="mapLngInput" inputmode="decimal" placeholder="Longitud" value="-76.0505">
    </div>
    <button id="findMapLocationBtn" class="secondary full" type="button">Buscar ubicacion por nombre</button>
  `, () => {
    const coords = readMapModalCoordinates();
    if (!coords) return alert("Coordenadas invalidas. Revisa latitud y longitud.");
    const map = createMap(
      document.querySelector("#mapNameInput").value.trim() || "Nuevo mapa",
      [coords.lat, coords.lng],
      13
    );
    state.maps.push(map);
    activeMapId = map.id;
    state.activeMapId = map.id;
    saveState();
    leafletMap.setView(map.center, map.zoom);
    render();
  });
  bindMapLocationSearch();
  bindMapCoordinatePreview();
}

function bindMapLocationSearch() {
  const button = document.querySelector("#findMapLocationBtn");
  if (!button) return;
  button.addEventListener("click", async () => {
    const nameInput = document.querySelector("#mapNameInput");
    const latInput = document.querySelector("#mapLatInput");
    const lngInput = document.querySelector("#mapLngInput");
    const query = nameInput.value.trim();
    if (!query) {
      alert("Escribe primero el nombre del mapa o ciudad.");
      return;
    }
    button.textContent = "Buscando...";
    button.disabled = true;
    try {
      const place = await geocodePlace(query);
      if (!place) {
        alert("No encontre esa ubicacion. Prueba con ciudad y departamento, por ejemplo: Pitalito, Huila.");
        return;
      }
      const lat = Number(place.lat);
      const lng = Number(place.lon);
      latInput.value = lat.toFixed(6);
      lngInput.value = lng.toFixed(6);
      leafletMap.setView([lat, lng], 13);
    } catch (error) {
      alert("No se pudo buscar la ubicacion. Revisa internet o escribe las coordenadas manualmente.");
    } finally {
      button.textContent = "Buscar ubicacion por nombre";
      button.disabled = false;
    }
  });
}

function bindMapCoordinatePreview() {
  const latInput = document.querySelector("#mapLatInput");
  const lngInput = document.querySelector("#mapLngInput");
  if (!latInput || !lngInput) return;

  const preview = () => {
    const coords = readMapModalCoordinates(false);
    if (!coords) return;
    latInput.value = coords.lat.toFixed(6);
    lngInput.value = coords.lng.toFixed(6);
    leafletMap.setView([coords.lat, coords.lng], 13);
  };

  latInput.addEventListener("change", preview);
  lngInput.addEventListener("change", preview);
}

function readMapModalCoordinates(normalizeInputs = true) {
  const latInput = document.querySelector("#mapLatInput");
  const lngInput = document.querySelector("#mapLngInput");
  const lat = normalizeCoordinateInput(latInput?.value, "lat");
  const lng = normalizeCoordinateInput(lngInput?.value, "lng");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (normalizeInputs) {
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
  }
  return { lat, lng };
}

function normalizeCoordinateInput(value, axis) {
  let text = String(value || "").trim().replace(",", ".");
  if (!text) return NaN;

  let number = Number(text);
  if (Number.isFinite(number) && Math.abs(number) <= (axis === "lat" ? 90 : 180)) {
    return number;
  }

  const sign = text.startsWith("-") ? -1 : 1;
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return NaN;

  const integerDigitOptions = axis === "lat" ? [1, 2] : [2, 3, 1];
  for (const integerDigits of integerDigitOptions) {
    if (digits.length <= integerDigits) continue;
    const candidate = sign * Number(`${digits.slice(0, integerDigits)}.${digits.slice(integerDigits)}`);
    const limit = axis === "lat" ? 90 : 180;
    if (Number.isFinite(candidate) && Math.abs(candidate) <= limit) {
      return candidate;
    }
  }

  return number;
}

async function geocodePlace(query) {
  const normalized = normalizePlaceQuery(query);
  const known = getKnownPlace(normalized);
  if (known) return known;

  const attempts = [
    normalized,
    `${normalized}, Colombia`,
    normalized.replace(/\s+/g, ", "),
  ];

  for (const attempt of attempts) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=co&q=${encodeURIComponent(attempt)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("geocode failed");
    const results = await response.json();
    if (results[0]) return results[0];
  }
  return null;
}

function normalizePlaceQuery(query) {
  return String(query || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bhila\b/g, "huila")
    .replace(/\s+/g, " ")
    .trim();
}

function getKnownPlace(query) {
  const places = [
    { keys: ["pitalito", "pitalito huila"], lat: 1.8539, lon: -76.0505 },
    { keys: ["neiva", "neiva huila"], lat: 2.9273, lon: -75.2819 },
    { keys: ["garzon", "garzon huila"], lat: 2.1961, lon: -75.6276 },
    { keys: ["la plata", "la plata huila"], lat: 2.3934, lon: -75.8923 },
    { keys: ["timana", "timana huila"], lat: 1.9714, lon: -75.9339 },
  ];
  const found = places.find((place) => place.keys.includes(query));
  return found ? { lat: found.lat, lon: found.lon } : null;
}

function openSecurityModal() {
  const profile = state.profile || { name: "", photo: "" };
  const profilePreview = profile.photo
    ? `<img id="profilePreviewImg" src="${profile.photo}" alt="Perfil">`
    : `<div class="profile-placeholder">Sin foto</div>`;
  openModal("Seguridad", `
    <h3 class="section-title">Perfil de cuenta</h3>
    <div class="profile-preview">${profilePreview}<span class="muted">Identificacion visual de esta cuenta local.</span></div>
    <input id="profileNameInput" placeholder="Nombre del responsable" value="${escapeAttr(profile.name)}">
    <input id="profilePhotoInput" type="file" accept="image/*">
    <button id="saveProfileBtn" class="secondary full" type="button">Guardar perfil</button>
    <h3 class="section-title">Respaldo cifrado</h3>
    <p class="muted">Exporta una copia protegida por tu clave. Guarda este archivo en un lugar seguro para restaurar la informacion si cambias de navegador o equipo.</p>
    <button id="exportBackupBtn" class="secondary full" type="button">Exportar respaldo</button>
    <input id="backupFileInput" type="file" accept=".json,application/json">
    <button id="importBackupBtn" class="secondary full" type="button">Importar respaldo</button>
    <h3 class="section-title">Cambiar clave local</h3>
    <input id="currentPasswordInput" type="password" autocomplete="current-password" placeholder="Clave actual">
    <input id="newPasswordInput" type="password" autocomplete="new-password" placeholder="Nueva clave">
    <input id="newPasswordConfirmInput" type="password" autocomplete="new-password" placeholder="Confirmar nueva clave">
    <p class="muted">La nueva clave volvera a cifrar todos los datos locales. Si la olvidas, no se podra recuperar la informacion.</p>
    <h3 class="section-title">Usuarios</h3>
    <p class="muted">Los usuarios multiples reales requieren servidor. Esta version local protege con una clave maestra del equipo.</p>
  `, async () => {
    const current = document.querySelector("#currentPasswordInput").value;
    const next = document.querySelector("#newPasswordInput").value;
    const confirm = document.querySelector("#newPasswordConfirmInput").value;
    if (next.length < 8) {
      alert("La nueva clave debe tener minimo 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      alert("La nueva clave y la confirmacion no coinciden.");
      return;
    }
    try {
      await changeVaultPassword(current, next);
      alert("Clave actualizada correctamente.");
      lockApp();
    } catch (error) {
      alert("No se pudo cambiar la clave. Revisa la clave actual.");
    }
  });
  el.modalConfirm.textContent = "Cambiar clave";
  document.querySelector("#saveProfileBtn").addEventListener("click", saveProfileFromModal);
  document.querySelector("#exportBackupBtn").addEventListener("click", exportEncryptedBackup);
  document.querySelector("#importBackupBtn").addEventListener("click", importEncryptedBackup);
}

async function saveProfileFromModal() {
  const name = document.querySelector("#profileNameInput").value.trim();
  const file = document.querySelector("#profilePhotoInput").files[0];
  const currentPhoto = state.profile?.photo || "";
  const photo = file ? await readStoredImage(file) : currentPhoto;
  state.profile = { name, photo };
  saveState();
  renderProfile();
  alert("Perfil guardado.");
}

function renderProfile() {
  const profile = state.profile || { name: "", photo: "" };
  el.profileNameLabel.textContent = profile.name || "Mapas, documentos y vulnerabilidad";
  if (profile.photo) {
    el.profileAvatar.src = profile.photo;
    el.profileAvatar.classList.remove("hidden");
  } else {
    el.profileAvatar.removeAttribute("src");
    el.profileAvatar.classList.add("hidden");
  }
}

function getMapsUrl(point) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.lat},${point.lng}`)}`;
}

function getPointLocationMessage(point) {
  const title = point.name || point.site || "Puesto";
  const site = point.site && point.site !== point.name ? `\nSede: ${point.site}` : "";
  const address = point.address ? `\nDireccion: ${point.address}` : "";
  return `${title}${site}${address}\nCoordenadas: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}\nMapa: ${getMapsUrl(point)}`;
}

function sharePointLocation(point) {
  sharePointByWhatsApp(point);
}

async function sharePoint(point, channel = "auto") {
  const message = getPointLocationMessage(point);
  const mapsUrl = getMapsUrl(point);
  if (channel === "auto" && navigator.share) {
    try {
      await navigator.share({
        title: point.name || point.site || "Ubicacion del puesto",
        text: message,
        url: mapsUrl,
      });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  sharePointByWhatsApp(point);
}

function sharePointByWhatsApp(point) {
  const url = `https://wa.me/?text=${encodeURIComponent(getPointLocationMessage(point))}`;
  window.open(url, "_blank", "noopener");
}

async function copyPointLocation(point) {
  const message = getPointLocationMessage(point);
  try {
    await navigator.clipboard.writeText(message);
    alert("Ubicacion copiada. Ya puedes pegarla en WhatsApp u otra aplicacion.");
  } catch (error) {
    window.prompt("Copia la ubicacion:", message);
  }
}

async function exportEncryptedBackup() {
  await pendingSave;
  const vault = getSelectedAccount() || getVault();
  if (!vault?.data || !vault?.iv || !vault?.salt) {
    alert("No hay datos cifrados listos para exportar.");
    return;
  }
  const payload = {
    app: "control-puestos",
    type: "encrypted-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: vault,
  };
  const name = (vault.name || state.profile?.name || "control-puestos")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "control-puestos";
  downloadJsonFile(payload, `${name}-respaldo-cifrado.json`);
}

async function importEncryptedBackup() {
  const file = document.querySelector("#backupFileInput").files[0];
  await importEncryptedBackupFile(file, {
    onSuccess: () => {
      closeModal();
      resetToAuthScreen();
    },
  });
}

async function importEncryptedBackupFromAuth() {
  const file = el.authBackupFile.files[0];
  await importEncryptedBackupFile(file, {
    onSuccess: () => {
      authMode = "login";
      renderAuthScreen();
    },
    showMessage: (message) => {
      el.authMessage.textContent = message;
    },
  });
}

async function importEncryptedBackupFile(file, options = {}) {
  if (!file) {
    if (options.showMessage) options.showMessage("Selecciona primero el archivo de respaldo.");
    else alert("Selecciona primero el archivo de respaldo.");
    return;
  }
  try {
    const payload = JSON.parse(await file.text());
    const account = payload.account || payload;
    if (!isValidBackupAccount(account)) throw new Error("invalid backup");

    const accounts = getAccountsStore();
    const restoredAccount = {
      ...account,
      id: account.id || crypto.randomUUID(),
      importedAt: new Date().toISOString(),
    };
    const index = accounts.accounts.findIndex((item) => item.id === restoredAccount.id);
    if (index >= 0) {
      const ok = confirm(`Ya existe una cuenta llamada "${accounts.accounts[index].name || "Cuenta"}". Deseas reemplazarla con este respaldo?`);
      if (!ok) return;
      accounts.accounts[index] = restoredAccount;
    } else {
      accounts.accounts.push(restoredAccount);
    }
    accounts.activeAccountId = restoredAccount.id;
    activeAccountId = restoredAccount.id;
    saveAccountsStore(accounts);
    const message = "Respaldo importado. Desbloquea la cuenta con la clave original del respaldo.";
    if (options.showMessage) options.showMessage(message);
    else alert(message);
    if (options.onSuccess) options.onSuccess();
  } catch (error) {
    const message = "No se pudo importar el respaldo. Verifica que sea un archivo valido de Control de Puestos.";
    if (options.showMessage) options.showMessage(message);
    else alert(message);
  }
}

function isValidBackupAccount(account) {
  return Boolean(
    account &&
    account.salt &&
    account.iv &&
    account.data &&
    Number(account.iterations || PBKDF2_ITERATIONS) >= 100000
  );
}

function downloadJsonFile(payload, fileName) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function changeVaultPassword(currentPassword, newPassword) {
  const vault = getVault();
  if (!vault) throw new Error("vault missing");
  const oldSalt = base64ToBytes(vault.salt);
  const oldKey = await deriveVaultKey(currentPassword, oldSalt);
  await decryptVault(vault, oldKey);
  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  cryptoKey = await deriveVaultKey(newPassword, newSalt);
  vaultSalt = newSalt;
  await saveStateNow();
}

function openPointModal() {
  const center = leafletMap.getCenter();
  openPointModalAt(center.lat, center.lng);
}

function openPointModalAt(lat, lng, options = {}) {
  openModal("Agregar puesto", `
    <input id="pointNameInput" placeholder="Institucion / nombre">
    <input id="pointSiteInput" placeholder="Sede">
    <input id="pointAddressInput" placeholder="Direccion">
    <div class="form-row">
      <input id="pointLatInput" type="number" step="0.000001" value="${Number(lat).toFixed(6)}">
      <input id="pointLngInput" type="number" step="0.000001" value="${Number(lng).toFixed(6)}">
    </div>
    <div class="form-row">
      <input id="pointZoneInput" placeholder="Zona">
      <input id="pointCommuneInput" placeholder="Comuna">
    </div>
    <button id="autoFillPointBtn" class="secondary full" type="button">Autocompletar con coordenada</button>
    <p id="autoFillPointStatus" class="muted autofill-status">Puedes editar cualquier campo antes de guardar.</p>
  `, () => {
    const point = {
      id: crypto.randomUUID(),
      name: document.querySelector("#pointNameInput").value.trim(),
      site: document.querySelector("#pointSiteInput").value.trim(),
      service: "",
      address: document.querySelector("#pointAddressInput").value.trim(),
      manager: "",
      kind: "",
      zone: document.querySelector("#pointZoneInput").value.trim(),
      commune: document.querySelector("#pointCommuneInput").value.trim(),
      lat: Number(document.querySelector("#pointLatInput").value),
      lng: Number(document.querySelector("#pointLngInput").value),
      events: [],
      documents: [],
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    getActiveMap().points.push(point);
    touchActiveMap();
    saveState();
    render();
    openPoint(point.id);
  });
  bindPointAutofill(options.autoFill === true);
}

function bindPointAutofill(autoStart = false) {
  const button = document.querySelector("#autoFillPointBtn");
  const status = document.querySelector("#autoFillPointStatus");
  if (!button || !status) return;

  const run = async () => {
    const lat = Number(document.querySelector("#pointLatInput").value);
    const lng = Number(document.querySelector("#pointLngInput").value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      status.textContent = "Coordenadas invalidas.";
      return;
    }

    button.disabled = true;
    button.textContent = "Autocompletando...";
    status.textContent = "Buscando informacion cercana...";
    try {
      const data = await reverseGeocodePoint(lat, lng);
      if (!data) {
        status.textContent = "No encontre datos para esa coordenada. Puedes llenar manualmente.";
        return;
      }
      applyPointAutofill(data, lat, lng);
      status.textContent = "Datos sugeridos cargados. Revisa y modifica lo que necesites.";
    } catch (error) {
      status.textContent = "No se pudo autocompletar. Revisa internet o llena manualmente.";
    } finally {
      button.disabled = false;
      button.textContent = "Autocompletar con coordenada";
    }
  };

  button.addEventListener("click", run);
  if (autoStart) run();
}

async function reverseGeocodePoint(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("reverse geocode failed");
  return response.json();
}

function getPlaceNameFromReverseData(data, fallback = "Nuevo mapa") {
  const address = data?.address || {};
  return (
    address.city ||
    address.town ||
    address.municipality ||
    address.village ||
    address.county ||
    address.state_district ||
    address.state ||
    fallback
  );
}

function applyPointAutofill(data, lat, lng) {
  const address = data.address || {};
  const name = data.name || address.school || address.building || address.amenity || "Puesto localizado";
  const site = address.neighbourhood || address.suburb || address.quarter || address.hamlet || address.village || "";
  const street = [address.road, address.house_number].filter(Boolean).join(" ");
  const place = address.city || address.town || address.municipality || address.county || "";
  const fullAddress = data.display_name || [street, site, place, address.state].filter(Boolean).join(", ");
  const zone = address.neighbourhood || address.suburb || address.city_district || address.quarter || "";
  const commune = address.city_district || address.suburb || address.municipality || place || "";

  setInputIfEmpty("#pointNameInput", name);
  setInputIfEmpty("#pointSiteInput", site || place);
  setInputIfEmpty("#pointAddressInput", fullAddress);
  setInputIfEmpty("#pointZoneInput", zone);
  setInputIfEmpty("#pointCommuneInput", commune);
  document.querySelector("#pointLatInput").value = Number(lat).toFixed(6);
  document.querySelector("#pointLngInput").value = Number(lng).toFixed(6);
}

function setInputIfEmpty(selector, value) {
  const input = document.querySelector(selector);
  if (!input || !value) return;
  if (!input.value.trim()) input.value = value;
}

function openFullListModal() {
  const active = getActiveMap();
  const points = getFilteredPoints();
  const rows = points.length
    ? points.map((point, index) => {
        const risk = getRisk(point);
        return `
          <button class="full-list-row" data-modal-point="${point.id}">
            <span>${index + 1}</span>
            <strong>${escapeHtml(point.name || "Sin nombre")}</strong>
            <small>${escapeHtml(point.site || "Sin sede")}</small>
            <small>${escapeHtml(point.zone || "Sin zona")}</small>
            <b class="${risk}">${point.events.length} · ${riskConfig[risk].label}</b>
          </button>
        `;
      }).join("")
    : `<p class="muted">No hay puestos con los filtros actuales.</p>`;

  openModal(`Puestos de ${active.name}`, `
    <div class="full-list-head">
      <span>${points.length} puestos visibles</span>
      <span>${active.points.length} total en este mapa</span>
    </div>
    <div class="full-list">${rows}</div>
  `, () => {});

  el.modalConfirm.textContent = "Cerrar";
  document.querySelectorAll("[data-modal-point]").forEach((button) => {
    button.addEventListener("click", () => {
      closeModal();
      openPoint(button.dataset.modalPoint);
    });
  });
}

function openModal(title, body, onConfirm) {
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = body;
  el.modal.classList.remove("hidden");
  el.modalConfirm.textContent = "Guardar";
  el.modalConfirm.onclick = () => {
    onConfirm();
    closeModal();
  };
}

function closeModal() {
  el.modal.classList.add("hidden");
}

function fitVisiblePoints() {
  const points = getFilteredPoints();
  if (!points.length) {
    alert("No hay puestos visibles para centrar.");
    return;
  }
  const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
  leafletMap.fitBounds(bounds.pad(0.15));
}

async function locateCoordinateFromSidebar() {
  const coords = parseFlexibleCoordinateText(el.coordinateInput.value);
  if (!coords) {
    el.coordinateStatus.textContent = "invalida";
    alert("Escribe una coordenada valida. Ejemplo: 2.896643, -75.278187");
    return;
  }

  el.locateCoordinateBtn.disabled = true;
  el.locateCoordinateBtn.textContent = "Localizando...";
  try {
    let reverseData = null;

    try {
      reverseData = await reverseGeocodePoint(coords.lat, coords.lng);
    } catch (error) {
      reverseData = null;
    }

    let targetMap = findNearbyMap(coords.lat, coords.lng, reverseData);

    if (!targetMap) {
      const mapName = getPlaceNameFromReverseData(reverseData, `Mapa ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
      targetMap = createMap(mapName, [coords.lat, coords.lng], 14);
      state.maps.push(targetMap);
      activeMapId = targetMap.id;
      state.activeMapId = targetMap.id;
      el.coordinateStatus.textContent = "mapa creado";
    } else {
      activeMapId = targetMap.id;
      state.activeMapId = targetMap.id;
      targetMap.center = [coords.lat, coords.lng];
      targetMap.zoom = Math.max(targetMap.zoom || 13, 14);
      el.coordinateStatus.textContent = "ubicada";
    }

    saveState();
    render();
    showCoordinatePreview(coords);
  } finally {
    el.locateCoordinateBtn.disabled = false;
    el.locateCoordinateBtn.textContent = "Localizar coordenada";
  }
}

function findNearbyMap(lat, lng, reverseData) {
  const placeName = normalizePlaceQuery(getPlaceNameFromReverseData(reverseData, ""));
  const byName = placeName
    ? state.maps.find((map) => normalizePlaceQuery(map.name).includes(placeName) || placeName.includes(normalizePlaceQuery(map.name)))
    : null;
  if (byName) return byName;

  let nearest = null;
  let nearestKm = Infinity;
  state.maps.forEach((map) => {
    const distanceKm = distanceBetween(map.center[0], map.center[1], lat, lng);
    if (Number.isFinite(distanceKm) && distanceKm < nearestKm) {
      nearest = map;
      nearestKm = distanceKm;
    }
  });

  return nearestKm <= 5 ? nearest : null;
}

function showCoordinatePreview(coords) {
  if (coordinatePreviewMarker) {
    coordinatePreviewMarker.remove();
  }
  leafletMap.setView([coords.lat, coords.lng], 16);
  coordinatePreviewMarker = L.circleMarker([coords.lat, coords.lng], {
    radius: 10,
    color: "#ffffff",
    weight: 3,
    fillColor: "#6d5dfc",
    fillOpacity: 0.9,
  })
    .addTo(leafletMap)
    .bindPopup(`
      <div class="thought-card">
        <strong>Ubicacion localizada</strong>
        <span>${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}</span>
        <button data-create-point-from-coordinate>Crear puesto aqui</button>
      </div>
    `)
    .openPopup();

  setTimeout(() => {
    document.querySelector("[data-create-point-from-coordinate]")?.addEventListener("click", () => {
      openPointModalAt(coords.lat, coords.lng, { autoFill: true });
    });
  }, 0);
}

function parseFlexibleCoordinateText(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const dms = parseCoordinates(text);
  if (dms) return dms;

  const parts = text.match(/-?\d+(?:[.,]\d+)?/g);
  if (!parts || parts.length < 2) return null;

  const lat = normalizeCoordinateInput(parts[0], "lat");
  const lng = normalizeCoordinateInput(parts[1], "lng");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function distanceBetween(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getFilteredPoints() {
  const q = el.searchInput.value.trim().toLowerCase();
  const zone = el.zoneFilter.value;
  const commune = el.communeFilter.value;
  const risk = el.riskFilter.value;
  return getActivePoints().filter((point) => {
    const text = [point.name, point.site, point.address, point.manager, point.zone, point.commune, point.service]
      .join(" ")
      .toLowerCase();
    return (
      (!q || text.includes(q)) &&
      (!zone || point.zone === zone) &&
      (!commune || point.commune === commune) &&
      (!risk || getRisk(point) === risk)
    );
  });
}

function getRisk(point) {
  const count = point.events.length;
  if (count >= 4) return "critico";
  if (count >= 3) return "alto";
  if (count === 2) return "medio";
  if (count === 1) return "bajo";
  return "normal";
}

function getActiveMap() {
  return state.maps.find((map) => map.id === activeMapId) || state.maps[0];
}

function getActivePoints() {
  return getActiveMap()?.points || [];
}

function getPoint(pointId) {
  return getActivePoints().find((point) => point.id === pointId);
}

function touchActiveMap() {
  getActiveMap().updatedAt = new Date().toISOString();
}

function createMap(name, center, zoom) {
  return {
    id: crypto.randomUUID(),
    name,
    center,
    zoom,
    points: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getVault() {
  const accounts = getAccountsStore();
  if (accounts.accounts.length) {
    const selected = getSelectedAccount();
    return selected || accounts.accounts[0];
  }
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    return null;
  }
}

function getAccountsStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY));
    if (parsed?.accounts) {
      if (!activeAccountId) activeAccountId = parsed.activeAccountId || parsed.accounts[0]?.id || null;
      return parsed;
    }
  } catch (error) {
    console.warn(error);
  }
  return { activeAccountId: null, accounts: [] };
}

function saveAccountsStore(store) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(store));
}

function getSelectedAccount() {
  const store = getAccountsStore();
  return store.accounts.find((account) => account.id === activeAccountId) || store.accounts[0] || null;
}

function setActiveAccountId(accountId) {
  const store = getAccountsStore();
  store.activeAccountId = accountId;
  activeAccountId = accountId;
  saveAccountsStore(store);
}

async function createVault(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  vaultSalt = salt;
  cryptoKey = await deriveVaultKey(password, salt);
  const accounts = getAccountsStore();
  state = accounts.accounts.length ? { activeMapId: null, maps: [] } : loadLegacyState();
  const accountName = el.authAccountName.value.trim() || "Cuenta principal";
  const photoFile = el.authAccountPhoto.files[0];
  const accountPhoto = photoFile ? await readStoredImage(photoFile) : "";
  state.profile = { name: accountName, photo: accountPhoto };
  activeMapId = state.activeMapId;
  if (accounts.accounts.length || authMode === "create") {
    activeAccountId = crypto.randomUUID();
    accounts.activeAccountId = activeAccountId;
    accounts.accounts.push({
      id: activeAccountId,
      name: accountName,
      photo: accountPhoto,
      version: 1,
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt),
      iv: "",
      data: "",
      createdAt: new Date().toISOString(),
    });
    saveAccountsStore(accounts);
  }
  await saveStateNow();
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

async function unlockVault(password, vault) {
  const salt = base64ToBytes(vault.salt);
  vaultSalt = salt;
  cryptoKey = await deriveVaultKey(password, salt);
  const decoded = await decryptVault(vault, cryptoKey);
  state = decoded;
  activeMapId = state.activeMapId;
  const accounts = getAccountsStore();
  if (!accounts.accounts.length && localStorage.getItem(STORAGE_KEY)) {
    const profile = state.profile || {};
    activeAccountId = crypto.randomUUID();
    accounts.activeAccountId = activeAccountId;
    accounts.accounts.push({
      ...vault,
      id: activeAccountId,
      name: profile.name || "Cuenta principal",
      photo: profile.photo || "",
      migratedAt: new Date().toISOString(),
    });
    saveAccountsStore(accounts);
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadLegacyState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (parsed?.maps) return parsed;
  } catch (error) {
    console.warn(error);
  }
  return { activeMapId: null, maps: [] };
}

function saveState() {
  if (!cryptoKey) return;
  const snapshot = JSON.stringify({ ...state, activeMapId });
  const key = cryptoKey;
  const salt = vaultSalt;
  pendingSave = pendingSave.then(() => saveEncryptedSnapshot(snapshot, key, salt)).catch(console.warn);
}

async function saveStateNow() {
  if (!cryptoKey) return;
  await saveEncryptedSnapshot(JSON.stringify({ ...state, activeMapId }), cryptoKey, vaultSalt);
}

async function saveEncryptedSnapshot(snapshot, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(snapshot)
  );
  const vault = {
    version: 1,
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  };
  const accounts = getAccountsStore();
  if (accounts.accounts.length && activeAccountId) {
    const index = accounts.accounts.findIndex((account) => account.id === activeAccountId);
    if (index >= 0) {
      const profile = state.profile || {};
      accounts.accounts[index] = {
        ...accounts.accounts[index],
        ...vault,
        name: profile.name || accounts.accounts[index].name || "Cuenta",
        photo: profile.photo || accounts.accounts[index].photo || "",
        updatedAt: new Date().toISOString(),
      };
      accounts.activeAccountId = activeAccountId;
      saveAccountsStore(accounts);
      return;
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
}

async function decryptVault(vault, key) {
  const iv = base64ToBytes(vault.iv);
  const data = base64ToBytes(vault.data);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function deriveVaultKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(base64) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function lockApp() {
  saveState();
  resetToAuthScreen();
}

function resetToAuthScreen() {
  cryptoKey = null;
  vaultSalt = null;
  state = { activeMapId: null, maps: [] };
  activeMapId = null;
  selectedPointId = null;
  authMode = getAccountsStore().accounts.length ? "login" : "login";
  markers.forEach((marker) => marker.remove());
  markers.clear();
  closeDrawer();
  renderAuthScreen();
}

function normalizeRow(row) {
  return row.map((cell) =>
    String(cell || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function findColumn(headers, names, occurrence = 0) {
  let found = -1;
  let count = 0;
  headers.forEach((header, index) => {
    if (found >= 0) return;
    if (names.some((name) => header === name || header.includes(name))) {
      if (count === occurrence) found = index;
      count++;
    }
  });
  return found;
}

function readCell(row, index) {
  return index >= 0 ? String(row[index] || "").replace(/\u00a0/g, " ").trim() : "";
}

function pointKey(point) {
  return `${point.name}|${point.site}|${point.lat.toFixed(6)}|${point.lng.toFixed(6)}`.toLowerCase();
}

function infoCard(label, value) {
  return `<div class="info-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "Sin dato")}</strong></div>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
