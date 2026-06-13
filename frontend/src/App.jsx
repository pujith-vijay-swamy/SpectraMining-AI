// App.jsx
import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { 
  Search, 
  Layers, 
  Sliders, 
  Cpu, 
  MapPin, 
  Database, 
  Compass, 
  TrendingUp, 
  Info,
  Maximize2,
  RefreshCw,
  Award,
  Globe,
  Radio,
  X,
  LogIn,
  LogOut,
  Mail,
  Lock
} from 'lucide-react';
import { 
  loginUser, 
  registerUser, 
  logoutUser, 
  loginWithGoogle, 
  subscribeToAuthChanges 
} from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authMode === 'login') {
        const user = await loginUser(authEmail, authPassword);
        setCurrentUser(user);
      } else {
        const user = await registerUser(authEmail, authPassword);
        setCurrentUser(user);
      }
    } catch (err) {
      console.error(err);
      setAuthError(err.message || "Authentication failed. Try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const user = await loginWithGoogle();
      setCurrentUser(user);
    } catch (err) {
      console.error(err);
      setAuthError(err.message || "Google Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setAuthEmail('');
      setAuthPassword('');
      setAuthError('');
    } catch (err) {
      console.error(err);
    }
  };

  // UI states (lightweight descriptive states to prevent React map lag)
  const [selectedMineral, setSelectedMineral] = useState('Cu'); // 'Fe', 'Al', 'Cu'
  const [sliderVal, setSliderVal] = useState(1.8); // Raw slider state
  const [debouncedThreshold, setDebouncedThreshold] = useState(1.8); // Debounced worker threshold
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Sidebar/Controls/Markers Toggles
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 1150);
  const [showControls, setShowControls] = useState(window.innerWidth > 1280);
  const [showAssetMarkers, setShowAssetMarkers] = useState(true);
  const [showGeoLabels, setShowGeoLabels] = useState(true);
  const [showLayersDropdown, setShowLayersDropdown] = useState(false);
  const [showSpectralOverlay, setShowSpectralOverlay] = useState(true);

  // Suggestion/Autocomplete states
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // Database states
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null); // null at start
  const [dbSearch, setDbSearch] = useState('');
  const [dbFilter, setDbFilter] = useState('ALL'); // 'ALL', 'Cu', 'Fe', 'Al'
  
  // Data rendering trigger state to prevent closure lag
  const [dataVersion, setDataVersion] = useState(0);

  // Map state details (descriptive only)
  const [telemetry, setTelemetry] = useState({
    lat: 10.0,
    lng: 0.0,
    zoom: 1.6,
    pitch: 0,
    bearing: 0,
    projection: 'globe',
    status: 'Initializing...'
  });

  const [sensorStats, setSensorStats] = useState({
    cloudCover: 0,
    processingTime: 0,
    sensor: 'Sentinel-2A MSI',
    nearestAssetName: '',
    nearestAssetDist: null
  });

  const [pixelStats, setPixelStats] = useState({
    percentage: 0,
    countAbove: 0,
    averageValue: 0,
    maxValue: 0,
    minValue: 0
  });

  // Refs for map, worker, coordinates, components
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const workerRef = useRef(null);
  const bboxRef = useRef(null);
  const pixelsDataRef = useRef(null);
  const searchContainerRef = useRef(null);
  const isRotatingRef = useRef(true); // Active at start
  const chartCanvasRef = useRef(null);
  const layersDropdownRef = useRef(null);

  // Keep references to prevent closures inside map event listeners
  const assetsRef = useRef([]);
  const selectAssetRef = useRef(null);
  const showGeoLabelsRef = useRef(true);
  const showSpectralOverlayRef = useRef(true);
  const selectedMineralRef = useRef('Cu');
  const debouncedThresholdRef = useRef(1.8);

  useEffect(() => {
    showGeoLabelsRef.current = showGeoLabels;
  }, [showGeoLabels]);

  useEffect(() => {
    showSpectralOverlayRef.current = showSpectralOverlay;
  }, [showSpectralOverlay]);

  useEffect(() => {
    selectedMineralRef.current = selectedMineral;
  }, [selectedMineral]);

  useEffect(() => {
    debouncedThresholdRef.current = debouncedThreshold;
  }, [debouncedThreshold]);

  // Default mineral configuration limits
  const mineralConfig = {
    Fe: { name: 'Iron Ore (Fe)', shortDesc: 'Iron Ore', formula: 'Band 4 / Band 2', defaultThreshold: 1.2, min: 0.2, max: 3.5, color: '#f97316' },
    Al: { name: 'Aluminum / Bauxite (Al)', shortDesc: 'Bauxite', formula: 'Band 11 / Band 12', defaultThreshold: 1.4, min: 0.2, max: 3.5, color: '#06b6d4' },
    Cu: { name: 'Copper Alteration (Cu)', shortDesc: 'Copper', formula: '(Band 4 / Band 3) * (Band 8 / Band 4)', defaultThreshold: 1.8, min: 0.2, max: 5.0, color: '#10b981' },
    Au: { name: 'Gold Alteration (Au)', shortDesc: 'Gold', formula: 'Band 11 / Band 8', defaultThreshold: 1.5, min: 0.5, max: 4.0, color: '#eab308' },
    Mn: { name: 'Manganese Oxide (Mn)', shortDesc: 'Manganese', formula: 'Band 11 / Band 4', defaultThreshold: 1.3, min: 0.3, max: 3.5, color: '#d946ef' },
    Ls: { name: 'Limestone Calcite (Ls)', shortDesc: 'Limestone', formula: 'Band 8 / Band 12', defaultThreshold: 2.0, min: 0.5, max: 5.0, color: '#cbd5e1' }
  };

  // Sync refs with state
  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    selectAssetRef.current = selectAsset;
  }, [selectedMineral, dataVersion, assets]);

  // 1. Debounce slider value by 150ms to prevent worker thrashing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedThreshold(sliderVal);
    }, 150);
    return () => clearTimeout(handler);
  }, [sliderVal]);

  // Reset slider threshold ranges when mineral changes
  useEffect(() => {
    const defaults = mineralConfig[selectedMineral];
    setSliderVal(defaults.defaultThreshold);
    setDebouncedThreshold(defaults.defaultThreshold);
  }, [selectedMineral]);

  // 2. Fetch Assets Database on Mount
  useEffect(() => {
    setTelemetry(prev => ({ ...prev, status: 'Loading Asset Database...' }));
    fetch(`${API_BASE_URL}/api/assets`)
      .then(res => res.json())
      .then(data => {
        setAssets(data);
        setTelemetry(prev => ({ ...prev, status: 'Database loaded (200+ operations).' }));
      })
      .catch(err => {
        console.error('Failed to load assets:', err);
        setTelemetry(prev => ({ ...prev, status: 'Asset loading failed.' }));
      });
  }, []);

  // Globe slow auto-rotation animation loop
  const rotateGlobe = () => {
    const map = mapRef.current;
    if (!map || !isRotatingRef.current) return;

    const zoom = map.getZoom();
    if (zoom < 5) {
      const currentBearing = map.getBearing();
      map.setBearing((currentBearing + 0.08) % 360);
    }
    requestAnimationFrame(rotateGlobe);
  };

  // 3. Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Tokenless Esri World Imagery style
    const mapStyle = {
      version: 8,
      sources: {
        'esri-imagery': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: 'Tiles &copy; Esri &mdash; Sources: Esri, USGS, NOAA'
        },
        'esri-boundaries': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: 'Labels &copy; Esri'
        }
      },
      layers: [
        {
          id: 'esri-imagery-layer',
          type: 'raster',
          source: 'esri-imagery',
          minzoom: 0,
          maxzoom: 20
        },
        {
          id: 'esri-boundaries-layer',
          type: 'raster',
          source: 'esri-boundaries',
          minzoom: 0,
          maxzoom: 20,
          layout: {
            visibility: showGeoLabels ? 'visible' : 'none'
          },
          paint: {
            'raster-opacity': 0.85
          }
        }
      ]
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [10.0, 15.0], // Centered globally
      zoom: 1.6,
      pitch: 0,
      bearing: 0,
      antialias: true,
      fadeDuration: 100,       // Reduce tile fade-in delay from 300ms to 100ms for instant snapping
      maxTileCacheSize: 150    // Increase memory cache size for loaded tiles (prevent re-downloads)
    });

    mapRef.current = map;

    // Enable 3D Globe projection
    map.on('style.load', () => {
      map.setProjection({ type: 'globe' });
    });

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    // Track map telemetry details
    map.on('move', () => {
      const center = map.getCenter();
      setTelemetry(prev => ({
        ...prev,
        lat: parseFloat(center.lat.toFixed(4)),
        lng: parseFloat(center.lng.toFixed(4)),
        zoom: parseFloat(map.getZoom().toFixed(1)),
        pitch: Math.round(map.getPitch()),
        bearing: Math.round(map.getBearing())
      }));
    });

    // Run auto-rotation loop on map load
    map.on('load', () => {
      setTelemetry(prev => ({ ...prev, status: 'Satellite orbit active...' }));
      rotateGlobe();
    });

    // Interaction listeners to cancel auto-rotation
    const stopRotation = () => {
      isRotatingRef.current = false;
    };
    map.on('mousedown', stopRotation);
    map.on('zoomstart', stopRotation);
    map.on('rotatestart', stopRotation);
    map.on('dragstart', stopRotation);
    map.on('pitchstart', stopRotation);

    // Temporarily hide heavy overlay layers during transitions to load tiles faster
    map.on('movestart', () => {
      if (map.getLayer('esri-boundaries-layer')) {
        map.setLayoutProperty('esri-boundaries-layer', 'visibility', 'none');
      }
      if (map.getLayer('spectral-layer')) {
        map.setLayoutProperty('spectral-layer', 'visibility', 'none');
      }
    });

    map.on('moveend', () => {
      if (map.getLayer('esri-boundaries-layer')) {
        map.setLayoutProperty(
          'esri-boundaries-layer', 
          'visibility', 
          showGeoLabelsRef.current ? 'visible' : 'none'
        );
      }
      if (map.getLayer('spectral-layer')) {
        map.setLayoutProperty(
          'spectral-layer', 
          'visibility', 
          showSpectralOverlayRef.current ? 'visible' : 'none'
        );
      }
    });

    // Inspector tool: click on map overlay to show mineral index popup
    map.on('click', (e) => {
      if (!bboxRef.current || !pixelsDataRef.current) return;

      const bbox = bboxRef.current; // [min_lat, min_lng, max_lat, max_lng]
      const clickLat = e.lngLat.lat;
      const clickLng = e.lngLat.lng;

      const minLat = bbox[0];
      const minLng = bbox[1];
      const maxLat = bbox[2];
      const maxLng = bbox[3];

      if (clickLat >= minLat && clickLat <= maxLat && clickLng >= minLng && clickLng <= maxLng) {
        const yRatio = (maxLat - clickLat) / (maxLat - minLat);
        const xRatio = (clickLng - minLng) / (maxLng - minLng);

        const r = Math.max(0, Math.min(99, Math.floor(yRatio * 100)));
        const c = Math.max(0, Math.min(99, Math.floor(xRatio * 100)));

        const pixelIdx = r * 100 + c;
        const p = pixelsDataRef.current[pixelIdx];

        if (p) {
          const b2 = p[0];
          const b3 = p[1];
          const b4 = p[2];
          const b8 = p[3];
          const b11 = p[4];
          const b12 = p[5];

          let indexVal = 0.0;
          let minName = "";
          let minColor = "";

          const activeMin = selectedMineralRef.current;
          const thresh = debouncedThresholdRef.current;

          if (activeMin === "Fe") {
            indexVal = b2 > 0 ? b4 / b2 : 0.0;
            minName = "Iron Ore (Fe)";
            minColor = "#f97316";
          } else if (activeMin === "Al") {
            indexVal = b12 > 0 ? b11 / b12 : 0.0;
            minName = "Aluminum (Al)";
            minColor = "#06b6d4";
          } else if (activeMin === "Cu") {
            indexVal = b3 > 0 ? b8 / b3 : 0.0;
            minName = "Copper (Cu)";
            minColor = "#10b981";
          } else if (activeMin === "Au") {
            indexVal = b8 > 0 ? b11 / b8 : 0.0;
            minName = "Gold Alteration (Au)";
            minColor = "#eab308";
          } else if (activeMin === "Mn") {
            indexVal = b4 > 0 ? b11 / b4 : 0.0;
            minName = "Manganese Oxide (Mn)";
            minColor = "#d946ef";
          } else if (activeMin === "Ls") {
            indexVal = b12 > 0 ? b8 / b12 : 0.0;
            minName = "Limestone Calcite (Ls)";
            minColor = "#cbd5e1";
          }

          let presenceLabel = "";
          let presenceColor = "";

          if (indexVal < thresh * 0.85) {
            presenceLabel = "LOW (BACKGROUND)";
            presenceColor = "#94a3b8";
          } else if (indexVal < thresh) {
            presenceLabel = "MODERATE (BASELINE)";
            presenceColor = "#cbd5e1";
          } else if (indexVal < thresh * 1.25) {
            presenceLabel = "HIGH (SIGNIFICANT)";
            presenceColor = minColor;
          } else {
            presenceLabel = "STRONG ANOMALY (CRITICAL)";
            presenceColor = "#f59e0b";
          }

          new maplibregl.Popup({ className: 'custom-map-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="map-popup-card">
                <div class="map-popup-header" style="color: ${minColor}; font-weight: bold; font-family: var(--font-display); font-size: 0.75rem; display: flex; align-items: center; gap: 6px; text-transform: uppercase;">
                  <span class="map-popup-dot" style="background-color: ${minColor}; width: 6px; height: 6px; border-radius: 50%; display: inline-block;"></span>
                  <strong>${minName} Spectrometry</strong>
                </div>
                <div class="map-popup-body" style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
                  <div class="map-popup-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; font-family: var(--font-mono);">
                    <span class="map-popup-label" style="color: var(--text-secondary);">SPECTRAL INDEX:</span>
                    <span class="map-popup-val" style="color: ${minColor}; font-weight: bold;">${indexVal.toFixed(3)}</span>
                  </div>
                  <div class="map-popup-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; font-family: var(--font-mono);">
                    <span class="map-popup-label" style="color: var(--text-secondary);">PRESENCE LEVEL:</span>
                    <span class="map-popup-val" style="color: ${presenceColor}; font-weight: bold;">${presenceLabel}</span>
                  </div>
                  <div class="map-popup-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; font-family: var(--font-mono);">
                    <span class="map-popup-label" style="color: var(--text-secondary);">THRESHOLD LIMIT:</span>
                    <span class="map-popup-val" style="color: ${indexVal >= thresh ? minColor : '#94a3b8'}; font-weight: bold;">
                      ${indexVal >= thresh ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div class="map-popup-divider" style="height: 1px; background: rgba(255, 255, 255, 0.08); margin: 4px 0;"></div>
                  <div class="map-popup-coords" style="font-size: 0.6rem; font-family: var(--font-mono); color: var(--text-muted); text-align: right;">
                    COORD: ${clickLat.toFixed(4)}°, ${clickLng.toFixed(4)}°
                  </div>
                </div>
              </div>
            `)
            .addTo(map);
        }
      }
    });

    return () => {
      map.remove();
    };
  }, []);

  // 4. Render asset marker pins on map via GeoJSON source
  useEffect(() => {
    const map = mapRef.current;
    if (!map || assets.length === 0) return;

    const syncAssetsLayers = () => {
      const features = assets.map(asset => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [asset.longitude, asset.latitude]
        },
        properties: {
          id: asset.id,
          name: asset.name,
          mineral: asset.mineral,
          country: asset.country
        }
      }));

      const geojson = { type: 'FeatureCollection', features };
      const source = map.getSource('assets-source');

      if (source) {
        source.setData(geojson);
      } else {
        if (map.isStyleLoaded()) {
          createAssetsLayers(geojson);
        } else {
          map.once('idle', () => createAssetsLayers(geojson));
        }
      }
    };

    const createAssetsLayers = (geojson) => {
      if (map.getSource('assets-source')) return;

      map.addSource('assets-source', {
        type: 'geojson',
        data: geojson
      });

      // Ambient outer glowing ring
      map.addLayer({
        id: 'assets-layer-glow',
        type: 'circle',
        source: 'assets-source',
        paint: {
          'circle-radius': 9,
          'circle-color': [
            'match',
            ['get', 'mineral'],
            'Fe', '#f97316',
            'Al', '#06b6d4',
            'Cu', '#10b981',
            'Au', '#eab308',
            'Mn', '#d946ef',
            'Ls', '#cbd5e1',
            '#6366f1'
          ],
          'circle-opacity': 0.35,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Core clickable center pin
      map.addLayer({
        id: 'assets-layer-core',
        type: 'circle',
        source: 'assets-source',
        paint: {
          'circle-radius': 4.5,
          'circle-color': [
            'match',
            ['get', 'mineral'],
            'Fe', '#f97316',
            'Al', '#06b6d4',
            'Cu', '#10b981',
            'Au', '#eab308',
            'Mn', '#d946ef',
            'Ls', '#cbd5e1',
            '#6366f1'
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Click on dot directly flies & runs GEE composite
      map.on('click', 'assets-layer-core', (e) => {
        if (e.features && e.features.length > 0) {
          const props = e.features[0].properties;
          const assetId = props.id;
          const currentAssets = assetsRef.current;
          const matchedAsset = currentAssets.find(a => a.id === assetId);
          if (matchedAsset && selectAssetRef.current) {
            selectAssetRef.current(matchedAsset);
          }
        }
      });

      // Pointer changes
      map.on('mouseenter', 'assets-layer-core', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'assets-layer-core', () => { map.getCanvas().style.cursor = ''; });

      // Apply initial toggle property
      const visibility = showAssetMarkers ? 'visible' : 'none';
      map.setLayoutProperty('assets-layer-core', 'visibility', visibility);
      map.setLayoutProperty('assets-layer-glow', 'visibility', visibility);
    };

    syncAssetsLayers();
  }, [assets]);

  // 5. Toggle asset location markers visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visibility = showAssetMarkers ? 'visible' : 'none';

    if (map.getLayer('assets-layer-core')) {
      map.setLayoutProperty('assets-layer-core', 'visibility', visibility);
    }
    if (map.getLayer('assets-layer-glow')) {
      map.setLayoutProperty('assets-layer-glow', 'visibility', visibility);
    }
  }, [showAssetMarkers]);

  // 5.1 Toggle geographical labels visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visibility = showGeoLabels ? 'visible' : 'none';

    if (map.getLayer('esri-boundaries-layer')) {
      map.setLayoutProperty('esri-boundaries-layer', 'visibility', visibility);
    }
  }, [showGeoLabels]);

  // 5.2 Toggle active spectral overlay visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visibility = showSpectralOverlay ? 'visible' : 'none';

    if (map.getLayer('spectral-layer')) {
      map.setLayoutProperty('spectral-layer', 'visibility', visibility);
    }
  }, [showSpectralOverlay]);

  // 6. Set up Web Worker for pixel math processing
  useEffect(() => {
    // Instantiate Web Worker
    workerRef.current = new Worker(
      new URL('./spectral.worker.js', import.meta.url),
      { type: 'module' }
    );

    // Listen to worker messages
    workerRef.current.onmessage = (e) => {
      const { rgbaArray, countAbove, percentage, averageValue, maxValue, minValue, error } = e.data;
      
      if (error) {
        console.error("Worker error:", error);
        return;
      }

      setPixelStats({
        percentage,
        countAbove,
        averageValue,
        maxValue,
        minValue
      });

      // Render the RGBA grid directly onto MapLibre as a dynamic Image layer
      updateMapLayer(rgbaArray);
      
      // Update distribution chart
      drawDistributionChart(rgbaArray, selectedMineral, debouncedThreshold, maxValue);
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [selectedMineral]); // Recreate listener when active mineral color style changes

  // Trigger worker computation when pixels, mineral, or thresholds change
  useEffect(() => {
    if (pixelsDataRef.current && workerRef.current) {
      workerRef.current.postMessage({
        pixels: pixelsDataRef.current,
        mineral: selectedMineral,
        threshold: debouncedThreshold,
        width: 100,
        height: 100
      });
    }
  }, [selectedMineral, debouncedThreshold, dataVersion]);

  // 7. Fetch raw band pixels from FastAPI backend
  const fetchSpectralData = (lat, lng) => {
    setTelemetry(prev => ({ ...prev, status: 'Fetching satellite bands...' }));
    
    fetch(`${API_BASE_URL}/api/spectral-data?lat=${lat}&lng=${lng}&radius_km=10.0`)
      .then(res => res.json())
      .then(data => {
        bboxRef.current = data.bbox;
        pixelsDataRef.current = data.pixels;

        setSensorStats({
          cloudCover: data.telemetry.cloud_cover_pct,
          processingTime: data.telemetry.processing_time_ms,
          sensor: data.telemetry.sensor,
          nearestAssetName: data.telemetry.nearest_asset_name,
          nearestAssetDist: data.telemetry.nearest_asset_dist_km
        });

        // Trigger worker processing by updating rendering version key
        setDataVersion(prev => prev + 1);
        
        setTelemetry(prev => ({ ...prev, status: 'Composite rendered.' }));
      })
      .catch(err => {
        console.error('Failed to fetch spectral data:', err);
        setTelemetry(prev => ({ ...prev, status: 'Failed to fetch spectral composite.' }));
      });
  };

  // 8. Imperative Map Update: Drapes computed overlay canvas over 10km grid
  const updateMapLayer = (rgbaArray) => {
    const map = mapRef.current;
    if (!map || !bboxRef.current) return;

    // Create 100x100 canvas offscreen to parse image
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(100, 100);
    
    imgData.data.set(rgbaArray);
    ctx.putImageData(imgData, 0, 0);

    const dataUrl = canvas.toDataURL();
    const bbox = bboxRef.current; // [min_lat, min_lng, max_lat, max_lng]

    const sourceId = 'spectral-overlay';
    const layerId = 'spectral-layer';

    // Maplibre coordinates: [top-left, top-right, bottom-right, bottom-left]
    const coords = [
      [bbox[1], bbox[2]], // top-left [min_lng, max_lat]
      [bbox[3], bbox[2]], // top-right [max_lng, max_lat]
      [bbox[3], bbox[0]], // bottom-right [max_lng, min_lat]
      [bbox[1], bbox[0]]  // bottom-left [min_lng, min_lat]
    ];

    let source = map.getSource(sourceId);
    if (!source) {
      map.addSource(sourceId, {
        type: 'image',
        url: dataUrl,
        coordinates: coords
      });
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': 0.85,
          'raster-fade-duration': 150
        }
      });
    } else {
      source.updateImage({
        url: dataUrl,
        coordinates: coords
      });
    }
  };

  // 9. Render dynamic HTML Canvas histogram chart for index distribution
  const drawDistributionChart = (rgbaArray, mineral, threshold, maxVal) => {
    if (!chartCanvasRef.current) return;
    const canvas = chartCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Count value frequencies in rgbaArray alphas (which represent strength)
    const bins = new Array(25).fill(0);
    
    // Extract alphas from the RGBA pixel array
    for (let i = 3; i < rgbaArray.length; i += 4) {
      const alpha = rgbaArray[i];
      if (alpha > 0) {
        const binIndex = Math.min(24, Math.floor((alpha / 256) * 25));
        bins[binIndex]++;
      } else {
        bins[0]++; // background pixels
      }
    }

    const maxCount = Math.max(...bins.slice(1), 1); // skip background for scaling

    // Render bars
    const barWidth = width / bins.length;
    const activeColor = mineralConfig[mineral].color;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < bins.length; i++) {
      const count = bins[i];
      const barHeight = i === 0 ? (count / 10000) * (height / 2) : (count / maxCount) * (height * 0.85);
      const x = i * barWidth;
      const y = height - barHeight;

      // Color coding: background vs above threshold index signature
      if (i === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      } else {
        ctx.fillStyle = activeColor;
        ctx.globalAlpha = 0.3 + (i / bins.length) * 0.7;
      }

      ctx.fillRect(x, y, barWidth - 1.5, barHeight);
      ctx.globalAlpha = 1.0;
    }

    // Draw reference threshold line
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(width * 0.4, 0);
    ctx.lineTo(width * 0.4, height);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // 10. Execute Smooth Cinematic flight casing path (5.0 seconds, 55 pitch)
  const flyToCoordinates = (lat, lng) => {
    const map = mapRef.current;
    if (!map) return;

    // Cancel auto rotation
    isRotatingRef.current = false;

    map.flyTo({
      center: [lng, lat],
      zoom: 12.0,
      pitch: 55,
      bearing: 15,
      duration: 5000, // Adjusted to 5.0 seconds as requested (cinematic balance)
      essential: true
    });
  };

  // 11. Location Autocomplete Fetch: triggers on query typing
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    // Debounce geocoding request by 300ms
    const delayDebounce = setTimeout(() => {
      // Local match in verified database
      const localMatches = assetsRef.current
        .filter(asset => 
          asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          asset.country.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 3) // Limit to top 3 database matches
        .map(asset => ({
          display_name: `${asset.name} (${asset.mineral} Mine, ${asset.country})`,
          lat: asset.latitude,
          lng: asset.longitude,
          isAsset: true,
          asset: asset
        }));

      fetch(`${API_BASE_URL}/api/geocode?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.json())
        .then(data => {
          // Merge local database asset matches with Nominatim coordinates results
          const merged = [...localMatches, ...data];
          setSuggestions(merged);
          setShowSuggestions(true);
          setActiveSuggestionIndex(-1);
        })
        .catch(err => {
          console.error("Failed to fetch suggestions:", err);
          setSuggestions(localMatches); // Fallback to local database matches
          setShowSuggestions(localMatches.length > 0);
        });
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Click outside search container to close dropdown suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Click outside layers dropdown to close it
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (layersDropdownRef.current && !layersDropdownRef.current.contains(e.target)) {
        setShowLayersDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 12. Execute direct search (submit form fallback)
  const executeSearch = (e) => {
    if (e) e.preventDefault();
    if (!searchQuery) return;

    // Immediately hide suggestions list on submit
    setShowSuggestions(false);
    setSuggestions([]);

    setSearchLoading(true);
    setTelemetry(prev => ({ ...prev, status: 'Searching locations...' }));

    fetch(`${API_BASE_URL}/api/geocode?q=${encodeURIComponent(searchQuery)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const first = data[0];
          handleSelectSuggestion(first);
        } else {
          setTelemetry(prev => ({ ...prev, status: 'Location not found.' }));
          alert("Location not found. Please try a broader term.");
        }
      })
      .catch(err => {
        console.error("Geocoding failed:", err);
        setTelemetry(prev => ({ ...prev, status: 'Search request error.' }));
      })
      .finally(() => {
        setSearchLoading(false);
      });
  };

  // 13. Handle selection of a suggested location
  const handleSelectSuggestion = (suggestion) => {
    setSearchQuery(suggestion.display_name);
    setSuggestions([]);
    setShowSuggestions(false);

    if (suggestion.isAsset) {
      // Direct selection for verified assets
      selectAsset(suggestion.asset);
    } else {
      setSelectedAsset(null); // Clear active database mine since it's a geocode search
      setTelemetry(prev => ({ 
        ...prev, 
        status: `Flying to: ${suggestion.display_name.split(',')[0]}...` 
      }));
      // Collapse panels on mobile to clear the screen
      if (window.innerWidth <= 768) {
        setShowSidebar(false);
        setShowControls(false);
      }
      // Perform smooth flying easing
      flyToCoordinates(suggestion.lat, suggestion.lng);
      // Fetch multi-spectral simulated Sentinel-2 composite
      fetchSpectralData(suggestion.lat, suggestion.lng);
    }
  };

  // Keyboard navigation inside geocoding suggestions list
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : -1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[activeSuggestionIndex]);
      } else if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      } else {
        executeSearch();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // 14. Handle Asset Selection from database click
  const selectAsset = (asset) => {
    setSelectedAsset(asset);
    setSelectedMineral(asset.mineral); // Switch to matching mineral overlay
    setTelemetry(prev => ({ ...prev, status: `Targeting: ${asset.name}...` }));
    
    // Auto collapse left panel on mobile to let user see cinematic flight & composite overlay
    if (window.innerWidth <= 768) {
      setShowSidebar(false);
    }
    
    // Flight
    flyToCoordinates(asset.latitude, asset.longitude);
    
    // GEE Band call
    fetchSpectralData(asset.latitude, asset.longitude);
  };

  // 15. Toggle projection mode
  const toggleProjection = () => {
    const map = mapRef.current;
    if (!map) return;

    const currentProj = telemetry.projection;
    const nextProj = currentProj === 'globe' ? 'mercator' : 'globe';
    
    map.setProjection({ type: nextProj });
    setTelemetry(prev => ({ ...prev, projection: nextProj }));
  };

  // Filter assets list dynamically based on search and filters
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(dbSearch.toLowerCase()) || 
                          asset.country.toLowerCase().includes(dbSearch.toLowerCase()) ||
                          asset.id.toLowerCase().includes(dbSearch.toLowerCase());
    
    const matchesMineral = dbFilter === 'ALL' || asset.mineral === dbFilter;
    return matchesSearch && matchesMineral;
  });

  const activeColor = mineralConfig[selectedMineral].color;

  return (
    <div className="app-container">
      
      {/* ── MAP CANVAS CONTAINER ── */}
      <div 
        ref={mapContainerRef} 
        className="map-viewport" 
      />

      {/* ── LOGIN OVERLAY ── */}
      {!currentUser && (
        <div className="login-overlay">
          <div className="login-card glass-panel">
            <div className="login-header">
              <div className="login-logo-container">
                <img src="/logo.png" className="login-logo-img" alt="SpectraMining AI Logo" />
                <div className="login-logo-glow" />
              </div>
              <div className="login-title">SPECTRAMINING AI</div>
              <div className="login-subtitle">
                {authMode === 'login' 
                  ? 'Access multi-spectral satellite overlays & mineral observations' 
                  : 'Register for SpectraMining observations'}
              </div>
            </div>

            {authError && (
              <div className="login-error-alert">
                {authError}
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="login-form">
              <div className="input-group">
                <label className="input-label">Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" />
                  <input 
                    type="email" 
                    placeholder="name@company.com" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                    className="input-field with-icon"
                    disabled={authLoading}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                    className="input-field with-icon"
                    disabled={authLoading}
                  />
                </div>
              </div>

              <button type="submit" disabled={authLoading} className="login-btn">
                {authLoading ? (
                  <RefreshCw className="animate-spin" style={{ width: '16px', height: '16px' }} />
                ) : (
                  <>
                    <LogIn style={{ width: '16px', height: '16px' }} />
                    <span>{authMode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  </>
                )}
              </button>
            </form>

            <div className="login-divider">OR</div>

            <button onClick={handleGoogleLogin} disabled={authLoading} className="google-btn">
              <svg className="google-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="login-switch-text">
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <span 
                className="login-switch-link"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              >
                {authMode === 'login' ? 'Sign Up' : 'Sign In'}
              </span>
            </div>
          </div>
        </div>
      )}

      {currentUser && (
        <>
          {/* Map Grid overlay coordinates */}
          <div className="map-telemetry glass-panel">
        <div>LAT: <span>{telemetry.lat}°</span></div>
        <div>LNG: <span>{telemetry.lng}°</span></div>
        <div>ZOOM: <span>{telemetry.zoom}</span></div>
        <div>PITCH: <span>{telemetry.pitch}°</span></div>
        <div>BEARING: <span>{telemetry.bearing}°</span></div>
        <div className="map-telemetry-proj">
          <Globe className="map-telemetry-proj-icon animate-spin-slow" />
          <span style={{ color: '#10b981' }}>{telemetry.projection}</span>
        </div>
      </div>

      {/* Legend bar */}
      <div className="map-legend glass-panel">
        <span className="map-legend-label">SIGNATURE STRENGTH</span>
        <div className="map-legend-bar-wrapper">
          <span className="map-legend-bar-min">MIN</span>
          <div 
            className="map-legend-gradient-line"
            style={{
              background: `linear-gradient(to right, transparent, ${activeColor})`
            }}
          />
          <span className="map-legend-bar-min" style={{ color: activeColor }}>MAX</span>
        </div>
      </div>

      {/* ── TOP HEADLINE NAVIGATION (LEFT & RIGHT) ── */}
      <div className="top-nav-wrapper">
        
        {/* Brand Logo & Status */}
        <div className="brand-card glass-panel">
          <div className="brand-logo-container">
            <img src="/logo.png" className="brand-logo-img" alt="SpectraMining AI Logo" />
            <div className="brand-logo-glow" />
          </div>
          <div className="brand-text">
            <div className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              SPECTRAMINING AI
              <span className="brand-version-badge">v1.1.0</span>
            </div>
            <div className="brand-status-row">
              <span className="brand-status-dot pulsing-indicator" />
              STATUS: <span style={{ color: '#e2e8f0' }}>{telemetry.status}</span>
            </div>
          </div>
        </div>

        {/* Map view tools */}
        <div className="top-tools">
          {/* Map Layer Controls & Filters */}
          <div className="layers-dropdown-container" ref={layersDropdownRef}>
            <button 
              onClick={() => {
                setShowLayersDropdown(prev => {
                  const next = !prev;
                  if (next) {
                    setShowControls(false);
                    if (window.innerWidth <= 1024) {
                      setShowSidebar(false);
                    }
                  }
                  return next;
                });
              }}
              title="Map Layers & Filters"
              className="tool-btn"
              style={{
                borderColor: showLayersDropdown ? '#6366f1' : 'var(--panel-border)',
                color: showLayersDropdown ? '#818cf8' : 'var(--text-secondary)'
              }}
            >
              <Layers style={{ width: '18px', height: '18px' }} />
            </button>
            
            {showLayersDropdown && (
              <div className="layers-dropdown glass-panel">
                <div className="layers-dropdown-header">
                  <Layers className="layers-dropdown-header-icon" />
                  <span>Map Filters</span>
                </div>
                
                <label className="layer-toggle-item">
                  <input 
                    type="checkbox" 
                    checked={showGeoLabels} 
                    onChange={(e) => setShowGeoLabels(e.target.checked)} 
                  />
                  <div className="custom-checkbox-indicator" />
                  <div className="layer-toggle-info">
                    <span className="layer-toggle-title">Geographical Locations</span>
                    <span className="layer-toggle-desc">Show borders, countries, cities</span>
                  </div>
                </label>

                <label className="layer-toggle-item">
                  <input 
                    type="checkbox" 
                    checked={showAssetMarkers} 
                    onChange={(e) => setShowAssetMarkers(e.target.checked)} 
                  />
                  <div className="custom-checkbox-indicator" />
                  <div className="layer-toggle-info">
                    <span className="layer-toggle-title">Mining Operations</span>
                    <span className="layer-toggle-desc">Show verified operations</span>
                  </div>
                </label>

                <label className="layer-toggle-item">
                  <input 
                    type="checkbox" 
                    checked={showSpectralOverlay} 
                    onChange={(e) => setShowSpectralOverlay(e.target.checked)} 
                    disabled={!pixelsDataRef.current}
                  />
                  <div className="custom-checkbox-indicator" />
                  <div className="layer-toggle-info">
                    <span className="layer-toggle-title" style={{ color: !pixelsDataRef.current ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      Spectral Composite
                    </span>
                    <span className="layer-toggle-desc">Show active target composite</span>
                  </div>
                </label>
              </div>
            )}
          </div>
          
          <button 
            onClick={toggleProjection}
            title="Toggle Projection Mode (3D Globe / Mercator Flat)"
            className="tool-btn"
          >
            <Globe style={{ width: '18px', height: '18px' }} />
          </button>
          
          <button 
            onClick={() => {
              const map = mapRef.current;
              if (map) map.easeTo({ pitch: 0, bearing: 0, duration: 1500 });
            }}
            title="Reset Map Orientation"
            className="tool-btn"
          >
            <Compass style={{ width: '18px', height: '18px' }} />
          </button>

          <button 
            onClick={handleLogout}
            title="Sign Out"
            className="tool-btn logout-tool-btn"
            style={{ borderColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}
          >
            <LogOut style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

      </div>

      {/* ── CENTERED AUTOCOMPLETE SEARCH BAR ── */}
      <div className="search-bar-center-container">
        <form 
          onSubmit={executeSearch} 
          className="search-form glass-panel"
          ref={searchContainerRef}
        >
          <Search className="search-icon" />
          <div className="suggestions-dropdown-container">
            <input 
              type="text" 
              placeholder="Search city, coordinates or geological basin..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              className="search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="search-clear-btn"
                title="Clear Search"
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            )}
            
            {/* suggestions autocomplete dropdown list */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={`suggestion-item ${index === activeSuggestionIndex ? 'active' : ''}`}
                  >
                    {suggestion.isAsset ? (
                      <Database className="suggestion-item-icon" style={{ color: '#818cf8' }} />
                    ) : (
                      <MapPin className="suggestion-item-icon" />
                    )}
                    <span className="suggestion-item-text" title={suggestion.display_name}>
                      {suggestion.isAsset ? (
                        <span style={{ color: '#ffffff', fontWeight: 'bold' }}>
                          {suggestion.display_name}
                        </span>
                      ) : (
                        suggestion.display_name
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button 
            type="submit" 
            disabled={searchLoading}
            className="search-btn"
          >
            {searchLoading ? (
              <RefreshCw className="animate-spin" style={{ width: '12px', height: '12px' }} />
            ) : 'Search'}
          </button>
        </form>
      </div>

      {/* ── STANDALONE SIDEBAR TOGGLE BUTTON ── */}
      <button 
        onClick={() => {
          setShowSidebar(prev => {
            const next = !prev;
            if (next) {
              setShowLayersDropdown(false);
              if (window.innerWidth <= 1024) {
                setShowControls(false);
              }
            }
            return next;
          });
        }}
        className={`sidebar-toggle-btn glass-panel ${showSidebar ? 'active' : ''}`}
        title={showSidebar ? "Hide Global Asset Database" : "Show Global Asset Database"}
      >
        {showSidebar ? <X style={{ width: '18px', height: '18px' }} /> : <Database style={{ width: '18px', height: '18px' }} />}
      </button>

      {/* ── STANDALONE CONTROLS TOGGLE BUTTON ── */}
      <button 
        onClick={() => {
          setShowControls(prev => {
            const next = !prev;
            if (next) {
              setShowLayersDropdown(false);
              if (window.innerWidth <= 1024) {
                setShowSidebar(false);
              }
            }
            return next;
          });
        }}
        className={`controls-toggle-btn glass-panel ${showControls ? 'active' : ''}`}
        title={showControls ? "Hide Matrix Controls" : "Show Matrix Controls"}
      >
        {showControls ? <X style={{ width: '18px', height: '18px' }} /> : <Sliders style={{ width: '18px', height: '18px' }} />}
      </button>

      {/* ── LEFT SIDEBAR: MINING EXPLORER ── */}
      <div className={`sidebar ${showSidebar ? '' : 'collapsed'}`}>
        
        {/* verified mining operations db panel */}
        <div className="panel-card glass-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* db header */}
          <div className="db-panel-header">
            <div className="db-title-row">
              <div className="db-title">
                <Database style={{ width: '16px', height: '16px', color: '#818cf8' }} />
                <span>Global Asset Database</span>
              </div>
              <span className="db-count-badge">
                {assets.length} OPERATIONS
              </span>
            </div>

            {/* Asset search bar */}
            <input 
              type="text" 
              placeholder="Filter assets by name/country..."
              value={dbSearch}
              onChange={(e) => setDbSearch(e.target.value)}
              className="db-search-input"
            />

            {/* Mineral quick filter dropdown */}
            <div className="db-filter-select-container">
              <label htmlFor="db-mineral-filter" className="db-filter-label">FILTER BY MINERAL</label>
              <select
                id="db-mineral-filter"
                value={dbFilter}
                onChange={(e) => setDbFilter(e.target.value)}
                className="db-filter-select"
              >
                <option value="ALL">All Minerals</option>
                <option value="Cu">Copper Alteration (Cu)</option>
                <option value="Fe">Iron Ore (Fe)</option>
                <option value="Al">Aluminum / Bauxite (Al)</option>
                <option value="Au">Gold Alteration (Au)</option>
                <option value="Mn">Manganese Oxide (Mn)</option>
                <option value="Ls">Limestone Calcite (Ls)</option>
              </select>
            </div>
          </div>

          {/* database list scroll */}
          <div className="db-list">
            {filteredAssets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                No matching mineral operations
              </div>
            ) : (
              filteredAssets.map((asset) => {
                const isSelected = selectedAsset?.id === asset.id;
                const mColor = mineralConfig[asset.mineral].color;
                
                return (
                  <div 
                    key={asset.id}
                    onClick={() => selectAsset(asset)}
                    className={`db-item ${isSelected ? 'selected' : ''}`}
                    style={{
                      borderLeft: isSelected ? `4px solid ${mColor}` : '1px solid transparent'
                    }}
                  >
                    <div className="db-item-info">
                      <div className="db-item-name">
                        {asset.name}
                      </div>
                      <div className="db-item-meta">
                        <MapPin className="db-item-meta-icon" />
                        <span>{asset.country}</span>
                        <span>•</span>
                        <span>{asset.latitude.toFixed(2)}, {asset.longitude.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* mineral tag badge */}
                    <span 
                      className="db-item-badge"
                      style={{ 
                        color: mColor, 
                        borderColor: `${mColor}40`,
                        backgroundColor: `${mColor}10` 
                      }}
                    >
                      {asset.mineral}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected asset specifications sheet */}
        {selectedAsset ? (
          <div className="panel-card glass-panel specs-sheet animate-fade-in">
            <div className="specs-title-row">
              <div className="specs-title">
                <Award style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                <span>Site Specifications</span>
              </div>
              <span className="specs-id">{selectedAsset.id}</span>
            </div>

            <div className="specs-grid">
              <div className="specs-block">
                <div className="specs-block-label">MINERAL SYSTEM</div>
                <div className="specs-block-value" style={{ color: mineralConfig[selectedAsset.mineral].color }}>
                  {selectedAsset.mineral === 'Cu' ? 'Copper (Cu)' : selectedAsset.mineral === 'Fe' ? 'Iron (Fe)' : selectedAsset.mineral === 'Al' ? 'Aluminum (Al)' : selectedAsset.mineral === 'Au' ? 'Gold (Au)' : selectedAsset.mineral === 'Mn' ? 'Manganese (Mn)' : 'Limestone (Ls)'}
                </div>
              </div>
              <div className="specs-block">
                <div className="specs-block-label">ESTABLISHED</div>
                <div className="specs-block-value">{selectedAsset.established}</div>
              </div>
              <div className="specs-block">
                <div className="specs-block-label">RESERVE SCALE</div>
                <div className="specs-block-value" title={selectedAsset.reserve_size}>
                  {selectedAsset.reserve_size}
                </div>
              </div>
              <div className="specs-block">
                <div className="specs-block-label">MAX DEPTH</div>
                <div className="specs-block-value">{selectedAsset.depth_m} meters</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel-card glass-panel specs-sheet" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
            No active target. Select an operation from the database list above to fly camera and run spectral calculations.
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL: CONTROLS & SPECTRAL MATRIX ── */}
      <div className={`controls-panel ${showControls ? '' : 'collapsed'}`}>
        
        {/* Layer Matrix Controller */}
        <div className="panel-card glass-panel">
          <div className="panel-card-inner">
            
            <div className="panel-card-title">
              <Sliders style={{ width: '16px', height: '16px', color: '#22d3ee' }} />
              <span>Index Matrix Selector</span>
            </div>

            {/* Mineral selector tab grid */}
            <div className="tabs-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {Object.keys(mineralConfig).map((minKey) => {
                const config = mineralConfig[minKey];
                const isSelected = selectedMineral === minKey;
                return (
                  <button
                    key={minKey}
                    onClick={() => setSelectedMineral(minKey)}
                    className={`tab-btn ${isSelected ? 'selected' : ''}`}
                    style={{
                      borderTop: `3px solid ${isSelected ? config.color : 'transparent'}`
                    }}
                  >
                    <span className="tab-btn-label">INDEX</span>
                    <span className="tab-btn-symbol" style={{ color: config.color }}>
                      {minKey}
                    </span>
                    <span className="tab-btn-desc">
                      {config.shortDesc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Formula Info card */}
            <div className="formula-card">
              <Info className="formula-card-icon" />
              <div className="formula-card-content">
                <span className="formula-card-label">Spectral Formula (ESA Sentinel-2)</span>
                <span className="formula-card-math" style={{ color: activeColor }}>
                  {mineralConfig[selectedMineral].formula}
                </span>
                <span className="formula-card-desc">
                  {selectedMineral === 'Fe' && 'Highlights hematite and magnetite formations by Red absorption band contrast against Blue.'}
                  {selectedMineral === 'Al' && 'Targets Al-OH hydroxyl compound absorption differences in Short-Wave Infrared bands (SWIR1/SWIR2).'}
                  {selectedMineral === 'Cu' && 'Calculates alteration systems and stress responses across Visible Green, Red, and Near-Infrared.'}
                  {selectedMineral === 'Au' && 'Highlights hydrothermal clay/sericite alteration zones associated with gold mineralization using SWIR1 and NIR reflectance ratios.'}
                  {selectedMineral === 'Mn' && 'Identifies dark manganese oxides/hydroxides by taking the SWIR1 reflectance ratio relative to Red band absorption.'}
                  {selectedMineral === 'Ls' && 'Identifies limestone and carbonate mineral deposits using the Calcite/Carbonate absorption index (NIR / SWIR2).'}
                </span>
              </div>
            </div>

            {/* Threshold slider */}
            <div className="slider-container">
              <div className="slider-label-row">
                <span className="slider-label">INDEX THRESHOLD FILTER</span>
                <span className="slider-val-badge">
                  &ge; {sliderVal.toFixed(2)}
                </span>
              </div>

              <input 
                type="range"
                min={mineralConfig[selectedMineral].min}
                max={mineralConfig[selectedMineral].max}
                step="0.05"
                value={sliderVal}
                onChange={(e) => setSliderVal(parseFloat(e.target.value))}
              />
              
              <div className="slider-range-labels">
                <span>MIN ({mineralConfig[selectedMineral].min})</span>
                <span>MAX ({mineralConfig[selectedMineral].max})</span>
              </div>
            </div>

          </div>
        </div>

        {/* Dynamic Web Worker Telemetry summary */}
        <div className="panel-card glass-panel" style={{ padding: '16px' }}>
          <div className="telemetry-stats-header" style={{ marginBottom: '12px' }}>
            <div className="panel-card-title">
              <Cpu style={{ width: '16px', height: '16px', color: '#c084fc' }} />
              <span>Worker Engine Telemetry</span>
            </div>
            <span className="telemetry-engine-badge">
              {pixelsDataRef.current ? 'ASYNCHRONOUS' : 'STANDBY'}
            </span>
          </div>

          <div className="telemetry-stats">
            <div className="stats-card">
              <div className="stats-card-label">ATMOS CLOUD COVER</div>
              <div className="stats-card-val" style={{ color: '#10b981' }}>{pixelsDataRef.current ? `${sensorStats.cloudCover}%` : '0.00%'}</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">WORKER MATH LATENCY</div>
              <div className="stats-card-val" style={{ color: '#06b6d4' }}>{pixelsDataRef.current ? `${sensorStats.processingTime} ms` : '0.00 ms'}</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">COMPOSITING PLATFORM</div>
              <div className="stats-card-val" style={{ color: '#cbd5e1' }} title={sensorStats.sensor}>
                {pixelsDataRef.current ? sensorStats.sensor : 'None Loaded'}
              </div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">NEAREST KNOWN ASSET</div>
              <div className="stats-card-val" style={{ color: '#cbd5e1' }} title={sensorStats.nearestAssetName}>
                {pixelsDataRef.current ? (sensorStats.nearestAssetName || 'None Close') : 'None Loaded'}
              </div>
            </div>
          </div>
        </div>

        {/* Pixel signature matrix statistics and distribution chart */}
        <div className="panel-card glass-panel" style={{ padding: '20px' }}>
          <div className="db-title-row" style={{ marginBottom: '12px' }}>
            <div className="panel-card-title">
              <TrendingUp style={{ width: '16px', height: '16px', color: '#34d399' }} />
              <span>Pixel Density Diagnostics</span>
            </div>
            <div className="analytics-live-indicator">
              <span className={`analytics-live-dot ${pixelsDataRef.current ? '' : 'pulsing-indicator'}`} style={{ backgroundColor: pixelsDataRef.current ? '#10b981' : '#64748b' }} />
              <span>{pixelsDataRef.current ? 'LIVE' : 'STANDBY'}</span>
            </div>
          </div>

          {/* Core percentage metric */}
          <div className="percentage-container">
            <div className="percentage-label-col">
              <span className="percentage-label">DETECTION COVERAGE AREA</span>
              <span className="percentage-val" style={{ color: pixelsDataRef.current ? activeColor : 'var(--text-muted)' }}>
                {pixelStats.percentage}%
              </span>
            </div>
            <div className="percentage-count-col">
              <div className="percentage-count-val">{pixelStats.countAbove.toLocaleString()} px</div>
              <div className="percentage-count-total">OF 10,000 PIXELS</div>
            </div>
          </div>

          {/* Histogram distribution */}
          <div className="histogram-container">
            <span className="histogram-label">Spectral Signature Distribution (Density)</span>
            <div className="histogram-canvas-wrapper">
              <canvas 
                ref={chartCanvasRef} 
                width="330" 
                height="80" 
                className="histogram-canvas"
              />
            </div>
            <div className="histogram-range-row">
              <span>BACKGROUND (LOW)</span>
              <span className="histogram-marker">★ THRESHOLD LIMIT</span>
              <span>PEAK ({pixelStats.maxValue})</span>
            </div>
          </div>

          {/* Metrics summary */}
          <div className="metrics-grid">
            <div className="metric-block">
              <div className="metric-block-label">MIN INDEX</div>
              <div className="metric-block-val" style={{ color: '#cbd5e1' }}>{pixelStats.minValue}</div>
            </div>
            <div className="metric-block">
              <div className="metric-block-label">AVG INDEX</div>
              <div className="metric-block-val" style={{ color: '#cbd5e1' }}>{pixelStats.averageValue}</div>
            </div>
            <div className="metric-block">
              <div className="metric-block-label">MAX INDEX</div>
              <div className="metric-block-val" style={{ color: pixelsDataRef.current ? activeColor : '#cbd5e1' }}>
                {pixelStats.maxValue}
              </div>
            </div>
          </div>
        </div>

      </div>
      </>
      )}

    </div>
  );
}
