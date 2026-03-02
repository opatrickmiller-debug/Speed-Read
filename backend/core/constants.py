# Essential Fatty Acids data (USDA FDC nutrient IDs)
# Omega-3 and Omega-6 are the two essential fatty acid families
ESSENTIAL_FATTY_ACIDS = {
    "Linoleic acid (LA)": {"id": 1269, "omega": 6, "rda_g": 11, "description": "Primary omega-6, found in vegetable oils"},
    "Alpha-linolenic acid (ALA)": {"id": 1270, "omega": 3, "rda_g": 1.6, "description": "Plant-based omega-3, found in flax, chia, walnuts"},
    "EPA": {"id": 1278, "omega": 3, "rda_g": 0.25, "description": "Marine omega-3, anti-inflammatory"},
    "DHA": {"id": 1272, "omega": 3, "rda_g": 0.25, "description": "Marine omega-3, brain & eye health"},
}

# Additional fatty acids for comprehensive tracking
ALL_FATTY_ACIDS = {
    **ESSENTIAL_FATTY_ACIDS,
    "Arachidonic acid (AA)": {"id": 1271, "omega": 6, "essential": False},
    "Saturated fat": {"id": 1258, "essential": False},
    "Monounsaturated fat": {"id": 1292, "essential": False},
    "Polyunsaturated fat": {"id": 1293, "essential": False},
}

# Foods high in essential fatty acids - KETO FRIENDLY
FATTY_ACID_RICH_FOODS = {
    "Alpha-linolenic acid (ALA)": [
        {"name": "Chia seeds", "fdc_id": "170554", "per_100g": 17.8, "carbs": 7.7, "protein": 17, "keto": "low"},
        {"name": "Flax seeds", "fdc_id": "169414", "per_100g": 22.8, "carbs": 1.6, "protein": 18, "keto": "ultra_low"},
        {"name": "Walnuts", "fdc_id": "170187", "per_100g": 9.1, "carbs": 7, "protein": 15, "keto": "low"},
        {"name": "Hemp seeds", "fdc_id": "170148", "per_100g": 8.7, "carbs": 2.6, "protein": 32, "keto": "ultra_low"},
    ],
    "EPA": [
        {"name": "Salmon (Atlantic)", "fdc_id": "175168", "per_100g": 0.86, "carbs": 0, "protein": 25, "keto": "ultra_low"},
        {"name": "Mackerel", "fdc_id": "175119", "per_100g": 0.9, "carbs": 0, "protein": 19, "keto": "ultra_low"},
        {"name": "Sardines", "fdc_id": "175139", "per_100g": 0.47, "carbs": 0, "protein": 25, "keto": "ultra_low"},
        {"name": "Anchovies", "fdc_id": "175129", "per_100g": 0.76, "carbs": 0, "protein": 29, "keto": "ultra_low"},
    ],
    "DHA": [
        {"name": "Salmon (Atlantic)", "fdc_id": "175168", "per_100g": 1.1, "carbs": 0, "protein": 25, "keto": "ultra_low"},
        {"name": "Mackerel", "fdc_id": "175119", "per_100g": 1.4, "carbs": 0, "protein": 19, "keto": "ultra_low"},
        {"name": "Sardines", "fdc_id": "175139", "per_100g": 0.51, "carbs": 0, "protein": 25, "keto": "ultra_low"},
        {"name": "Tuna", "fdc_id": "175159", "per_100g": 0.68, "carbs": 0, "protein": 30, "keto": "ultra_low"},
    ],
    "Linoleic acid (LA)": [
        {"name": "Sunflower seeds", "fdc_id": "170562", "per_100g": 23.0, "carbs": 11, "protein": 21, "keto": "moderate"},
        {"name": "Pine nuts", "fdc_id": "170591", "per_100g": 33.2, "carbs": 4, "protein": 14, "keto": "low"},
        {"name": "Pecans", "fdc_id": "170182", "per_100g": 20.6, "carbs": 4, "protein": 9, "keto": "low"},
        {"name": "Brazil nuts", "fdc_id": "170569", "per_100g": 23.9, "carbs": 4, "protein": 14, "keto": "low"},
    ],
}

# Essential Amino Acids data (USDA FDC nutrient IDs)
ESSENTIAL_AMINO_ACIDS = {
    "Tryptophan": {"id": 1210, "rda_mg_per_kg": 5},
    "Threonine": {"id": 1211, "rda_mg_per_kg": 20},
    "Isoleucine": {"id": 1212, "rda_mg_per_kg": 19},
    "Leucine": {"id": 1213, "rda_mg_per_kg": 42},
    "Lysine": {"id": 1214, "rda_mg_per_kg": 38},
    "Methionine": {"id": 1215, "rda_mg_per_kg": 19},
    "Phenylalanine": {"id": 1217, "rda_mg_per_kg": 33},
    "Valine": {"id": 1219, "rda_mg_per_kg": 24},
    "Histidine": {"id": 1221, "rda_mg_per_kg": 14}
}

ALL_AMINO_ACIDS = {
    **ESSENTIAL_AMINO_ACIDS,
    "Cystine": {"id": 1216, "essential": False},
    "Tyrosine": {"id": 1218, "essential": False},
    "Arginine": {"id": 1220, "essential": False},
    "Alanine": {"id": 1222, "essential": False},
    "Aspartic acid": {"id": 1223, "essential": False},
    "Glutamic acid": {"id": 1224, "essential": False},
    "Glycine": {"id": 1225, "essential": False},
    "Proline": {"id": 1226, "essential": False},
    "Serine": {"id": 1227, "essential": False},
    "Hydroxyproline": {"id": 1228, "essential": False}
}

# Foods high in specific amino acids (for suggestions) - KETO FRIENDLY with carb data
AMINO_ACID_RICH_FOODS = {
    "Tryptophan": [
        {"name": "Turkey breast", "fdc_id": "171082", "per_100g": 0.31, "carbs": 0, "protein": 29, "keto": "ultra_low"},
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 0.29, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Salmon", "fdc_id": "175168", "per_100g": 0.25, "carbs": 0, "protein": 25, "keto": "ultra_low"},
        {"name": "Eggs", "fdc_id": "173424", "per_100g": 0.17, "carbs": 0.7, "protein": 13, "keto": "ultra_low"},
        {"name": "Cheese (cheddar)", "fdc_id": "173414", "per_100g": 0.32, "carbs": 1.3, "protein": 25, "keto": "ultra_low"}
    ],
    "Threonine": [
        {"name": "Beef (grass-fed)", "fdc_id": "174032", "per_100g": 1.1, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 1.0, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Pork tenderloin", "fdc_id": "167820", "per_100g": 0.9, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Greek yogurt (full fat)", "fdc_id": "170903", "per_100g": 0.4, "carbs": 4, "protein": 10, "keto": "low"},
        {"name": "Parmesan cheese", "fdc_id": "173420", "per_100g": 1.2, "carbs": 3.2, "protein": 38, "keto": "low"}
    ],
    "Isoleucine": [
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 1.4, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Beef ribeye", "fdc_id": "174032", "per_100g": 1.2, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Tuna", "fdc_id": "175159", "per_100g": 1.3, "carbs": 0, "protein": 30, "keto": "ultra_low"},
        {"name": "Eggs", "fdc_id": "173424", "per_100g": 0.7, "carbs": 0.7, "protein": 13, "keto": "ultra_low"},
        {"name": "Cottage cheese", "fdc_id": "173417", "per_100g": 0.6, "carbs": 3.4, "protein": 11, "keto": "low"}
    ],
    "Leucine": [
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 2.1, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Beef sirloin", "fdc_id": "174032", "per_100g": 2.0, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Tuna", "fdc_id": "175159", "per_100g": 2.0, "carbs": 0, "protein": 30, "keto": "ultra_low"},
        {"name": "Salmon", "fdc_id": "175168", "per_100g": 1.8, "carbs": 0, "protein": 25, "keto": "ultra_low"},
        {"name": "Pork chop", "fdc_id": "167820", "per_100g": 1.9, "carbs": 0, "protein": 26, "keto": "ultra_low"}
    ],
    "Lysine": [
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 2.4, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Beef", "fdc_id": "174032", "per_100g": 2.1, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Pork", "fdc_id": "167820", "per_100g": 2.0, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Tuna", "fdc_id": "175159", "per_100g": 2.3, "carbs": 0, "protein": 30, "keto": "ultra_low"},
        {"name": "Shrimp", "fdc_id": "175180", "per_100g": 2.0, "carbs": 0.2, "protein": 24, "keto": "ultra_low"}
    ],
    "Methionine": [
        {"name": "Eggs", "fdc_id": "173424", "per_100g": 0.4, "carbs": 0.7, "protein": 13, "keto": "ultra_low"},
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 0.7, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Brazil nuts", "fdc_id": "170569", "per_100g": 1.1, "carbs": 4, "protein": 14, "keto": "low"},
        {"name": "Beef", "fdc_id": "174032", "per_100g": 0.6, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Tuna", "fdc_id": "175159", "per_100g": 0.8, "carbs": 0, "protein": 30, "keto": "ultra_low"}
    ],
    "Phenylalanine": [
        {"name": "Beef", "fdc_id": "174032", "per_100g": 1.0, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 1.0, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Parmesan cheese", "fdc_id": "173420", "per_100g": 1.9, "carbs": 3.2, "protein": 38, "keto": "low"},
        {"name": "Eggs", "fdc_id": "173424", "per_100g": 0.7, "carbs": 0.7, "protein": 13, "keto": "ultra_low"},
        {"name": "Pork", "fdc_id": "167820", "per_100g": 0.9, "carbs": 0, "protein": 26, "keto": "ultra_low"}
    ],
    "Valine": [
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 1.3, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Beef", "fdc_id": "174032", "per_100g": 1.3, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Cottage cheese", "fdc_id": "173417", "per_100g": 0.8, "carbs": 3.4, "protein": 11, "keto": "low"},
        {"name": "Eggs", "fdc_id": "173424", "per_100g": 0.9, "carbs": 0.7, "protein": 13, "keto": "ultra_low"},
        {"name": "Turkey", "fdc_id": "171082", "per_100g": 1.2, "carbs": 0, "protein": 29, "keto": "ultra_low"}
    ],
    "Histidine": [
        {"name": "Beef", "fdc_id": "174032", "per_100g": 1.0, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 0.9, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Tuna", "fdc_id": "175159", "per_100g": 1.5, "carbs": 0, "protein": 30, "keto": "ultra_low"},
        {"name": "Pork", "fdc_id": "167820", "per_100g": 1.0, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Salmon", "fdc_id": "175168", "per_100g": 0.9, "carbs": 0, "protein": 25, "keto": "ultra_low"}
    ]
}

# Keto-friendly complete protein foods with carb data
KETO_COMPLETE_PROTEINS = [
    {
        "name": "Eggs, whole",
        "fdc_id": "173424",
        "protein_per_100g": 12.6,
        "carbs_per_100g": 0.7,
        "fat_per_100g": 9.5,
        "keto_tier": "ultra_low",
        "description": "Perfect keto food - all 9 essential amino acids, virtually zero carbs"
    },
    {
        "name": "Chicken breast",
        "fdc_id": "171534",
        "protein_per_100g": 31.0,
        "carbs_per_100g": 0,
        "fat_per_100g": 3.6,
        "keto_tier": "ultra_low",
        "description": "Zero carb complete protein, lean and versatile"
    },
    {
        "name": "Beef ribeye",
        "fdc_id": "174032",
        "protein_per_100g": 26.0,
        "carbs_per_100g": 0,
        "fat_per_100g": 18.0,
        "keto_tier": "ultra_low",
        "description": "Zero carb, high fat - ideal keto macro ratio"
    },
    {
        "name": "Salmon, Atlantic",
        "fdc_id": "175168",
        "protein_per_100g": 25.4,
        "carbs_per_100g": 0,
        "fat_per_100g": 13.0,
        "keto_tier": "ultra_low",
        "description": "Zero carb with omega-3s, excellent for keto"
    },
    {
        "name": "Pork belly",
        "fdc_id": "167820",
        "protein_per_100g": 9.3,
        "carbs_per_100g": 0,
        "fat_per_100g": 53.0,
        "keto_tier": "ultra_low",
        "description": "Ultra high fat, zero carb - keto staple"
    },
    {
        "name": "Bacon",
        "fdc_id": "168322",
        "protein_per_100g": 37.0,
        "carbs_per_100g": 1.4,
        "fat_per_100g": 42.0,
        "keto_tier": "ultra_low",
        "description": "High protein, high fat, minimal carbs"
    },
    {
        "name": "Cheddar cheese",
        "fdc_id": "173414",
        "protein_per_100g": 25.0,
        "carbs_per_100g": 1.3,
        "fat_per_100g": 33.0,
        "keto_tier": "ultra_low",
        "description": "Complete protein with excellent fat content"
    },
    {
        "name": "Greek yogurt (full fat)",
        "fdc_id": "170903",
        "protein_per_100g": 10.0,
        "carbs_per_100g": 4.0,
        "fat_per_100g": 5.0,
        "keto_tier": "low",
        "description": "Low carb option - watch portions on strict keto"
    }
]

# Keto meal combinations for complete amino acid profiles
KETO_MEAL_COMBOS = [
    {
        "name": "Steak & Eggs",
        "foods": ["Beef ribeye", "Eggs"],
        "total_protein": 38.6,
        "total_carbs": 0.7,
        "description": "Classic keto combo - complete amino acids, near-zero carbs",
        "amino_profile": "complete"
    },
    {
        "name": "Salmon & Avocado",
        "foods": ["Salmon", "Avocado"],
        "total_protein": 27.4,
        "total_carbs": 1.8,
        "description": "Omega-3 rich with healthy fats, complete protein",
        "amino_profile": "complete"
    },
    {
        "name": "Bacon & Cheese Omelette",
        "foods": ["Bacon", "Eggs", "Cheddar cheese"],
        "total_protein": 40.0,
        "total_carbs": 2.4,
        "description": "High fat, high protein breakfast - all amino acids covered",
        "amino_profile": "complete"
    },
    {
        "name": "Chicken & Cheese Plate",
        "foods": ["Chicken breast", "Parmesan"],
        "total_protein": 56.0,
        "total_carbs": 3.2,
        "description": "Ultra high protein, low carb - muscle building combo",
        "amino_profile": "complete"
    },
    {
        "name": "Tuna Salad (no bread)",
        "foods": ["Tuna", "Eggs", "Mayonnaise"],
        "total_protein": 43.0,
        "total_carbs": 0.8,
        "description": "Quick keto lunch - complete protein, minimal carbs",
        "amino_profile": "complete"
    },
    {
        "name": "Pork Chops & Butter",
        "foods": ["Pork chop", "Butter"],
        "total_protein": 26.0,
        "total_carbs": 0,
        "description": "Zero carb meal with all essential amino acids",
        "amino_profile": "complete"
    }
]
