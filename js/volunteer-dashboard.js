// volunteer-dashboard.js

let map;
let mapLayers = []; // to clear lines and markers
let volunteerMarker;
let watchId;
let deliveriesUnsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
  const currentUser = getCurrentUser();
  
  if (!currentUser || currentUser.role !== 'volunteer') {
    window.location.href = '../auth.html';
    return;
  }

  document.getElementById('user-greeting').textContent = `Hello, ${currentUser.name}`;
  
  // Expose functions globally for inline onclick handlers
  window.acceptDelivery = acceptDelivery;
  window.markDelivered = markDelivered;

  initMap(currentUser);
  
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    listenToDeliveries(currentUser);
  }
});

function initMap(user) {
  const lat = user.lat || 28.6139;
  const lng = user.lng || 77.2090;

  map = L.map('volunteer-map').setView([lat, lng], 12);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // HTML5 geolocation watch
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      function(position) {
        const liveLat = position.coords.latitude;
        const liveLng = position.coords.longitude;
        
        if (!volunteerMarker) {
          volunteerMarker = L.circleMarker([liveLat, liveLng], { 
            radius: 8, color: 'purple', fillColor: '#8b5cf6', fillOpacity: 1 
          }).addTo(map).bindPopup('<b>You are here</b>');
        } else {
          volunteerMarker.setLatLng([liveLat, liveLng]);
        }
      },
      function(error) {
        console.warn('Geolocation error:', error);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
  }
}

function listenToDeliveries(currentUser) {
  const availableContainer = document.getElementById('deliveries-container');
  const myDeliveriesContainer = document.getElementById('my-deliveries-container');
  
  if (deliveriesUnsubscribe) deliveriesUnsubscribe();

  deliveriesUnsubscribe = db.collection('listings')
    .where('status', 'in', ['claimed', 'delivered'])
    .onSnapshot(snapshot => {
      let availableDeliveries = [];
      let myDeliveries = [];
      let myPastDeliveries = [];

      snapshot.forEach(doc => {
         const data = { id: doc.id, ...doc.data() };
         
         // Available (claimed, no volunteer)
         if (data.status === 'claimed' && !data.volunteerId) {
             availableDeliveries.push(data);
         }
         
         if (data.volunteerId === currentUser.id) {
             if (data.status !== 'delivered') {
                 myDeliveries.push(data);
             } else {
                 myPastDeliveries.push(data);
             }
         }
      });
      
      availableDeliveries.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      myDeliveries.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      myPastDeliveries.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      // Clear map layers
      mapLayers.forEach(layer => {
        if (layer.removeControl) {
          layer.removeControl();
        } else {
          map.removeLayer(layer);
        }
      });
      mapLayers = [];

      // Render Available
      if (availableDeliveries.length === 0) {
        availableContainer.innerHTML = '<p class="text-center" style="padding: 2rem; background: var(--color-white); border-radius: var(--radius-md);">No unassigned deliveries at the moment.</p>';
      } else {
        availableContainer.innerHTML = '';
        availableDeliveries.forEach(listing => {
          const card = document.createElement('div');
          card.className = 'delivery-card animate-fade-in';
          card.innerHTML = `
            <div class="route-info">
              <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; color: var(--color-primary-dark);">${listing.title} <span style="font-weight: 400; color: var(--color-text-muted);">(${listing.quantity} ${listing.unit})</span></h3>
              <p style="margin: 0;"><strong>Pickup From:</strong> ${listing.donorName} (${listing.location})</p>
              <p style="margin: 0;"><strong>Drop-off To:</strong> ${listing.receiverName}</p>
            </div>
            <button onclick="acceptDelivery('${listing.id}')" class="btn btn-primary">Accept Route</button>
          `;
          availableContainer.appendChild(card);
        });
      }

      // Render Active / Past
      let myContent = '';
      
      if (myDeliveries.length === 0) {
        myContent += '<p style="color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 2rem;">No active routes.</p>';
      } else {
        myDeliveries.forEach(listing => {
          myContent += `
            <div style="padding: 1rem; border-bottom: 1px solid var(--color-border); margin-bottom: 0.5rem;" class="animate-fade-in">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <h4 style="margin: 0;">${listing.title}</h4>
                <span class="status-badge badge-yellow">In Transit</span>
              </div>
              <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">From: ${listing.donorName} (${listing.location})</p>
              <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">To: ${listing.receiverName} (${listing.destinationAddress || 'Custom Location'})</p>
              <button onclick="markDelivered('${listing.id}')" class="btn btn-primary btn-block mt-4" style="padding: 0.5rem;">Mark as Delivered</button>
            </div>
          `;

          if(listing.pickupLat && listing.pickupLng && listing.destinationLat && listing.destinationLng) {
            const start = [listing.pickupLat, listing.pickupLng];
            const end = [listing.destinationLat, listing.destinationLng];
            
            const m1 = L.circleMarker(start, { color: 'green', fillColor: '#10b981', fillOpacity: 1, radius: 6 }).addTo(map).bindPopup("Pickup");
            const m2 = L.circleMarker(end, { color: 'red', fillColor: '#ef4444', fillOpacity: 1, radius: 6 }).addTo(map).bindPopup("Drop-off");
            mapLayers.push(m1, m2);

            // Add Road Route
            const routingControl = L.Routing.control({
              waypoints: [ L.latLng(start[0], start[1]), L.latLng(end[0], end[1]) ],
              routeWhileDragging: false,
              addWaypoints: false,
              showAlternatives: false,
              fitSelectedRoutes: true,
              show: false, // hide the text itinerary
              lineOptions: { styles: [{color: '#3b82f6', opacity: 0.8, weight: 6}] },
              createMarker: function() { return null; } // Custom markers used above
            }).addTo(map);

            mapLayers.push({
               removeControl: function() { map.removeControl(routingControl); }
            });

            // Simulate marker moving along the route for Demo Purposes
            routingControl.on('routesfound', function(e) {
              const routes = e.routes;
              const coords = routes[0].coordinates;
              if(!volunteerMarker) {
                 volunteerMarker = L.circleMarker(coords[0], { radius: 8, color: 'purple', fillColor: '#8b5cf6', fillOpacity: 1 }).addTo(map).bindPopup('<b>Delivery Vehicle</b>');
              } else {
                 volunteerMarker.setLatLng(coords[0]);
              }

              let i = 0;
              const mover = setInterval(() => {
                if(i >= coords.length) {
                  clearInterval(mover);
                  return;
                }
                volunteerMarker.setLatLng(coords[i]);
                i++;
              }, 100); // Move every 100ms
            });
          }
        });
      }

      if (myPastDeliveries.length > 0) {
        myContent += '<h3 style="font-size: 1rem; margin-top: 1.5rem; margin-bottom: 1rem; border-top: 1px solid var(--color-border); padding-top: 1rem;">Past Deliveries</h3>';
        myPastDeliveries.forEach(listing => {
            myContent += `
              <div style="padding: 0.5rem 0; border-bottom: 1px dotted var(--color-border); font-size: 0.85rem; color: var(--color-text-muted);">
                ✓ Delivered: <strong>${listing.title}</strong> to ${listing.receiverName}
              </div>
            `;
        });
      }

      myDeliveriesContainer.innerHTML = myContent;
  });
}

async function acceptDelivery(listingId) {
  if (firebaseConfig.apiKey === "YOUR_API_KEY") return;
  const currentUser = getCurrentUser();
  try {
    const listingRef = db.collection('listings').doc(listingId);
    
    // Check if still unassigned
    const snap = await listingRef.get();
    if(snap.exists && snap.data().volunteerId) {
       showToast("This order was already accepted by someone else.", "error");
       return;
    }
    
    await listingRef.update({
      volunteerId: currentUser.id,
      volunteerName: currentUser.name
    });
    
    showToast('Delivery accepted! Great job.');
  } catch(e) {
    console.error(e);
    showToast('Error accepting delivery', 'error');
  }
}

async function markDelivered(listingId) {
  if (firebaseConfig.apiKey === "YOUR_API_KEY") return;
  const currentUser = getCurrentUser();
  try {
    const listingRef = db.collection('listings').doc(listingId);
    await listingRef.update({
      status: 'delivered'
    });
    
    const snap = await listingRef.get();
    if(snap.exists) {
       const data = snap.data();
       addNotification(data.donorId, `Your food "${data.title}" has been successfully delivered by ${currentUser.name}.`);
       addNotification(data.receiverId, `Your claimed food "${data.title}" has arrived. Delivered by ${currentUser.name}.`);
    }

    showToast('Delivery completed! Thank you.');
  } catch(e) {
     console.error(e);
     showToast('Error updating delivery', 'error');
  }
}
