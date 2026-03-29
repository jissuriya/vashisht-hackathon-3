// receiver-dashboard.js

let selectedListingId = null;
let map;
let markers = [];
let modalMap, modalMarker, destLat, destLng;
let listingsUnsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
  const currentUser = getCurrentUser();
  
  if (!currentUser || currentUser.role !== 'receiver') {
    window.location.href = '../auth.html';
    return;
  }

  document.getElementById('user-greeting').textContent = `Hello, ${currentUser.name}`;
  initMap(currentUser);
  
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    listenToListings(currentUser.id);
  }

  document.getElementById('confirm-claim-btn').addEventListener('click', finalizeClaim);
});

function initMap(user) {
  const lat = user.lat || 28.6139;
  const lng = user.lng || 77.2090;

  map = L.map('receiver-map').setView([lat, lng], 12);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  const myMarker = L.circleMarker([lat, lng], { radius: 8, color: 'blue', fillColor: '#3b82f6', fillOpacity: 1 }).addTo(map)
   .bindPopup('<b>Your Location</b>');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      const liveLat = position.coords.latitude;
      const liveLng = position.coords.longitude;
      map.setView([liveLat, liveLng], 13);
      myMarker.setLatLng([liveLat, liveLng]).bindPopup('<b>Your Live Location</b>').openPopup();
    });
  }

  document.getElementById('btn-search-receiver').addEventListener('click', async () => {
    const query = document.getElementById('map-search-receiver').value;
    if (!query) return;
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await resp.json();
      if (data && data.length > 0) {
        map.setView([data[0].lat, data[0].lon], 13);
        showToast('Moved to ' + data[0].display_name);
      } else {
        showToast('Address not found.', 'error');
      }
    } catch(e) {
      showToast('Search failed.', 'error');
    }
  });

  document.getElementById('btn-location-receiver').addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported by your browser.', 'error');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(async (position) => {
      const liveLat = position.coords.latitude;
      const liveLng = position.coords.longitude;
      map.setView([liveLat, liveLng], 14);
      myMarker.setLatLng([liveLat, liveLng]).bindPopup('<b>Your Live Location</b>').openPopup();
      
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${liveLat}&lon=${liveLng}`);
        const data = await resp.json();
        if(data && data.display_name) {
          document.getElementById('map-search-receiver').value = data.display_name;
        } else {
          document.getElementById('map-search-receiver').value = "My Current Location";
        }
      } catch(e) {
        document.getElementById('map-search-receiver').value = "My Current Location";
      }

      showToast('Live location fetched!');
    }, (err) => {
      showToast('Unable to retrieve your location. Check permissions.', 'error');
    });
  });

  setupModalMapLogic();
}

function setupModalMapLogic() {
  const defaultLat = 28.6139;
  const defaultLng = 77.2090;

  modalMap = L.map('modal-map').setView([defaultLat, defaultLng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(modalMap);
  
  modalMarker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(modalMap);

  modalMarker.on('dragend', function() {
    const latlng = modalMarker.getLatLng();
    destLat = latlng.lat;
    destLng = latlng.lng;
  });

  modalMap.on('click', function(e) {
    destLat = e.latlng.lat;
    destLng = e.latlng.lng;
    modalMarker.setLatLng(e.latlng);
  });

  document.getElementById('btn-delivery-search').addEventListener('click', async () => {
    const query = document.getElementById('delivery-address').value;
    if (!query) return;
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await resp.json();
      if (data && data.length > 0) {
        destLat = parseFloat(data[0].lat);
        destLng = parseFloat(data[0].lon);
        modalMap.setView([destLat, destLng], 15);
        modalMarker.setLatLng([destLat, destLng]);
        document.getElementById('delivery-address').value = data[0].display_name;
      }
    } catch(e) {}
  });

  document.getElementById('btn-delivery-location').addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        destLat = pos.coords.latitude;
        destLng = pos.coords.longitude;
        modalMap.setView([destLat, destLng], 15);
        modalMarker.setLatLng([destLat, destLng]);
        
        try {
          const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${destLat}&lon=${destLng}`);
          const data = await resp.json();
          if(data && data.display_name) {
            document.getElementById('delivery-address').value = data.display_name;
          }
        } catch(e) {
          document.getElementById('delivery-address').value = "My Live Location";
        }
      });
    }
  });
}

function listenToListings(receiverId) {
  const availableContainer = document.getElementById('available-container');
  const claimedContainer = document.getElementById('claimed-container');
  
  if (listingsUnsubscribe) listingsUnsubscribe();

  listingsUnsubscribe = db.collection('listings').onSnapshot(snapshot => {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    let availableListings = [];
    let myClaims = [];

    snapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      if (data.status === 'available') availableListings.push(data);
      if (data.receiverId === receiverId) myClaims.push(data);
    });

    availableListings.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    myClaims.reverse();
    
    const currentCenter = map ? map.getCenter() : null;

    // Render Available
    if (availableListings.length === 0) {
      availableContainer.innerHTML = '<p class="text-center" style="padding: 2rem; background: var(--color-white); border-radius: var(--radius-md);">No available food listings right now.</p>';
    } else {
      availableContainer.innerHTML = '';
      availableListings.forEach(listing => {
        const expiresAt = new Date(listing.expiry).toLocaleString();
        let distanceText = '';
        if(listing.pickupLat && listing.pickupLng && currentCenter) {
          const dist = currentCenter.distanceTo(L.latLng(listing.pickupLat, listing.pickupLng));
          distanceText = ` | <strong><span style="color:var(--color-primary)">${(dist / 1000).toFixed(1)} km away</span></strong>`;
        }

        let expiryWarningHtml = '';
        const expiryDate = new Date(listing.expiry);
        const hoursToExpiry = (expiryDate - new Date()) / (1000 * 60 * 60);
        if(hoursToExpiry > 0 && hoursToExpiry <= 24) {
          expiryWarningHtml = `<span class="status-badge badge-red badge-red-pulse" style="margin-left: 0.5rem; display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem;">Expiring Soon</span>`;
        }

        const card = document.createElement('div');
        card.className = 'food-card animate-fade-in';
        card.innerHTML = `
          <div>
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; color: var(--color-primary-dark);">${listing.title} ${expiryWarningHtml}</h3>
            <p style="margin: 0; font-size: 0.95rem;"><strong>Donor:</strong> ${listing.donorName}</p>
            <p style="margin: 0; font-size: 0.95rem;"><strong>Quantity:</strong> ${listing.quantity} ${listing.unit}</p>
            <p style="margin: 0; font-size: 0.95rem; color: var(--color-text-muted);">Pickup: ${listing.location} ${distanceText} | Expires: ${expiresAt}</p>
          </div>
          <button onclick="openModal('${listing.id}', '${listing.title.replace(/'/g, "\\'")}')" class="btn btn-primary">Claim</button>
        `;
        availableContainer.appendChild(card);

        if(listing.pickupLat && listing.pickupLng) {
           const m = L.marker([listing.pickupLat, listing.pickupLng]).addTo(map)
             .bindPopup(`<b>${listing.title}</b><br>${listing.quantity} ${listing.unit}${distanceText}<br><button onclick="openModal('${listing.id}', '${listing.title.replace(/'/g, "\\'")}')" class="btn btn-primary btn-block mt-2" style="padding:0.25rem 0.5rem; font-size:0.8rem;">Claim Here</button>`);
           markers.push(m);
        }
      });
    }

    // Render Claims
    if (myClaims.length === 0) {
      claimedContainer.innerHTML = '<p style="color: var(--color-text-muted); font-size: 0.9rem;">You have not claimed any food yet.</p>';
    } else {
      claimedContainer.innerHTML = '';
      myClaims.forEach(listing => {
        let badgeClass = 'badge-yellow';
        if (listing.status === 'delivered') badgeClass = 'badge-blue';

        const card = document.createElement('div');
        card.style.cssText = 'padding: 1rem; border-bottom: 1px solid var(--color-border); margin-bottom: 0.5rem;';
        card.className = 'animate-fade-in';
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
            <h4 style="margin: 0;">${listing.title}</h4>
            <span class="status-badge ${badgeClass}">${listing.status}</span>
          </div>
          <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">From: ${listing.donorName}</p>
          <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">Pickup: ${listing.location}</p>
          ${listing.volunteerName ? `<p style="margin: 0; font-size: 0.85rem; color: var(--color-primary);">Delivery Partner: ${listing.volunteerName}</p>` : `<p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">Awaiting Delivery Partner</p>`}
        `;
        claimedContainer.appendChild(card);
      });
    }
  });
}

function openModal(id, title) {
  selectedListingId = id;
  document.getElementById('modal-item-name').textContent = title;
  document.getElementById('claim-modal').style.display = 'flex';
  
  const currentUser = getCurrentUser();
  destLat = currentUser.lat || 28.6139;
  destLng = currentUser.lng || 77.2090;
  modalMarker.setLatLng([destLat, destLng]);
  modalMap.setView([destLat, destLng], 14);

  // Reset toggle
  document.getElementById('delivery-needed-checkbox').checked = true;
  document.getElementById('delivery-fields-container').style.display = 'block';

  setTimeout(() => {
    modalMap.invalidateSize();
  }, 100);
}

window.toggleDeliveryFields = function() {
  const isNeeded = document.getElementById('delivery-needed-checkbox').checked;
  document.getElementById('delivery-fields-container').style.display = isNeeded ? 'block' : 'none';
  if(isNeeded) {
    setTimeout(() => { modalMap.invalidateSize(); }, 100);
  }
}

function closeModal() {
  selectedListingId = null;
  document.getElementById('claim-modal').style.display = 'none';
}

async function finalizeClaim() {
  if (!selectedListingId) return;
  
  if(firebaseConfig.apiKey === "YOUR_API_KEY") {
    showToast("Cloud config missing", "error");
    return;
  }
  
  const deliveryNeeded = document.getElementById('delivery-needed-checkbox').checked;
  let addr = "";
  
  if (deliveryNeeded) {
    addr = document.getElementById('delivery-address').value.trim();
    if(!addr) {
      showToast('Please enter a delivery address.', 'error');
      return;
    }
  }
  
  const currentUser = getCurrentUser();

  try {
    const listingRef = db.collection('listings').doc(selectedListingId);
    const docSnap = await listingRef.get();
    
    if(!docSnap.exists) {
      showToast('Listing not found.', 'error');
      closeModal();
      return;
    }
    
    if(docSnap.data().status !== 'available') {
      showToast('Sorry, this item was already claimed.', 'error');
      closeModal();
      return;
    }

    const updatedData = {
      status: deliveryNeeded ? 'claimed' : 'delivered',  // auto-complete if picking up themselves
      receiverId: currentUser.id,
      receiverName: currentUser.name,
      destinationLat: deliveryNeeded ? destLat : null,
      destinationLng: deliveryNeeded ? destLng : null,
      destinationAddress: deliveryNeeded ? addr : 'Self Pickup Location',
      volunteerId: deliveryNeeded ? null : 'self',
      volunteerName: deliveryNeeded ? null : 'Self Pickup'
    };

    await listingRef.update(updatedData);

    const fullListing = { id: selectedListingId, ...docSnap.data(), ...updatedData };
    
    if (deliveryNeeded) {
      autoAssignVolunteer(fullListing);
      addNotification(fullListing.donorId, `Your food "${fullListing.title}" was claimed by ${currentUser.name} (Delivery requested).`);
      addNotification(currentUser.id, `You successfully claimed "${fullListing.title}". A Delivery Partner is being routed.`);
    } else {
      addNotification(fullListing.donorId, `Your food "${fullListing.title}" was claimed for Self-Pickup by ${currentUser.name}. They will arrive shortly!`);
      addNotification(currentUser.id, `You successfully claimed "${fullListing.title}" for Self-Pickup. The donor has been notified.`);
    }

    showToast('Food claimed successfully!');
  } catch(e) {
    console.error(e);
    showToast('Error claiming food', 'error');
  }
  
  closeModal();
}
