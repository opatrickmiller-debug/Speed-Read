/**
 * Unit conversion utilities for imperial/metric system support
 * 
 * When speedUnit is 'mph' -> Imperial (miles, mph)
 * When speedUnit is 'km/h' -> Metric (kilometers, km/h)
 */

// Get the current unit system from localStorage
export const getSpeedUnit = () => {
  return localStorage.getItem('speedUnit') || 'mph';
};

// Check if using metric system
export const isMetric = () => {
  return getSpeedUnit() === 'km/h';
};

// Convert miles to kilometers
export const milesToKm = (miles) => {
  if (miles === null || miles === undefined) return null;
  return miles * 1.60934;
};

// Convert kilometers to miles  
export const kmToMiles = (km) => {
  if (km === null || km === undefined) return null;
  return km / 1.60934;
};

// Convert mph to km/h
export const mphToKmh = (mph) => {
  if (mph === null || mph === undefined) return null;
  return mph * 1.60934;
};

// Convert km/h to mph
export const kmhToMph = (kmh) => {
  if (kmh === null || kmh === undefined) return null;
  return kmh / 1.60934;
};

/**
 * Format distance based on current unit setting
 * @param {number} distanceMiles - Distance in miles (from backend)
 * @param {number} decimals - Number of decimal places
 * @returns {object} { value: number, unit: string, formatted: string }
 */
export const formatDistance = (distanceMiles, decimals = 1) => {
  if (distanceMiles === null || distanceMiles === undefined) {
    return { value: 0, unit: isMetric() ? 'km' : 'mi', formatted: `0 ${isMetric() ? 'km' : 'mi'}` };
  }
  
  if (isMetric()) {
    const km = milesToKm(distanceMiles);
    return { 
      value: Number(km.toFixed(decimals)), 
      unit: 'km', 
      formatted: `${km.toFixed(decimals)} km` 
    };
  } else {
    return { 
      value: Number(distanceMiles.toFixed(decimals)), 
      unit: 'mi', 
      formatted: `${distanceMiles.toFixed(decimals)} mi` 
    };
  }
};

/**
 * Format speed based on current unit setting
 * @param {number} speedMph - Speed in mph (from backend or GPS)
 * @param {number} decimals - Number of decimal places
 * @returns {object} { value: number, unit: string, formatted: string }
 */
export const formatSpeed = (speedMph, decimals = 0) => {
  if (speedMph === null || speedMph === undefined) {
    return { value: 0, unit: getSpeedUnit(), formatted: `0 ${getSpeedUnit()}` };
  }
  
  if (isMetric()) {
    const kmh = mphToKmh(speedMph);
    return { 
      value: Number(kmh.toFixed(decimals)), 
      unit: 'km/h', 
      formatted: `${kmh.toFixed(decimals)} km/h` 
    };
  } else {
    return { 
      value: Number(speedMph.toFixed(decimals)), 
      unit: 'mph', 
      formatted: `${speedMph.toFixed(decimals)} mph` 
    };
  }
};

/**
 * Get display labels for current unit system
 * @returns {object} { speed: string, distance: string, distanceShort: string }
 */
export const getUnitLabels = () => {
  if (isMetric()) {
    return {
      speed: 'km/h',
      distance: 'kilometers',
      distanceShort: 'km'
    };
  } else {
    return {
      speed: 'mph',
      distance: 'miles',
      distanceShort: 'mi'
    };
  }
};

/**
 * Convert a value from backend (always in miles/mph) to display unit
 * @param {number} value - Value in imperial units
 * @param {string} type - 'speed' or 'distance'
 * @returns {number} Converted value
 */
export const convertToDisplayUnit = (value, type = 'speed') => {
  if (value === null || value === undefined) return null;
  
  if (isMetric()) {
    return type === 'speed' ? mphToKmh(value) : milesToKm(value);
  }
  return value;
};
