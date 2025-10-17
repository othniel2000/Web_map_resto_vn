const map = L.map("map").setView([5.34, -4.03], 12); // creation de map

// --- Itinéraire OSRM (gratuit) ---
let routeLayer = null;
function showRouteToRestaurant(destLat, destLng) {
  // Choix du mode de transport
  const mode = prompt('Mode de transport : "driving" (voiture), "cycling" (vélo), "walking" (piéton), "motorcycle" (moto)', 'driving');
  if (!mode || !['driving','cycling','walking','motorcycle'].includes(mode)) {
    alert('Mode non reconnu.');
    return;
  }
  // Détermination du point de départ
  function launchRoute(startLat, startLng) {
    const osrmMode = (mode === 'motorcycle') ? 'driving' : mode;
    const url = `https://router.project-osrm.org/route/v1/${osrmMode}/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (routeLayer) {
          map.removeLayer(routeLayer);
        }
        if (!data.routes || !data.routes[0]) {
          alert('Aucun itinéraire trouvé.');
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
        alert('Distance : ' + km + ' km\nDurée estimée : ' + minutes + ' min');
      })
      .catch(() => alert('Erreur lors de la récupération de l\'itinéraire.'));
  }
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
      launchRoute(pos.coords.latitude, pos.coords.longitude);
    }, function() {
      alert('Impossible de récupérer votre position.');
    });
  } else {
    alert("La géolocalisation n'est pas supportée.");
  }
}

// Contrôle de recherche indépendant (en haut à droite)
const searchControl = L.control({ position: 'topright' });
searchControl.onAdd = function () {
  const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
  div.style.background = 'white';
  div.style.padding = '6px';
  div.style.margin = '6px';
  div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
  div.innerHTML = '<input type="text" id="search-global" placeholder="Rechercher un nom..." style="width:160px;padding:2px;" />';
  setTimeout(() => {
    const input = div.querySelector('#search-global');
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        const val = this.value.trim().toLowerCase();
        const found = restaurants.features.find(f => f.properties.nom.toLowerCase() === val);
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
L.control.layers({
  "OpenStreetMap": osm,
  "Satellite": satellite,
  "Hybride (Satellite + Lieux)": hybrid
}, null, { position: 'topleft' }).addTo(map);

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

// Chargement du GeoJSON externe et intégration à la carte
fetch('Restauarant_Vietnamien.geojson')
  .then(response => response.json())
  .then(restaurants => {
    // Création d'un contrôle de liste des restaurants (légende en bas à droite)
    const listControl = L.control({ position: 'bottomright' });
    listControl.onAdd = function () {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
  
  // --- 💄 Style amélioré de la boîte ---
  div.style.background = 'rgba(255, 255, 255, 0.95)';
  div.style.padding = '18px 22px';
  div.style.maxWidth = '340px';        // 🔹 plus large
  div.style.maxHeight = '320px';       // 🔹 plus haute
  div.style.overflowY = 'auto';
  div.style.borderRadius = '15px';
  div.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
  div.style.fontFamily = 'Poppins, Segoe UI, Arial, sans-serif';
  div.style.fontSize = '15px';
  div.style.color = '#333';
  div.style.lineHeight = '1.4em';

  div.innerHTML = `
    <h3 style="margin-top:0;margin-bottom:10px;text-align:center;color:#d32f2f;">
      🍜 Restaurants vietnamiens
    </h3>
    <ul style="margin:0;padding-left:18px;list-style:none;">
      ${restaurants.features.map(f => `
        <li style="cursor:pointer;padding:6px 0;border-bottom:1px solid #eee;">
          🍽️ ${f.properties.Name}
        </li>`).join('')}
    </ul>
  `;

       // --- Interaction : zoom sur le restaurant cliqué ---
  div.onclick = function (e) {
    if (e.target.tagName === 'LI') {
      const name = e.target.textContent.replace('🍽️', '').trim().toLowerCase();
      const found = restaurants.features.find(f => f.properties.Name.toLowerCase() === name);
      if (found) {
        const coords = found.geometry.coordinates;
        map.setView([coords[1], coords[0]], 16);
      }
    }
  };

  return div;
};
listControl.addTo(map);

    // Définir une icône personnalisée pour les restaurants
    const restaurantIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448610.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    // --- Ajout des points GeoJSON avec effet responsive (zoom au survol) ---
L.geoJSON(restaurants, {
  pointToLayer: (feature, latlng) => {
    const normalIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448610.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    const hoverIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448610.png',
      iconSize: [42, 42],
      iconAnchor: [21, 42],
      popupAnchor: [0, -42]
    });

    const marker = L.marker(latlng, { icon: normalIcon, title: feature.properties.Name });

    // 🔹 Effet de zoom au survol
    marker.on('mouseover', () => {
      marker.setIcon(hoverIcon);
      marker.openPopup();
    });

    marker.on('mouseout', () => {
      marker.setIcon(normalIcon);
    });

    // 🔹 Zoom de la carte quand on clique
    marker.on('click', () => {
      const coords = feature.geometry.coordinates;
      map.setView([coords[1], coords[0]], 16);
    });

    const coords = feature.geometry.coordinates;
    marker.bindPopup(`
      <div style="text-align:center;">
        <img src="https://cdn-icons-png.flaticon.com/512/3448/3448610.png" width="32" height="32" /><br/>
        <b>${feature.properties.Name}</b><br/>
        <small>${feature.properties.Commune}, ${feature.properties.Quartier}</small><br/>
        <button onclick="window.showRouteToRestaurant(${coords[1]}, ${coords[0]})">
          Itinéraire depuis ma position
        </button>
      </div>
    `);

    return marker;
  }
}).addTo(map);

  });

// Rendre la fonction accessible au bouton du popup
window.showRouteToRestaurant = showRouteToRestaurant;
