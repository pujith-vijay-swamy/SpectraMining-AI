# SpectraMining AI 🛰️⛏️

SpectraMining AI is a high-performance, satellite-driven mineral observation and spectrometry intelligence framework. It leverages MapLibre GL JS for interactive 3D globe visualization, FastAPI for API orchestration, Sentinel-2 Level-2A imagery, and Google Earth Engine (GEE) to analyze and visualize surface mineral signatures.

---

## 🌟 Key Features

1. **Interactive 3D Globe**: Built with MapLibre GL JS v4, draping high-resolution Esri World Imagery and administrative boundary maps.
2. **Sentinel-2 Multi-Spectral Indices**: Real-time spectral index rendering calculated asynchronously via browser Web Workers:
   - **Copper (Cu) Alteration**: `(Band 4 / Band 3) * (Band 8 / Band 4)` (rendered in Emerald Green)
   - **Iron (Fe) Ore**: `Band 4 / Band 2` (rendered in Red-Orange)
   - **Aluminum (Al) / Bauxite**: `Band 11 / Band 12` (rendered in Cyan/Silver-Blue)
3. **Google Earth Engine Integration**: Live backend queries on the Sentinel-2 SR Harmonized collection with cloud clearing (QA60 mask) and automatic reflectance scale normalization.
4. **Local Simulation Fallback**: Automatic, zero-configuration local synthetic composite simulator if GEE credentials are not configured.
5. **Spectrometry Inspector Popup**: Click anywhere on the map to query coordinates, display index values, and view qualitative mineral presence classifications (`LOW`, `MODERATE`, `HIGH`, `STRONG ANOMALY`).
6. **Custom Autocomplete Geocoder**: Search database assets or geographical places simultaneously, prioritizing database matches.
7. **Premium Glassmorphic UI**: Beautiful space-themed visual interface featuring ambient glows, pulsing animations, and inline credential icons.
8. **Responsive Design**: Auto-reflowing layouts and responsive sidebars designed for extra-small mobile viewports up to large desktop screens.

---

## 📂 Project Structure

```
├── backend/                  # Python FastAPI API Core
│   ├── database.py           # Global Mining Asset Database (300+ operations)
│   ├── gee_service.py        # Google Earth Engine live service integration
│   ├── main.py               # API routes (Assets, Geocode, Spectral Data)
│   ├── requirements.txt      # Python dependencies
│   └── test_backend.py       # API integration tests
│
├── frontend/                 # React + Vite Client Application
│   ├── src/
│   │   ├── firebase.js       # Firebase initialization
│   │   ├── authService.js    # Firebase Auth integration service
│   │   ├── App.jsx           # Main dashboard layout
│   │   ├── index.css         # Styling system & animations
│   │   └── spectral.worker.js# Background spectral computations worker
│   ├── .env                  # Firebase credentials configurations
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Dev proxy configurations
│
├── package.json              # Monorepo dev and build script configurations
└── README.md                 # Project documentation
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.9 or higher)

### 2. Installation
Clone this repository and install the dependencies for both parts:

```bash
# Install root package tools
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Setup Python Backend
Set up your Python virtual environment and install dependencies:

```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cd ..
```

### 4. Configuration (.env)
Create a `.env` file in the `frontend` folder with your Firebase web configuration settings:

```env
VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-auth-domain"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="your-app-id"
VITE_API_BASE_URL="" # Set to your deployed Render URL in production
```

---

## 💻 Running Locally

To run both the frontend and backend concurrently in development mode, execute the following command in the root directory:

```bash
npm run dev
```

- **Frontend client**: Runs at `http://localhost:5173` (Vite)
- **Backend API**: Runs at `http://127.0.0.1:8000` (FastAPI)

---

## ☁️ Deployment Guide

### Frontend (Vercel)
1. Link your repository to Vercel.
2. Select the repository root.
3. Configure the build parameters:
   - **Build Command**: `npm run build`
   - **Output Directory**: `frontend/dist`
4. Set the **Environment Variables**:
   - `VITE_API_BASE_URL`: The URL of your deployed Render backend (e.g., `https://spectramining-api.onrender.com`).
   - Your `VITE_FIREBASE_*` configuration variables.

### Backend (Render)
1. Create a new **Web Service** on Render.
2. Configure build parameters:
   - **Environment**: `Python`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python -m uvicorn main:app --app-dir backend --host 0.0.0.0 --port $PORT`
3. Add any custom environment variables (e.g., for Google Earth Engine authentication).
