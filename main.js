const map = L.map("map").setView([5.34, -4.03], 12); // creation de map

let restaurants = null; // ✅ variable globale vide pour l'utiliser partout

// Détecte si l'utilisateur est sur mobile et ajoute la classe 'mobile' au body pour styles conditionnels
function applyMobileClass() {
  try {
    if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) {
      document.body.classList.add('mobile');
    } else {
      document.body.classList.remove('mobile');
    }
  } catch (e) {
    // ignorer les erreurs silencieusement
  }
}
applyMobileClass();
window.addEventListener('resize', applyMobileClass);

// Helper: convertit une clé technique en label lisible
function humanizeKey(key) {
  if (!key) return '';
  const k = String(key).trim();
  const mapping = {
    'Name': 'Nom', 'name': 'Nom', 'Nom': 'Nom', 'nom': 'Nom',
    'Commune': 'Commune', 'commune': 'Commune',
    'Quartier': 'Quartier', 'quartier': 'Quartier', 'quartier_id': 'Quartier',
    'adresse': 'Adresse', 'address': 'Adresse', 'rue': 'Rue',
    'phone': 'Téléphone', 'telephone': 'Téléphone', 'tel': 'Téléphone',
    'email': 'Email', 'website': 'Site web', 'url': 'Site web',
    'opening_hours': 'Horaires', 'hours': 'Horaires',
    'type': 'Type', 'category': 'Catégorie',
    'x': 'Lon', 'y': 'Lat', 'longitude': 'Lon', 'lat': 'Lat', 'latitude': 'Lat',
    'note': 'Note', 'description': 'Description'
  };
  if (mapping[k]) return mapping[k];
  // fallback : supprimer les suffixes comme _id, _code, remplacer _ et - par des espaces, mettre en Title Case
  let s = k.replace(/(_id|_code)$/i, '');
  s = s.replace(/[_-]+/g, ' ');
  s = s.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  return s;
}


// --- Itinéraire OSRM 
let routeLayer = null;
// transport mode choisi via UI (remplace le prompt)
let selectedTransportMode = 'driving';
function showRouteToRestaurant(destLat, destLng) {
  // Détermination du point de départ
  function launchRoute(startLat, startLng) {
    const mode = selectedTransportMode || 'driving';
    const osrmMode = (mode === 'motorcycle') ? 'driving' : mode;
    const url = `https://router.project-osrm.org/route/v1/${osrmMode}/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (routeLayer) {
          map.removeLayer(routeLayer);
        }
        if (!data.routes || !data.routes[0]) {
          showToast('Aucun itinéraire trouvé.');
          return;
        }
        routeLayer = L.geoJSON(data.routes[0].geometry, {
          style: { color: '#0074D9', weight: 5, opacity: 0.8 }
        }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [40,40] });
        // Afficher la durée et la distance réelles
        const duration = data.routes[0].duration; // en secondes
        const distance = data.routes[0].distance; // en mètres
        const minutes = Math.round(duration / 60);
        const km = (distance / 1000).toFixed(2);
        // Afficher dans le panneau d'itinéraire
        const infoDiv = document.getElementById('route-info');
        if (infoDiv) {
          infoDiv.innerHTML = `<div><strong>Distance :</strong> ${km} km</div><div><strong>Durée :</strong> ${minutes} min</div>`;
        }
        showToast(`Itinéraire tracé — ${km} km, ${minutes} min`);
      })
      .catch(() => showToast('Erreur lors de la récupération de l\'itinéraire.'));
  }
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
      launchRoute(pos.coords.latitude, pos.coords.longitude);
    }, function() {
      showToast('Impossible de récupérer votre position.');
    });
  } else {
    showToast("La géolocalisation n'est pas supportée.");
  }
}

// --- Toast simple pour feedback non intrusif ---
function showToast(message, timeout = 3500) {
  const containerId = 'toast-container';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'app-toast';
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('hide');
    setTimeout(() => t.remove(), 500);
  }, timeout);
}

// Contrôle de recherche indépendant (en haut à droite)
const searchControl = L.control({ position: 'topright' });
searchControl.onAdd = function () {
  const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom search-control');
  div.style.background = 'white';
  div.style.padding = '6px';
  div.style.margin = '6px';
  div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
  // le bouton bascule la visibilité du champ de saisie ; le champ est masqué par défaut sur petits écrans
  div.innerHTML = `
    <div class="search-wrap" style="display:flex;align-items:center;gap:6px;">
      <button id="search-toggle" class="search-toggle-btn" title="Rechercher" aria-label="Rechercher">🔍</button>
      <input type="text" id="search-global" placeholder="Rechercher un nom..." style="width:160px;padding:4px;display:none;" />
    </div>
  `;
  setTimeout(() => {
    const input = div.querySelector('#search-global');
    const toggle = div.querySelector('#search-toggle');
    if (toggle) {
      toggle.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!input) return;
        if (input.style.display === 'none' || getComputedStyle(input).display === 'none') {
          input.style.display = 'inline-block';
          input.focus();
        } else {
          input.style.display = 'none';
        }
      });
    }
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          const val = this.value.trim().toLowerCase();
          if (!restaurants || !restaurants.features) return;
          const found = restaurants.features.find(f => f.properties && f.properties.Name && f.properties.Name.toLowerCase().includes(val));
          if (found) {
            const coords = found.geometry.coordinates;
            map.setView([coords[1], coords[0]], 16);
            // Ouvre le popup si le marker existe
            map.eachLayer(layer => {
              if (layer.getLatLng && layer.getLatLng().lat === coords[1] && layer.getLatLng().lng === coords[0]) {
                if (layer.openPopup) layer.openPopup();
              }
            });
          } else {
            alert('Aucun restaurant trouvé avec ce nom.');
          }
        }
      });
      // masquer le champ s'il perd le focus et est vide (expérience mobile)
      input.addEventListener('blur', function() {
        setTimeout(() => {
          if (this.value.trim() === '') this.style.display = 'none';
        }, 150);
      });
    }
  }, 0);
  return div;
};
searchControl.addTo(map);

// Couches de fond
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// Couche labels (pour hybrid)
const labels = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Labels &copy; Esri'
});

// Couche hybride (satellite + labels)
const hybrid = L.layerGroup([satellite, labels]);

osm.addTo(map);

// Contrôle de couches (fond OSM, Satellite ou Hybride)

// Contrôle des couches (seulement les fonds ici). Nous retirons l'overlay
// "Liste Restaurants" — la liste sera ouverte via un bouton dédié.
L.control.layers({
  "OpenStreetMap": osm,
  "Satellite": satellite,
  "Hybride (Satellite + Lieux)": hybrid
}, null, { position: 'topleft' }).addTo(map);

// Variable pour le contrôle de liste (sera initialisée lors du chargement du GeoJSON)
let listControl = null;
let isListVisible = false;
let pendingListOpen = false; // si l'utilisateur clique sur toggle avant le chargement

// Échelle métrique en bas à gauche
L.control.scale({ position: 'bottomleft', metric: true, imperial: false, maxWidth: 200 }).addTo(map);

// Le contrôle de zoom par défaut est déjà présent (position par défaut : topleft)

// Ajout d'un contrôle de localisation (si supporté par le navigateur)
if (navigator.geolocation) {
  const locateBtn = L.control({ position: 'topright' });
  locateBtn.onAdd = function () {
    const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
    btn.innerHTML = '📍';
    btn.title = 'Me localiser';
    btn.style.backgroundColor = 'white';
    btn.style.width = '34px';
    btn.style.height = '34px';
    btn.onclick = function () {
      map.locate({ setView: true, maxZoom: 16 });
    };
    return btn;
  };
  locateBtn.addTo(map);

  map.on('locationfound', function (e) {
    L.marker(e.latlng).addTo(map).bindPopup('Vous êtes ici !').openPopup();
  });
  map.on('locationerror', function () {
    alert('Localisation impossible.');
  });
}

// --- Contrôle Itinéraire (standalone) ---
let selectDestinationMode = false;
const itineraryControl = L.control({ position: 'topright' });
itineraryControl.onAdd = function () {
  const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
  btn.id = 'itineraryBtn';
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 6.5L21 3l-3.5 6.5z"></path><path d="M3 11l6 6 11-11"></path></svg>`;
  btn.title = 'Activer le mode sélection d\'itinéraire';
  btn.setAttribute('aria-label', 'Itinéraire');
  btn.style.backgroundColor = 'white';
  btn.style.width = '40px';
  btn.style.height = '40px';
  btn.style.lineHeight = '40px';
  btn.style.textAlign = 'center';
  btn.style.fontSize = '12px';
  btn.onclick = function (e) {
    L.DomEvent.stopPropagation(e);
    selectDestinationMode = !selectDestinationMode;
    updateItineraryButton();
    if (selectDestinationMode) {
      showToast('Mode itinéraire activé : cliquez sur un restaurant pour choisir la destination.');
    } else {
      showToast('Mode itinéraire désactivé.');
    }
  };
  return btn;
};
itineraryControl.addTo(map);

function updateItineraryButton() {
  const btn = document.getElementById('itineraryBtn');
  if (!btn) return;
  if (selectDestinationMode) {
    btn.style.backgroundColor = '#ffdede';
  } else {
    btn.style.backgroundColor = 'white';
  }
}

// --- Panneau d'itinéraire (sélecteur de mode + infos) ---
const routePanelControl = L.control({ position: 'bottomleft' });
routePanelControl.onAdd = function () {
  const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom route-panel');
  div.id = 'route-panel';
  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <label for="route-mode" style="font-size:13px;margin-right:6px;">Mode</label>
      <select id="route-mode" style="padding:4px;font-size:13px;">
        <option value="driving">Voiture</option>
        <option value="cycling">Vélo</option>
        <option value="walking">Marche</option>
        <option value="motorcycle">Moto</option>
      </select>
      <button id="clear-route" title="Effacer l'itinéraire" style="margin-left:8px;padding:6px;">✖</button>
    </div>
    <div id="route-info" style="margin-top:8px;font-size:13px;color:#111;min-width:180px;">Aucun itinéraire</div>
  `;

  // Empêcher la propagation des events pour ne pas faire bouger la carte
  L.DomEvent.disableClickPropagation(div);
  setTimeout(() => {
    const select = document.getElementById('route-mode');
    if (select) {
      select.value = selectedTransportMode;
      select.addEventListener('change', function () {
        selectedTransportMode = this.value;
        showToast('Mode de transport: ' + (this.selectedOptions[0]?.text || this.value));
      });
    }
    const clearBtn = document.getElementById('clear-route');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (routeLayer) {
          map.removeLayer(routeLayer);
          routeLayer = null;
        }
        const info = document.getElementById('route-info');
        if (info) info.innerHTML = 'Aucun itinéraire';
        showToast('Itinéraire effacé');
      });
    }
  }, 0);

  return div;
};
routePanelControl.addTo(map);

// Adaptation JS : si écran petit, rendre le panneau d'itinéraire compact par défaut
function adjustPanelsForDevice() {
  try {
    const panel = document.getElementById('route-panel');
    if (!panel) return;
    if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) {
      panel.classList.add('compact');
    } else {
      panel.classList.remove('compact');
    }
  } catch (e) { /* ignorer */ }
}
adjustPanelsForDevice();
window.addEventListener('resize', adjustPanelsForDevice);

// Petit bouton flottant pour ouvrir/fermer la liste des restaurants (toujours visible)
const listToggleBtn = L.control({ position: 'bottomright' });
listToggleBtn.onAdd = function () {
  const b = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom list-toggle-btn');
  b.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
    </svg>`;
  b.title = 'Afficher la liste des restaurants';
  b.style.background = 'white';
  b.style.padding = '6px 8px';
  b.style.borderRadius = '8px';
  b.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
  b.style.cursor = 'pointer';
  b.onclick = function (e) {
    L.DomEvent.stopPropagation(e);
    // Si le contrôle n'est pas encore prêt (chargement du GeoJSON), noter la demande
    if (!listControl) {
      pendingListOpen = !pendingListOpen;
      showToast('Liste en cours de chargement...');
      return;
    }
    if (!isListVisible) {
      listControl.addTo(map);
      isListVisible = true;
    } else {
      try { map.removeControl(listControl); } catch (err) { /* ignorer */ }
      isListVisible = false;
    }
  };
  return b;
};
listToggleBtn.addTo(map);

// Chargement du GeoJSON externe et intégration à la carte
// Utilise explicitement le fichier confirmé par l'utilisateur
fetch('Restauarant_Vietnamien.geojson.1.geojson')
  .then(response => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  })
  .then(data => {
    restaurants = data;
    // Création d'un contrôle de liste des restaurants (légende en bas à droite)
  listControl = L.control({ position: 'bottomright' });
listControl.onAdd = function () {
  const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
  div.style.background = 'rgba(255, 255, 255, 0.95)';
  div.style.backdropFilter = 'blur(6px)';
  div.style.border = '1px solid rgba(0,0,0,0.1)';
  div.style.borderRadius = '12px';
  div.style.padding = '10px 15px';
  // Par défaut largeur fixe sur desktop, mais on adapte pour mobile ci-dessous
  div.style.width = '240px';
  div.style.maxHeight = '35vh';
  div.style.overflowY = 'auto';
  div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
  div.style.fontFamily = 'Segoe UI, Arial';
  div.style.fontSize = '14px';
  div.style.color = '#1a1a1a';
  div.style.marginBottom = '10px';
  div.style.marginRight = '10px';

  div.innerHTML = `
    <div class="list-box collapsed">
      <div class="list-box-header" role="button" tabindex="0" aria-expanded="false">
        <div class="list-box-title">Liste des restaurants vietnamiens</div>
        <div class="list-box-toggle">▸</div>
      </div>
      <div class="list-box-content" style="display:none;">
        <ul class="list-box-items" style="margin:0;padding-left:6px;list-style:none;line-height:1.6;">
          ${restaurants.features.map(f => `
            <li class="list-item" data-coords="${f.geometry.coordinates[1]},${f.geometry.coordinates[0]}" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid rgba(0,0,0,0.04);">
              <img src="https://cdn-icons-png.flaticon.com/512/859/859270.png" alt="" style="width:20px;height:20px;flex:0 0 20px;"/>
              <span class="list-item-label">${f.properties.Name}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;

  // Permettre le défilement à l'intérieur de la légende sans provoquer le pan de la carte.
  try {
    L.DomEvent.disableClickPropagation(div);
    if (L.DomEvent.disableScrollPropagation) L.DomEvent.disableScrollPropagation(div);
  } catch (e) {
    // Certaines versions de Leaflet n'exposent pas disableScrollPropagation ; ignorer sans erreur
  }

  // ensure internal scrolling is possible and we don't grow beyond viewport
  div.style.overflowY = 'auto';
  div.style.maxHeight = '50vh';
  // nudge up a bit so it doesn't cover bottom UI (desktop)
  div.style.marginBottom = '12px';

    // Setup: rendre la boîte repliable/expandable
    setTimeout(() => {
      const box = div.querySelector('.list-box');
      const header = div.querySelector('.list-box-header');
      const content = div.querySelector('.list-box-content');
      const toggle = div.querySelector('.list-box-toggle');
      function setExpanded(exp) {
        if (!box) return;
        if (exp) {
          box.classList.remove('collapsed');
          box.classList.add('expanded');
          if (content) content.style.display = 'block';
          if (toggle) toggle.textContent = '▾';
          header.setAttribute('aria-expanded', 'true');
        } else {
          box.classList.remove('expanded');
          box.classList.add('collapsed');
          if (content) content.style.display = 'none';
          if (toggle) toggle.textContent = '▸';
          header.setAttribute('aria-expanded', 'false');
        }
      }
      // Header click / key interaction (large tap area)
      if (header) {
        header.addEventListener('click', () => setExpanded(!box.classList.contains('expanded')));
        header.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!box.classList.contains('expanded')); } });
        // Improve touch responsiveness by handling touchstart separately
        header.addEventListener('touchstart', (e) => { e.preventDefault(); setExpanded(!box.classList.contains('expanded')); });
      }

      // Initial state: collapsed by default — l'utilisateur ouvre la liste via le bouton
      setExpanded(false);

      // Si on est sur mobile, adapter le style pour faire une bottom-sheet pleine largeur
      if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) {
        div.style.width = '100%';
        div.style.left = '0';
        div.style.right = '0';
        div.style.marginRight = '0';
        div.style.marginBottom = '0';
        div.style.borderRadius = '0';
        div.style.maxHeight = '55vh';
        div.style.padding = '8px';
      }

      // Item click: recentre et ouvre le popup
      const items = div.querySelectorAll('.list-item');
      items.forEach(it => {
        it.addEventListener('click', function () {
          const coords = this.getAttribute('data-coords').split(',');
          const lat = parseFloat(coords[0]);
          const lng = parseFloat(coords[1]);
          map.setView([lat, lng], 16);
          // ouvrir le popup correspondant si le marker existe
          map.eachLayer(layer => {
            if (layer.getLatLng && layer.getLatLng().lat === lat && layer.getLatLng().lng === lng) {
              if (layer.openPopup) layer.openPopup();
            }
          });
        });
      });
    }, 0);



      /* 
// --- Interaction au clic sur les noms (désactivée) ---
div.onclick = function (e) {
  if (e.target.tagName === 'LI') {
    const coords = e.target.getAttribute('data-coords').split(',');
    map.setView([parseFloat(coords[0]), parseFloat(coords[1])], 16);
  }
};
*/

      return div;
    };
    // Ne pas ajouter `listControl` automatiquement : l'affichage est contrôlé
    // par l'overlay factice `listToggleLayer` via les événements overlayadd/overlayremove.

    // Définir une icône personnalisée pour les restaurants
    const restaurantIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448610.png', // icône plus réaliste
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -38]
});

  // ✅ Empêche la carte de bouger quand on scrolle dans la légende sur mobile
    const legend = document.querySelector('.leaflet-control-custom');
    if (legend) {
      legend.addEventListener('touchstart', function (e) {
        e.stopPropagation();  // bloque le drag Leaflet
      });
      legend.addEventListener('touchmove', function (e) {
        e.stopPropagation();  // empêche le défilement de la carte
      });
    }

    // Ajout des points GeoJSON avec icône personnalisée.
    // Les popups affichent désormais automatiquement toutes les propriétés de l'objet GeoJSON.
    L.geoJSON(restaurants, {
      onEachFeature: (feature, layer) => {
        const coords = feature.geometry.coordinates;
        // Construire le HTML du popup en listant toutes les propriétés
        const props = feature.properties || {};
        // Garder uniquement les propriétés renseignées (non nulles, non vides)
        const entries = Object.entries(props || {}).filter(([k, v]) => v !== null && v !== undefined && String(v).trim() !== '');
        let propsHtml = entries.map(([k, v]) => `
          <div class="rp-row"><div class="rp-key">${humanizeKey(k)}</div><div class="rp-value">${v}</div></div>
        `).join('');

        // Si aucune propriété utile et que la géométrie existe, on affichera au moins les coordonnées
        if (!propsHtml || propsHtml.trim() === '') {
          if (feature.geometry && feature.geometry.coordinates) {
            const [lon, lat] = feature.geometry.coordinates;
            propsHtml = `<div class="rp-row"><div class="rp-key">Lat</div><div class="rp-value">${lat}</div></div><div class="rp-row"><div class="rp-key">Lon</div><div class="rp-value">${lon}</div></div>`;
          }
        } else {
          // Si les coordonnées ne figurent pas encore dans les propriétés, on peut les ajouter discrètement en bas
          const hasCoords = entries.some(([k]) => ['x','y','lat','lon','longitude','latitude'].includes(k.toLowerCase()));
          if (!hasCoords && feature.geometry && feature.geometry.coordinates) {
            const [lon, lat] = feature.geometry.coordinates;
            propsHtml += `\n<div class="rp-row"><div class="rp-key">Lat</div><div class="rp-value">${lat}</div></div><div class="rp-row"><div class="rp-key">Lon</div><div class="rp-value">${lon}</div></div>`;
          }
        }
        const popupHtml = `
          <div class="restaurant-popup">
            <div class="rp-header">
              <img class="rp-icon" src="https://cdn-icons-png.flaticon.com/512/3448/3448610.png" alt="icône" width="44" height="44" />
              <div class="rp-title">${props.Name || 'Restaurant'}</div>
            </div>
            <div class="rp-body">
              <div class="rp-props">${propsHtml}</div>
              <div class="rp-note"><em>Cliquez sur le marqueur pour plus d'actions.</em></div>
              <div class="rp-actions" style="margin-top:8px;text-align:right;">
                <button class="rp-btn-itineraire" onclick="window.showRouteToRestaurant(${coords[1]},${coords[0]})" title="Itinéraire vers ce lieu">Itinéraire</button>
              </div>
            </div>
          </div>
        `;
        layer.bindPopup(popupHtml);

        // Si le mode sélection d'itinéraire est actif, cliquer sur le marqueur déclenche le calcul d'itinéraire
        layer.on('click', function (e) {
          if (selectDestinationMode) {
            // Eviter l'ouverture du popup lorsque l'on sélectionne comme destination
            e.originalEvent && e.originalEvent.preventDefault && e.originalEvent.preventDefault();
            // Lancer l'itinéraire
            showRouteToRestaurant(coords[1], coords[0]);
            // Désactiver le mode sélection et mettre à jour le contrôle
            selectDestinationMode = false;
            updateItineraryButton();
          }
        });
      },
      pointToLayer: (feature, latlng) => {
        return L.marker(latlng, { icon: restaurantIcon, title: feature.properties && feature.properties.Name });
      },
    }).addTo(map);
  })
  .catch(err => {
    console.error('Impossible de charger le GeoJSON :', err);
    showToast('Erreur: impossible de charger "Restauarant_Vietnamien.geojson.1.geojson". Assurez-vous de servir le site via HTTP (Live Server) et que le fichier existe.');
  });

  // S'assurer que la carte s'adapte quand on redimensionne la fenêtre
window.addEventListener('resize', function() {
  map.invalidateSize();
});

// Rendre la fonction accessible au bouton du popup
window.showRouteToRestaurant = showRouteToRestaurant;
