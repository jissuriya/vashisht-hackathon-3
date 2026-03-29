# 🍱 FoodBridge – Reduce Waste, Share Food

A web platform that connects **food donors**, **NGOs/receivers**, and **delivery volunteers** to reduce food waste and feed communities efficiently.

---

## ❗ Problem

Millions of tons of food are wasted every day while many people struggle with hunger. There is no efficient system to connect surplus food with those in need.

---

## 💡 Solution

FoodBridge solves this by connecting:

* 🍽️ **Donors** (restaurants, events) to share surplus food
* 🏢 **Receivers** (NGOs, food banks) to claim food
* 🚴 **Volunteers** to deliver food safely

---

## 🚀 Features

* Multi-role system (Donor, Receiver, Volunteer)
* Real-time data using Firebase Firestore
* Live impact tracking (Meals, CO₂ saved, Deliveries)
* Clean and responsive UI
* Role-based dashboards
* Simple login & signup system

---

## 🛠️ Tech Stack

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Firebase Firestore
* **Design:** Modern responsive UI

---

## 📂 Project Structure

```
project/
│── index.html
│── auth.html
│── styles.css
│
├── js/
│     ├── app.js
│     ├── auth.js
│     ├── donor-dashboard.js
│     ├── receiver-dashboard.js
│     ├── volunteer-dashboard.js
│
├── dashboards/
│     ├── donor-dashboard.html
│     ├── receiver-dashboard.html
│     ├── volunteer-dashboard.html
```

---

## ⚙️ Setup Instructions

### 1. Clone Repository

```
git clone https://github.com/jissuriya/vashisht-hackathon-3.git
cd vashisht-hackathon-3
```

---

### 2. Setup Firebase

1. Go to Firebase Console
2. Create a new project
3. Enable Firestore Database (Test Mode)
4. Register a Web App
5. Copy Firebase config

---

### 3. Add Firebase Config

Open `js/app.js` and replace with:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_APP_ID"
};
```

---

### 4. Run Project

Just open:

```
index.html
```

---

## 🎥 Demo Flow

1. Donor posts surplus food
2. Receiver claims the food
3. Volunteer delivers it

(All data is stored and synced using Firebase)

---

## 🔮 Future Improvements

* 🔔 Real-time notifications
* 🤖 AI-based demand prediction
* 🗺️ Route optimization for delivery
* 📱 Mobile app version

---

## 🧑‍💻 Author

GitHub: https://github.com/jissuriya

---

## 🌍 Vision

> Reduce food waste and ensure no one goes hungry.
