// src/lib/drugInteractions.ts
// Offline drug-food interaction database focused on Nigerian market medications.
// Checks the user's medication list against a scanned product's ingredient text.

export interface DrugInteractionAlert {
  drug:       string;
  ingredient: string;
  severity:   'high' | 'medium' | 'low';
  message:    string;
}

interface Interaction {
  drug:         string;
  synonyms:     string[];
  foodTriggers: string[];
  severity:     'high' | 'medium' | 'low';
  message:      string;
}

const DATABASE: Interaction[] = [
  {
    drug: 'metformin',
    synonyms: ['glucophage', 'fortamet', 'glumetza'],
    foodTriggers: ['alcohol', 'ethanol', 'wine', 'beer', 'spirits', 'malt'],
    severity: 'high',
    message: 'Alcohol + Metformin raises lactic acidosis risk dangerously. Avoid this product.',
  },
  {
    drug: 'warfarin',
    synonyms: ['coumadin', 'marevan', 'aldocumar'],
    foodTriggers: ['vitamin k', 'e306', 'e307', 'e308', 'kale', 'spinach', 'broccoli', 'parsley', 'natto'],
    severity: 'high',
    message: 'High Vitamin K foods reduce warfarin effectiveness. Monitor INR levels and maintain consistent intake.',
  },
  {
    drug: 'atorvastatin',
    synonyms: ['lipitor', 'simvastatin', 'zocor', 'rosuvastatin', 'crestor', 'pravastatin', 'statin'],
    foodTriggers: ['grapefruit', 'pomelo'],
    severity: 'high',
    message: 'Grapefruit blocks the enzyme that breaks down statins, causing dangerous drug accumulation and muscle damage.',
  },
  {
    drug: 'amlodipine',
    synonyms: ['norvasc', 'nifedipine', 'adalat', 'felodipine', 'plendil', 'calcium channel'],
    foodTriggers: ['grapefruit', 'pomelo'],
    severity: 'medium',
    message: 'Grapefruit can raise amlodipine blood levels excessively, intensifying blood pressure lowering.',
  },
  {
    drug: 'ciprofloxacin',
    synonyms: ['cipro', 'ciproxin', 'levofloxacin', 'ofloxacin', 'fluoroquinolone'],
    foodTriggers: ['calcium', 'dairy', 'milk', 'cheese', 'yogurt', 'iron', 'zinc sulfate'],
    severity: 'medium',
    message: 'Calcium and dairy reduce ciprofloxacin absorption by up to 40%. Take 2 hours before or 6 hours after dairy.',
  },
  {
    drug: 'doxycycline',
    synonyms: ['tetracycline', 'vibramycin', 'minocycline', 'oracea'],
    foodTriggers: ['calcium', 'dairy', 'milk', 'cheese', 'iron', 'ferrous'],
    severity: 'medium',
    message: 'Dairy and calcium bind to doxycycline, drastically reducing absorption. Take on empty stomach.',
  },
  {
    drug: 'paracetamol',
    synonyms: ['acetaminophen', 'tylenol', 'panadol', 'efferalgan'],
    foodTriggers: ['alcohol', 'ethanol', 'wine', 'beer', 'spirits'],
    severity: 'medium',
    message: 'Regular alcohol + paracetamol significantly increases liver damage risk. Limit to occasional use.',
  },
  {
    drug: 'lithium',
    synonyms: ['camcolit', 'priadel', 'liskonum'],
    foodTriggers: ['caffeine', 'coffee', 'sodium chloride', 'sea salt', 'rock salt'],
    severity: 'medium',
    message: 'Sodium and caffeine affect lithium blood levels significantly. Maintain consistent salt intake.',
  },
  {
    drug: 'digoxin',
    synonyms: ['lanoxin', 'digitek', 'digitalis'],
    foodTriggers: ['licorice', 'liquorice', 'st john', 'high fibre', 'high fiber', 'bran'],
    severity: 'high',
    message: 'Licorice increases digoxin toxicity risk. High-fiber foods reduce absorption. Monitor closely.',
  },
  {
    drug: 'phenelzine',
    synonyms: ['maoi', 'tranylcypromine', 'isocarboxazid', 'nardil', 'parnate'],
    foodTriggers: ['tyramine', 'yeast extract', 'marmite', 'aged cheese', 'fermented', 'smoked fish', 'soy sauce', 'broad bean'],
    severity: 'high',
    message: 'CRITICAL: Tyramine-rich foods with MAOIs can trigger a life-threatening hypertensive crisis.',
  },
  {
    drug: 'sertraline',
    synonyms: ['zoloft', 'fluoxetine', 'prozac', 'citalopram', 'ssri', 'escitalopram', 'lexapro'],
    foodTriggers: ['st john', 'tryptophan', 'alcohol', 'ethanol'],
    severity: 'medium',
    message: "Alcohol worsens SSRI side effects. St. John's Wort combined with SSRIs can cause serotonin syndrome.",
  },
  {
    drug: 'artemether',
    synonyms: ['coartem', 'lumefantrine', 'riamet', 'artemisinin'],
    foodTriggers: ['grapefruit', 'fat', 'low fat'],
    severity: 'medium',
    message: 'Coartem must be taken with food or a fatty drink (e.g. whole milk) to be properly absorbed. Grapefruit should be avoided.',
  },
];

export function checkDrugInteractions(
  medications: string[],
  ingredientText: string
): DrugInteractionAlert[] {
  if (!medications.length || !ingredientText) return [];

  const lower   = ingredientText.toLowerCase();
  const alerts: DrugInteractionAlert[] = [];
  const seen    = new Set<string>();

  for (const med of medications) {
    const medLower = med.toLowerCase().trim();
    if (!medLower) continue;

    for (const entry of DATABASE) {
      const matches =
        entry.drug === medLower ||
        entry.drug.includes(medLower) ||
        medLower.includes(entry.drug) ||
        entry.synonyms.some(s => medLower.includes(s) || s.includes(medLower));

      if (!matches) continue;

      const trigger = entry.foodTriggers.find(t => lower.includes(t));
      if (!trigger) continue;

      const key = entry.drug + ':' + trigger;
      if (seen.has(key)) continue;
      seen.add(key);

      alerts.push({
        drug:       med,
        ingredient: trigger,
        severity:   entry.severity,
        message:    entry.message,
      });
    }
  }

  // Sort: high severity first
  return alerts.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}