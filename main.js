const map = L.map("map").setView([5.34, -4.03], 12); // creation de map

let restaurants = null; // ✅ variable globale vide pour l'utiliser partout


// --- Itinéraire OSRM 
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
        const found = restaurants.features.find(f => 
  f.properties.Name && f.properties.Name.toLowerCase().includes(val)
);


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
fetch('Restauarant_Vietnamien.geojson.1.geojson')
  .then(response => response.json())
  .then(data => {
    restaurants = data;
    // Création d'un contrôle de liste des restaurants (légende en bas à droite)
   const listControl = L.control({ position: 'bottomright' });
listControl.onAdd = function () {
  const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
  div.style.background = 'rgba(255, 255, 255, 0.95)';
  div.style.backdropFilter = 'blur(6px)';
  div.style.border = '1px solid rgba(0,0,0,0.1)';
  div.style.borderRadius = '12px';
  div.style.padding = '10px 15px';
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
    <h3 style="margin-top:0;color:#d32f2f;text-align:center;">🍴 Restaurants Vietnamiens</h3>
    <ul style="margin:0;padding-left:20px;list-style:none;line-height:1.6;">
      ${restaurants.features.map(f => `
        <li 
          style="cursor:pointer;background:url('https://cdn-icons-png.flaticon.com/512/859/859270.png') no-repeat left center;
          background-size:18px;padding-left:28px;margin:4px 0;border-radius:5px;transition:0.3s;"
          onmouseover="this.style.backgroundColor='rgba(255, 224, 224, 0.6)'"
          onmouseout="this.style.backgroundColor='transparent'"
          data-coords="${f.geometry.coordinates[1]},${f.geometry.coordinates[0]}"
        >
          ${f.properties.Name}
        </li>`).join('')}
    </ul>
  `;



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
    listControl.addTo(map);

    // Définir une icône personnalisée pour les restaurants
    const restaurantIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448610.png', // icône plus réaliste
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -38]
});


    // Ajout des points GeoJSON avec icône personnalisée, image dans le popup et bouton itinéraire
    L.geoJSON(restaurants, {
      onEachFeature: (feature, layer) => {
        const coords = feature.geometry.coordinates;
        layer.bindPopup(`
          <div style="text-align:center;">
            <img src="https://cdn-icons-png.flaticon.com/512/3448/3448610.png" alt="Aperçu icône restaurant" width="32" height="32" /><br/>
            <b>${feature.properties.Name}</b><br/>
            <small>${feature.properties.Commune}, ${feature.properties.Quartier}</small><br/>
            <button onclick=\"window.showRouteToRestaurant(${coords[1]},${coords[0]})\">Itinéraire depuis ma position</button>
          </div>
        `);
      },
      pointToLayer: (feature, latlng) => {
        return L.marker(latlng, { icon: restaurantIcon, title: feature.properties.Name });
      },
    }).addTo(map);
  });

  // S'assurer que la carte s'adapte quand on redimensionne la fenêtre
window.addEventListener('resize', function() {
  map.invalidateSize();
});

// Rendre la fonction accessible au bouton du popup
window.showRouteToRestaurant = showRouteToRestaurant;
