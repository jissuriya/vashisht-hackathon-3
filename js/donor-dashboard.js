// donor-dashboard.js

let map, marker;
let selectedLat, selectedLng;
let listingsUnsubscribe = null;
let editListingId = null;
let currentListingsData = [];

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = getCurrentUser();
  
  if (!currentUser || currentUser.role !== 'donor') {
    window.location.href = '../auth.html'; // Protect route
    return;
  }

  document.getElementById('user-greeting').textContent = `Hello, ${currentUser.name}`;
  
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    const stats = await calculateImpactStats(currentUser.id);
    const donorMeals = document.getElementById('donor-meals');
    if(donorMeals) donorMeals.textContent = stats.meals;
    const donorCo2 = document.getElementById('donor-co2');
    if(donorCo2) donorCo2.textContent = stats.co2Saved + 'kg';

    listenToListings(currentUser.id);
  }

  initMap(currentUser);

  // Handle Form Submission
  document.getElementById('post-food-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
      showToast("Cloud DB keys missing - cannot post", "error");
      return;
    }

    const title = document.getElementById('title').value.trim();
    const quantity = parseInt(document.getElementById('quantity').value, 10);
    const unit = document.getElementById('unit').value;
    const expiry = document.getElementById('expiry').value;
    const location = document.getElementById('location').value.trim();

    try {
      if (editListingId) {
        // Edit Mode
        await db.collection('listings').doc(editListingId).update({
          title, quantity, unit, expiry, location, 
          pickupLat: selectedLat, pickupLng: selectedLng
        });
        showToast('Listing updated successfully!');
        
        // Reset state
        editListingId = null;
        document.querySelector('#post-food-form button[type="submit"]').textContent = 'Post Listing';
      } else {
        // Create Mode
        const newListing = {
          donorId: currentUser.id,
          donorName: currentUser.name,
          title,
          quantity,
          unit,
          expiry,
          location,
          pickupLat: selectedLat,
          pickupLng: selectedLng,
          status: 'available', // initial state
          receiverId: null,
          receiverName: null,
          destinationLat: null,
          destinationLng: null,
          volunteerId: null,
          volunteerName: null,
          createdAt: new Date().toISOString()
        };
        await db.collection('listings').add(newListing);
        showToast('Food listing posted successfully!');
      }
      
      document.getElementById('post-food-form').reset();
    } catch(err) {
      console.error(err);
      showToast('Error saving listing to cloud', 'error');
    }
  });
});

function initMap(user) {
  // Use user's default lat/lng or fallback to a standard location (India)
  selectedLat = user.lat || 28.6139;
  selectedLng = user.lng || 77.2090;

  map = L.map('map').setView([selectedLat, selectedLng], 13);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  marker = L.marker([selectedLat, selectedLng], { draggable: true }).addTo(map);

  // Update on marker drag
  marker.on('dragend', function(e) {
    const latlng = marker.getLatLng();
    selectedLat = latlng.lat;
    selectedLng = latlng.lng;
  });

  // Update on map click
  map.on('click', function(e) {
    selectedLat = e.latlng.lat;
    selectedLng = e.latlng.lng;
    marker.setLatLng(e.latlng);
  });

  // Handle Search
  document.getElementById('btn-search').addEventListener('click', async () => {
    const query = document.getElementById('map-search').value;
    if (!query) return;
    
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await resp.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        selectedLat = lat;
        selectedLng = lon;
        map.setView([lat, lon], 14);
        marker.setLatLng([lat, lon]);
        document.getElementById('location').value = data[0].display_name; // Auto-fill text
        showToast('Location found!');
      } else {
        showToast('Address not found.', 'error');
      }
    } catch (err) {
      showToast('Search failed.', 'error');
    }
  });

  // Handle Live Location
  document.getElementById('btn-location').addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported by your browser.', 'error');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      selectedLat = pos.coords.latitude;
      selectedLng = pos.coords.longitude;
      map.setView([selectedLat, selectedLng], 15);
      marker.setLatLng([selectedLat, selectedLng]);
      
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedLat}&lon=${selectedLng}`);
        const data = await resp.json();
        if(data && data.display_name) {
          document.getElementById('location').value = data.display_name;
        } else {
          document.getElementById('location').value = "My Current Location";
        }
      } catch(e) {
        document.getElementById('location').value = "My Current Location";
      }
      
      showToast('Live location fetched!');
    }, (err) => {
      showToast('Unable to retrieve your location. Check permissions.', 'error');
    });
  });
}

function listenToListings(donorId) {
  const container = document.getElementById('listings-container');
  
  if(listingsUnsubscribe) listingsUnsubscribe();

  listingsUnsubscribe = db.collection('listings')
    .where('donorId', '==', donorId)
    .onSnapshot(snapshot => {
      const myListings = [];
      snapshot.forEach(doc => {
        myListings.push({ id: doc.id, ...doc.data() });
      });
      
      myListings.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      currentListingsData = myListings;

      if (myListings.length === 0) {
        container.innerHTML = '<p style="color: var(--color-text-muted);">You have not posted any food yet.</p>';
        return;
      }

      container.innerHTML = '';
      myListings.forEach(listing => {
        const expiresAt = new Date(listing.expiry).toLocaleString();
        let badgeClass = 'badge-green'; // available
        if (listing.status === 'claimed') badgeClass = 'badge-yellow';
        if (listing.status === 'delivered') badgeClass = 'badge-blue';

        const card = document.createElement('div');
        card.className = 'food-card animate-fade-in';
        
        // Expiry check
        let expiryWarningHtml = '';
        const expiryDate = new Date(listing.expiry);
        const hoursToExpiry = (expiryDate - new Date()) / (1000 * 60 * 60);
        if(listing.status === 'available' && hoursToExpiry > 0 && hoursToExpiry <= 24) {
          expiryWarningHtml = `<span class="status-badge badge-red badge-red-pulse" style="margin-right: 0.5rem; display: inline-flex; align-items: center; gap: 4px;">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Expiring Soon
          </span>`;
        }

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">${listing.title} <span style="font-weight: 400; color: var(--color-text-muted);">(${listing.quantity} ${listing.unit})</span></h3>
              <p style="margin: 0; font-size: 0.9rem; color: var(--color-text-muted);">Expires: ${expiresAt}</p>
              <p style="margin: 0; font-size: 0.9rem; color: var(--color-text-muted);">Pickup: ${listing.location}</p>
            </div>
            <div style="text-align: right;">
              ${expiryWarningHtml}
              <span class="status-badge ${badgeClass}">${listing.status}</span>
              ${listing.status === 'available' ? `
                <div style="margin-top: 0.5rem; display: flex; gap: 0.25rem; justify-content: flex-end;">
                  <button onclick="editListing('${listing.id}')" class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Edit</button>
                  <button onclick="deleteListing('${listing.id}')" class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </div>
              ` : ''}
            </div>
          </div>
          ${listing.receiverName ? `<div style="margin-top: 0.75rem; font-size: 0.9rem; padding: 0.5rem; background: var(--color-light); border-radius: var(--radius-sm);">
            Claimed by: <strong>${listing.receiverName}</strong>
          </div>` : ''}
        `;
        container.appendChild(card);
      });
    });
}

window.editListing = function(id) {
  const listing = currentListingsData.find(l => l.id === id);
  if (!listing) return;

  editListingId = id;
  document.getElementById('title').value = listing.title;
  document.getElementById('quantity').value = listing.quantity;
  document.getElementById('unit').value = listing.unit;
  document.getElementById('expiry').value = listing.expiry;
  document.getElementById('location').value = listing.location;
  
  // Center Map
  if (listing.pickupLat && listing.pickupLng) {
    selectedLat = listing.pickupLat;
    selectedLng = listing.pickupLng;
    map.setView([selectedLat, selectedLng], 14);
    marker.setLatLng([selectedLat, selectedLng]);
  }

  document.querySelector('#post-food-form button[type="submit"]').textContent = 'Update Listing';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteListing = async function(id) {
  if (confirm("Are you sure you want to delete this listing?")) {
    try {
      await db.collection('listings').doc(id).delete();
      showToast('Listing deleted', 'error');
    } catch (e) {
      showToast('Error deleting listing', 'error');
    }
  }
};
