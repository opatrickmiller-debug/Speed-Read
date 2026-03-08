import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a portion amount and unit to grams
 * @param {number} amount - The quantity (e.g., 2)
 * @param {string} unit - The unit type (e.g., 'oz', 'cup', 'serving')
 * @param {number} servingWeight - The weight in grams for one serving (from USDA data)
 * @returns {number} The equivalent weight in grams
 */
export const unitToGrams = (amount, unit, servingWeight = 100) => {
  const conversions = {
    grams: 1,
    g: 1,
    oz: 28.35,
    lb: 453.6,
    kg: 1000,
    cup: 240,
    tbsp: 15,
    tsp: 5,
    slice: 28,    // Average slice (cheese, bread)
    piece: 50,    // Average piece
    ml: 1,        // For liquids (1ml ≈ 1g water)
    fl_oz: 29.57  // Fluid ounce
  };

  // For "serving" unit, use the food's actual serving weight
  if (unit === "serving") {
    return amount * servingWeight;
  }

  return amount * (conversions[unit] || 1);
};

/**
 * Get all available unit options with their labels
 * @param {number} servingWeight - The weight in grams for one serving
 * @param {string} servingLabel - The label for one serving (e.g., "1 large egg")
 * @returns {Object} Unit definitions with factors and labels
 */
export const getUnitOptions = (servingWeight = 100, servingLabel = null) => {
  return {
    serving: { 
      factor: servingWeight, 
      label: 'serving', 
      description: servingLabel || `1 serving (${servingWeight}g)` 
    },
    g: { factor: 1, label: 'g', description: 'grams' },
    oz: { factor: 28.35, label: 'oz', description: 'ounces' },
    lb: { factor: 453.6, label: 'lb', description: 'pounds' },
    cup: { factor: 240, label: 'cup', description: 'cups' },
    tbsp: { factor: 15, label: 'tbsp', description: 'tablespoons' },
    tsp: { factor: 5, label: 'tsp', description: 'teaspoons' },
    slice: { factor: 28, label: 'slice', description: 'slices' },
    piece: { factor: 50, label: 'piece', description: 'pieces' }
  };
};

