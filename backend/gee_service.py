# gee_service.py
import os
import ee
import time
import math
from typing import Dict, Any, Optional

# Track if GEE was successfully initialized and authenticated
IS_GEE_ACTIVE = False

def init_gee_service() -> bool:
    """
    Attempts to authenticate and initialize Google Earth Engine.
    Looks for service account credentials in standard environment variables
    or local keys/gee-key.json. Returns True if successful, False otherwise.
    """
    global IS_GEE_ACTIVE
    
    # Check if already active
    if IS_GEE_ACTIVE:
        return True
        
    # Potential credentials paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    possible_paths = [
        os.path.join(script_dir, "keys", "gee-key.json"),
        os.path.join(os.getcwd(), "keys", "gee-key.json"),
        os.path.join(script_dir, "gee-key.json"),
        os.path.join(os.getcwd(), "gee-key.json")
    ]
    
    # Try environment variables first
    ee_sa = os.environ.get("GEE_SERVICE_ACCOUNT")
    ee_key = os.environ.get("GEE_SERVICE_ACCOUNT_KEY") # raw JSON string
    
    try:
        if ee_sa and ee_key:
            print(f"[GEE] Authenticating via environment variables (Service Account: {ee_sa})...")
            # Write key to a temporary environment configuration or load directly
            import json
            key_dict = json.loads(ee_key)
            credentials = ee.ServiceAccountCredentials(ee_sa, key_data=key_dict)
            ee.Initialize(credentials)
            IS_GEE_ACTIVE = True
            print("[GEE] Active and initialized successfully.")
            return True
            
        # Try local files
        for path in possible_paths:
            if os.path.exists(path):
                print(f"[GEE] Authenticating via local key file: {path}...")
                credentials = ee.ServiceAccountCredentials(
                    email=None, # auto-detected from key file
                    key_file=path
                )
                ee.Initialize(credentials)
                IS_GEE_ACTIVE = True
                print("[GEE] Active and initialized successfully.")
                return True
                
        # Default fallback: attempt standard local system login credentials
        print("[GEE] No service account keys found. Attempting default user credentials...")
        ee.Initialize()
        IS_GEE_ACTIVE = True
        print("[GEE] Active using default user credentials.")
        return True
        
    except Exception as e:
        print(f"[GEE Warning] Authentication failed: {e}")
        print("[GEE Warning] Operating in FOSS local simulator fallback mode.")
        IS_GEE_ACTIVE = False
        return False

def mask_s2_clouds(image: ee.Image) -> ee.Image:
    """
    Strategy 3: Mask Clouds in a Single Pass
    Filters out cloud pixels using pre-computed QA60 metadata bits.
    """
    qa = image.select('QA60')
    
    # Bits 10 and 11 represent clouds and cirrus
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    
    # Make a binary mask where both bits are 0 (no clouds)
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0) \
             .And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
             
    # Apply mask and scale to typical 0-10000 range reflectance
    return image.updateMask(mask)

def fetch_live_composite_data(
    lat: float, 
    lng: float, 
    radius_km: float = 10.0,
    resolution_m: int = 200 # 200m scale for fast 100x100 preview grids in GEE
) -> Dict[str, Any]:
    """
    Implements Strategies 1, 2, 3, and 4 to query live Sentinel-2 L2A composites
    from the COPERNICUS/S2_SR_HARMONIZED dataset in Earth Engine.
    """
    if not IS_GEE_ACTIVE:
        raise RuntimeError("Earth Engine is not initialized. Cannot run live queries.")
        
    start_time = time.time()
    
    # -------------------------------------------------------------
    # Strategy 1: Spatial Constraints (Clip Early)
    # Define coordinate geometry and bounding box limits using local math
    # -------------------------------------------------------------
    lat_offset = radius_km / 111.0
    lng_offset = radius_km / (111.0 * abs(math.cos(math.radians(lat))))
    
    bbox = [
        lat - lat_offset, # min_lat
        lng - lng_offset, # min_lng
        lat + lat_offset, # max_lat
        lng + lng_offset  # max_lng
    ]
    
    geometry = ee.Geometry.Rectangle([
        bbox[1], bbox[0], # min_lng, min_lat
        bbox[3], bbox[2]  # max_lng, max_lat
    ])
    
    # -------------------------------------------------------------
    # Strategy 2: Temporal Constraints (Median Composite first)
    # -------------------------------------------------------------
    # Fetch 3 years timeline stack
    collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
        .filterBounds(geometry) \
        .filterDate('2023-01-01', '2026-06-01') \
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
        .map(mask_s2_clouds)
        
    # Collapse stack to single Median composite and clip immediately
    composite = collection.median().clip(geometry)
    
    # Select all required bands
    bands = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12']
    bands_image = composite.select(bands)
    
    # Reproject to Sentinel-2 original projection with the downsampled scale
    # to allow downsampling within the sampleRectangle call (since GEE Python SDK's
    # sampleRectangle does not directly take a scale parameter)
    proj = bands_image.select('B2').projection()
    reprojected = bands_image.reproject(crs=proj, scale=resolution_m)
    
    # -------------------------------------------------------------
    # Strategy 4: Downsample the Visualization Resolution
    # sampleRectangle extracts a pixel grid of values
    # -------------------------------------------------------------
    pixel_data = reprojected.sampleRectangle(
        region=geometry,
        defaultValue=0.0
    ).getInfo()
    
    properties = pixel_data.get('properties', {})
    
    # Extract bands arrays
    b2_arr = properties.get('B2', [])
    b3_arr = properties.get('B3', [])
    b4_arr = properties.get('B4', [])
    b8_arr = properties.get('B8', [])
    b11_arr = properties.get('B11', [])
    b12_arr = properties.get('B12', [])
    
    height = len(b2_arr)
    width = len(b2_arr[0]) if height > 0 else 0
    
    # Auto-detect if GEE returned floats (0-1) or scaled integers (0-10000).
    # If the max value in B2 is <= 10.0, we treat it as 0-1 float and scale by 10000.
    max_b2 = 0.0
    if height > 0 and width > 0:
        for r in range(height):
            for c in range(width):
                val = b2_arr[r][c]
                if val > max_b2:
                    max_b2 = val
    scale_factor = 10000.0 if max_b2 <= 10.0 else 1.0
    
    formatted_pixels = []
    for r in range(100):
        # Scale indices to 100x100 output grid
        target_r = min(height - 1, int((r / 100.0) * height)) if height > 0 else 0
        for c in range(100):
            target_c = min(width - 1, int((c / 100.0) * width)) if width > 0 else 0
            
            # Extract band values and apply scale factor
            b2_val = int((b2_arr[target_r][target_c] if target_r < height and target_c < width else 0.1) * scale_factor)
            b3_val = int((b3_arr[target_r][target_c] if target_r < height and target_c < width else 0.1) * scale_factor)
            b4_val = int((b4_arr[target_r][target_c] if target_r < height and target_c < width else 0.1) * scale_factor)
            b8_val = int((b8_arr[target_r][target_c] if target_r < height and target_c < width else 0.1) * scale_factor)
            b11_val = int((b11_arr[target_r][target_c] if target_r < height and target_c < width else 0.1) * scale_factor)
            b12_val = int((b12_arr[target_r][target_c] if target_r < height and target_c < width else 0.1) * scale_factor)
            
            formatted_pixels.append([b2_val, b3_val, b4_val, b8_val, b11_val, b12_val])
            
    processing_time = (time.time() - start_time) * 1000.0
    
    # Extract cloud metadata
    avg_cloud_cover = 5.0
    try:
        first_img = collection.first()
        avg_cloud_cover = float(first_img.get('CLOUDY_PIXEL_PERCENTAGE').getInfo())
    except:
        pass
        
    return {
        "lat": lat,
        "lng": lng,
        "bbox": bbox,
        "width": 100,
        "height": 100,
        "pixels": formatted_pixels,
        "telemetry": {
            "cloud_cover_pct": round(avg_cloud_cover, 2),
            "processing_time_ms": round(processing_time, 2),
            "sensor": "Sentinel-2 L2A (Live GEE)",
            "composite_type": "3-Year Median (COPERNICUS/S2_SR_HARMONIZED)",
            "google_earth_engine_compliance": "Copernicus Live GEE v1.1.0",
            "nearest_asset_name": "Target Area Coordinates",
            "nearest_asset_dist_km": 0.0,
            "nearest_asset_mineral": "Composite"
        }
    }
