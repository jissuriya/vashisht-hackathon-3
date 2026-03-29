// app.js - Core application logic and Firebase Cloud Database setup

// YOUR FIREBASE CONFIGURATION GOES HERE
// You must grab this from the Firebase Console (Project Settings -> General -> Web App)
const firebaseConfig = {
  apiKey: "AIzaSyA5aEj9QQkNH4uRmHZbGSt_oIQthm8Zbe4",
  authDomain: "food-management-94a41.firebaseapp.com",
  projectId: "food-management-94a41",
  storageBucket: "food-management-94a41.firebasestorage.app",
  messagingSenderId: "426568461086",
  appId: "1:426568461086:web:cd31ad94cd21b6a102770f",
  measurementId: "G-EZ7KH9R0M2"
};

// Initialize Firebase (only once)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// We manage session using localStorage just to know who is logged in.
// All actual data (users, listings, notifications) is in Firestore.
function getCurrentUser() {
  const userStr = localStorage.getItem('foodbridge_currentUser');
  return userStr ? JSON.parse(userStr) : null;
}

function setCurrentUser(user) {
  localStorage.setItem('foodbridge_currentUser', JSON.stringify(user));
}

function logoutUser() {
  localStorage.removeItem('foodbridge_currentUser');
  window.location.href = 'index.html';
}

// Ensure UI shows right auth state
function updateNavState() {
  const currentUser = getCurrentUser();
  const navLinks = document.querySelector('.nav-links');
  
  if (!navLinks) return;
  
  // Custom nav updates if needed per page
  if (currentUser && document.location.pathname.endsWith('index.html')) {
     const loginBtn = document.querySelector('a[href="auth.html"]');
     if(loginBtn) {
         loginBtn.textContent = 'Dashboard';
         loginBtn.href = `${currentUser.role}-dashboard.html`;
     }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateNavState();
  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn("FIREBASE NOT CONFIGURED: Please paste your Firebase keys in app.js");
  } else {
    renderNotifications();
  }
});

// UI Helpers: Toasts
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast`;
  if(type === 'error') {
    toast.style.backgroundColor = '#ef4444'; // Red for error
  } else if (type === 'success') {
    toast.style.backgroundColor = '#10b981'; // Green
  }

  toast.textContent = message;
  container.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);

  // Remove after 3s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Logout Global Function
// (Replaced by logoutUser above, keep backwards compatibility for onclick if needed)
function handleLogout() {
  logoutUser();
}

// Notifications
async function addNotification(userId, message) {
  if (firebaseConfig.apiKey === "YOUR_API_KEY") return;
  const userRef = db.collection('users').doc(userId);
  const docSnap = await userRef.get();
  if (docSnap.exists) {
    const userData = docSnap.data();
    const notifications = userData.notifications || [];
    notifications.unshift({
      id: generateId(),
      message,
      timestamp: new Date().toISOString(),
      read: false
    });
    await userRef.update({ notifications });
  }
}

let userSnapshotUnsubscribe = null;

function renderNotifications() {
  const currentUser = getCurrentUser();
  if(!currentUser || firebaseConfig.apiKey === "YOUR_API_KEY") return;

  const bellContainer = document.getElementById('notification-bell');
  if(!bellContainer) return;

  if (userSnapshotUnsubscribe) userSnapshotUnsubscribe();

  userSnapshotUnsubscribe = db.collection('users').doc(currentUser.id).onSnapshot(doc => {
    if (doc.exists) {
      const me = doc.data();
      const unreadCount = (me.notifications || []).filter(n => !n.read).length;
      
      const badge = document.getElementById('notification-badge');
      if (badge) {
        if(unreadCount > 0) {
          badge.textContent = unreadCount;
          badge.style.display = 'block';
        } else {
          badge.style.display = 'none';
        }
      }

      // If dropdown is open, update it live
      const list = document.getElementById('notification-list');
      if (list && list.style.display === 'block') {
         updateNotificationDropdown(me);
      }
    }
  });
}

function updateNotificationDropdown(me) {
  const list = document.getElementById('notification-list');
  list.innerHTML = '';
  const notifs = me.notifications || [];
  if (notifs.length === 0) {
    list.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--color-text-muted);">No new notifications</div>';
  } else {
    notifs.slice(0, 5).forEach(n => {
      list.innerHTML += `<div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); font-size: 0.85rem; ${!n.read ? 'background: var(--color-primary-light);' : ''}">
        <p style="margin: 0; color: var(--color-dark);">${n.message}</p>
        <small style="color: var(--color-text-muted);">${new Date(n.timestamp).toLocaleTimeString()}</small>
      </div>`;
      n.read = true; 
    });
    db.collection('users').doc(me.id).update({ notifications: notifs });
  }
}

function toggleNotifications() {
  const list = document.getElementById('notification-list');
  if(list) {
    list.style.display = list.style.display === 'none' || list.style.display === '' ? 'block' : 'none';
    if(list.style.display === 'block') {
      const currentUser = getCurrentUser();
      if(currentUser && firebaseConfig.apiKey !== "YOUR_API_KEY") {
        db.collection('users').doc(currentUser.id).get().then(doc => {
           if(doc.exists) updateNotificationDropdown(doc.data());
        });
      }
    }
  }
}

// Global Impact Stats Utility
async function calculateImpactStats(userId = null) {
  if (firebaseConfig.apiKey === "YOUR_API_KEY") return { meals: 0, co2Saved: 0, donationsCount: 0 };
  
  let queryRef = db.collection('listings').where('status', 'in', ['claimed', 'delivered']);
  
  if(userId) {
    const currentUser = getCurrentUser();
    if(currentUser.role === 'donor') {
       queryRef = db.collection('listings').where('donorId', '==', userId).where('status', 'in', ['claimed', 'delivered']);
    } else if (currentUser.role === 'volunteer') {
       queryRef = db.collection('listings').where('volunteerId', '==', userId).where('status', 'in', ['claimed', 'delivered']);
    } else {
       queryRef = db.collection('listings').where('receiverId', '==', userId).where('status', 'in', ['claimed', 'delivered']);
    }
  }

  const snapshot = await queryRef.get();
  let meals = 0;
  snapshot.forEach(doc => {
     meals += doc.data().quantity;
  });

  const co2Saved = (meals * 0.5).toFixed(1);
  return { meals, co2Saved, donationsCount: snapshot.docs.length };
}

// Auto Volunteer Assignment Flow
async function autoAssignVolunteer(listing) {
  if (firebaseConfig.apiKey === "YOUR_API_KEY") return;
  const snapshot = await db.collection('users').where('role', '==', 'volunteer').get();
  snapshot.forEach(doc => {
     addNotification(doc.id, `New Delivery Route Available: Dropoff at ${listing.receiverName}`);
  });
}
