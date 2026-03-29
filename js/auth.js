// auth.js - Handles Login and Signup using LocalStorage Mock

let currentMode = 'login'; // 'login' or 'signup'

function switchTab(mode) {
  currentMode = mode;
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');
  const signupFields = document.getElementById('signup-fields');
  const submitBtn = document.getElementById('submit-btn');
  const subtitle = document.getElementById('form-subtitle');

  if (mode === 'login') {
    loginTab.className = 'btn btn-outline';
    loginTab.style.backgroundColor = '';
    loginTab.style.color = 'var(--color-primary)';
    
    signupTab.className = 'btn';
    signupTab.style.backgroundColor = 'transparent';
    signupTab.style.color = 'var(--color-text)';
    
    signupFields.style.display = 'none';
    submitBtn.textContent = 'Login';
    subtitle.textContent = 'Login to your account';
    
    // Clear required
    document.getElementById('name').removeAttribute('required');
  } else {
    signupTab.className = 'btn btn-outline';
    signupTab.style.backgroundColor = '';
    signupTab.style.color = 'var(--color-primary)';
    
    loginTab.className = 'btn';
    loginTab.style.backgroundColor = 'transparent';
    loginTab.style.color = 'var(--color-text)';
    
    signupFields.style.display = 'block';
    submitBtn.textContent = 'Create Account';
    subtitle.textContent = 'Join the platform';
    
    // Add required
    document.getElementById('name').setAttribute('required', 'true');
  }
}

document.getElementById('auth-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey === "YOUR_API_KEY") {
    showToast("Firebase not configured. Please add keys to app.js", "error");
    return;
  }

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  
  try {
    if (currentMode === 'login') {
      // Attempt Login via Firestore
      const snapshot = await db.collection('users')
        .where('email', '==', email)
        .where('password', '==', password)
        .get();

      if (snapshot.empty) {
        // Auto-create test accounts if they don't exist yet
        let isTestAccount = false;
        let testRole = '';
        if (email === 'donor@test.com' && password === 'password') { isTestAccount = true; testRole = 'donor'; }
        if (email === 'receiver@test.com' && password === 'password') { isTestAccount = true; testRole = 'receiver'; }
        if (email === 'volunteer@test.com' && password === 'password') { isTestAccount = true; testRole = 'volunteer'; }
        
        if (isTestAccount) {
            const newUserDoc = { 
              name: `Demo ${testRole.charAt(0).toUpperCase() + testRole.slice(1)}`, 
              email, 
              password, 
              role: testRole, 
              notifications: [] 
            };
            const userRef = await db.collection('users').add(newUserDoc);
            const user = { id: userRef.id, ...newUserDoc };
            
            setCurrentUser(user);
            showToast(`Test ${testRole} account created and logged in!`);
            setTimeout(() => { window.location.href = `dashboards/${user.role}-dashboard.html`; }, 500);
            return;
        }

        showToast('Invalid email or password', 'error');
        return;
      }
      
      const userDoc = snapshot.docs[0];
      const user = { id: userDoc.id, ...userDoc.data() };
      
      // Success: Save user details locally for session persistence
      setCurrentUser(user);
      showToast('Login successful!');
      
      // Redirect based on role
      setTimeout(() => {
        window.location.href = `dashboards/${user.role}-dashboard.html`;
      }, 500);
      
    } else {
      // Attempt Signup
      const name = document.getElementById('name').value.trim();
      const role = document.getElementById('role').value;
      
      // Check if email exists
      const emailCheck = await db.collection('users')
        .where('email', '==', email)
        .get();
        
      if (!emailCheck.empty) {
        showToast('Email already in use', 'error');
        return;
      }
      
      const newUserDoc = {
        name,
        email,
        password, // Reminder: For strict security we'd use genuine Firebase Auth instead of plaintext
        role,
        notifications: []
      };
      
      const userRef = await db.collection('users').add(newUserDoc);
      const newUser = { id: userRef.id, ...newUserDoc };
      
      setCurrentUser(newUser);
      showToast('Account created successfully!');
      
      // Redirect
      setTimeout(() => {
        window.location.href = `dashboards/${newUser.role}-dashboard.html`;
      }, 500);
    }
  } catch (error) {
    console.error("Auth error:", error);
    showToast("An error occurred communicating with the cloud databse", "error");
  }
});

// Auto-select role based on URL parameter (e.g., auth.html?role=donor)
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam) {
        switchTab('signup');
        const roleSelect = document.getElementById('role');
        if (roleSelect) {
            roleSelect.value = roleParam;
        }
    }
});

// One-click function removed.
