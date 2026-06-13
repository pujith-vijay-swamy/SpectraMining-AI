// spectral.worker.js
// SpectraMining AI Standalone Web Worker for dynamic spectral math rendering

self.onmessage = function (e) {
  const { pixels, mineral, threshold, width, height } = e.data;

  if (!pixels || pixels.length === 0) {
    self.postMessage({ error: "Empty pixel dataset" });
    return;
  }

  const totalPixels = pixels.length;
  let countAbove = 0;
  let sumAbove = 0.0;
  let maxVal = -Infinity;
  let minVal = Infinity;

  // Pre-allocate RGBA buffer: 4 bytes per pixel (Red, Green, Blue, Alpha)
  const rgbaArray = new Uint8ClampedArray(width * height * 4);

  // Buffer coordinates: Sentinel-2 bands mapping in backend:
  // pixels[i] = [B2 (Blue), B3 (Green), B4 (Red), B8 (NIR), B11 (SWIR1), B12 (SWIR2)]
  // Index mappings: B2=0, B3=1, B4=2, B8=3, B11=4, B12=5

  // First pass: compute indices and gather stats
  const indices = new Float32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const p = pixels[i];
    const b2 = p[0];
    const b3 = p[1];
    const b4 = p[2];
    const b8 = p[3];
    const b11 = p[4];
    const b12 = p[5];

    let indexVal = 0.0;

    if (mineral === "Fe") {
      // Iron Ore: Band 4 (Red) / Band 2 (Blue)
      indexVal = b2 > 0 ? b4 / b2 : 0.0;
    } else if (mineral === "Al") {
      // Aluminum: Band 11 (SWIR1) / Band 12 (SWIR2)
      indexVal = b12 > 0 ? b11 / b12 : 0.0;
    } else if (mineral === "Cu") {
      // Copper: (Band 4 / Band 3) * (Band 8 / Band 4) = Band 8 / Band 3
      indexVal = b3 > 0 ? b8 / b3 : 0.0;
    } else if (mineral === "Au") {
      // Gold Alteration: Band 11 (SWIR1) / Band 8 (NIR)
      indexVal = b8 > 0 ? b11 / b8 : 0.0;
    } else if (mineral === "Mn") {
      // Manganese: Band 11 (SWIR1) / Band 4 (Red)
      indexVal = b4 > 0 ? b11 / b4 : 0.0;
    } else if (mineral === "Ls") {
      // Limestone/Calcite: Band 8 (NIR) / Band 12 (SWIR2)
      indexVal = b12 > 0 ? b8 / b12 : 0.0;
    }

    indices[i] = indexVal;

    if (indexVal > maxVal) maxVal = indexVal;
    if (indexVal < minVal) minVal = indexVal;
  }

  // Second pass: apply threshold, build RGBA pixel map and statistics
  for (let i = 0; i < totalPixels; i++) {
    const val = indices[i];
    const offset = i * 4;

    if (val >= threshold) {
      countAbove++;
      sumAbove += val;

      // Map value relative to max for color intensity
      const range = maxVal - threshold;
      const intensity = range > 0 ? Math.min(1.0, (val - threshold) / range) : 1.0;
      
      // Compute alpha between 100 (semi-transparent) and 240 (solid)
      const alpha = Math.floor(120 + intensity * 120);

      if (mineral === "Fe") {
        // Red-Orange for Iron Ore (Fe)
        // Brighter orange for higher intensity
        rgbaArray[offset] = Math.floor(220 + intensity * 35); // R
        rgbaArray[offset + 1] = Math.floor(60 + intensity * 60);  // G
        rgbaArray[offset + 2] = 20;                             // B
        rgbaArray[offset + 3] = alpha;                          // A
      } else if (mineral === "Al") {
        // Silver-Cyan for Aluminum (Al)
        rgbaArray[offset] = Math.floor(30 + intensity * 50);    // R
        rgbaArray[offset + 1] = Math.floor(180 + intensity * 75); // G
        rgbaArray[offset + 2] = Math.floor(220 + intensity * 35); // B
        rgbaArray[offset + 3] = alpha;                          // A
      } else if (mineral === "Cu") {
        // Vibrant Emerald Green for Copper Alteration (Cu)
        rgbaArray[offset] = Math.floor(16 + intensity * 40);     // R
        rgbaArray[offset + 1] = Math.floor(185 + intensity * 70); // G
        rgbaArray[offset + 2] = Math.floor(129 + intensity * 30); // B
        rgbaArray[offset + 3] = alpha;                           // A
      } else if (mineral === "Au") {
        // Gold/Yellow for Gold Alteration (Au)
        rgbaArray[offset] = Math.floor(210 + intensity * 45);     // R
        rgbaArray[offset + 1] = Math.floor(150 + intensity * 45); // G
        rgbaArray[offset + 2] = Math.floor(5 + intensity * 15);   // B
        rgbaArray[offset + 3] = alpha;                           // A
      } else if (mineral === "Mn") {
        // Purple/Magenta for Manganese (Mn)
        rgbaArray[offset] = Math.floor(180 + intensity * 40);     // R
        rgbaArray[offset + 1] = Math.floor(40 + intensity * 40);  // G
        rgbaArray[offset + 2] = Math.floor(200 + intensity * 40); // B
        rgbaArray[offset + 3] = alpha;                           // A
      } else if (mineral === "Ls") {
        // Light Gray/Sand for Limestone (Ls)
        rgbaArray[offset] = Math.floor(180 + intensity * 40);     // R
        rgbaArray[offset + 1] = Math.floor(190 + intensity * 40); // G
        rgbaArray[offset + 2] = Math.floor(200 + intensity * 40); // B
        rgbaArray[offset + 3] = alpha;                           // A
      }
    } else {
      // Below threshold: make completely transparent
      rgbaArray[offset] = 0;
      rgbaArray[offset + 1] = 0;
      rgbaArray[offset + 2] = 0;
      rgbaArray[offset + 3] = 0;
    }
  }

  const averageAbove = countAbove > 0 ? sumAbove / countAbove : 0.0;
  const percentage = (countAbove / totalPixels) * 100.0;

  self.postMessage({
    rgbaArray,
    countAbove,
    percentage: parseFloat(percentage.toFixed(2)),
    averageValue: parseFloat(averageAbove.toFixed(3)),
    maxValue: parseFloat(maxVal.toFixed(3)),
    minValue: parseFloat(minVal.toFixed(3))
  });
};
