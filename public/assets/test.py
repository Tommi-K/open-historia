import re
import json
import colorsys
import pycountry

def get_full_name_automatically(tag):
    """
    Avtomatsko spremeni ISO kodo v polno ime države.
    """
    # 1. Poskusi najti državo preko 3-črkovne kode (Alpha-3)
    country = pycountry.countries.get(alpha_3=tag.upper())
    if country:
        return country.name

    # 2. Poskusi najti preko 2-črkovne kode (Alpha-2), če obstaja
    country = pycountry.countries.get(alpha_2=tag.upper())
    if country:
        return country.name

    # 3. Posebni primeri za zgodovinske oznake (Paradox/HOI4)
    manual_fixes = {
        "GER": "Germany",
        "SOV": "Russian Federation",
        "ENG": "United Kingdom",
        "ROM": "Romania",
        "HOL": "Netherlands"
    }

    return manual_fixes.get(tag.upper(), tag)

def convert_colors_to_json(input_file, output_file):
    results = {}

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Napaka: Datoteka {input_file} ne obstaja!")
        return

    # Iskanje vseh blokov (npr. TAG = { color = ... })
    # Ta vzorec ujame ime države, način (rgb/hsv) in številke
    pattern = r'(\w+)\s*=\s*\{[^}]*color\s*=\s*(rgb|hsv)\s*\{([^}]+)\}'
    matches = re.findall(pattern, content)

    for tag, mode, values in matches:
        # Pretvori v polno ime
        name = get_full_name_automatically(tag)

        # Očisti vrednosti in jih pretvori v številke
        nums = [float(n) for n in values.split()]

        if mode == 'hsv':
            # HSV (0-1) -> RGB (0-255)
            rgb = colorsys.hsv_to_rgb(nums[0], nums[1], nums[2])
            final_rgb = [int(x * 255) for x in rgb]
        else:
            # Preveri če je RGB v formatu 0-1 ali 0-255
            if all(x <= 1.0 for x in nums):
                final_rgb = [int(x * 255) for x in nums]
            else:
                final_rgb = [int(x) for x in nums]

        results[name] = final_rgb

    # Shrani v JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=4, ensure_ascii=False)

    print(f"Uspeh! Ustvarjena datoteka: {output_file}")

# Zaženi proces
convert_colors_to_json('colors.txt', 'countries_colors.json')
