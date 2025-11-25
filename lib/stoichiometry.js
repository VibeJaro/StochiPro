function normalizeAmount(amount) {
  if (!amount) return { mmol: 0, mass: 0 };
  const { value = 0, unit = 'g' } = amount;
  if (unit.toLowerCase().includes('mmol')) {
    return { mmol: value, mass: null };
  }
  if (unit.toLowerCase().includes('mol')) {
    return { mmol: value * 1000, mass: null };
  }
  return { mass: value, mmol: null };
}

export function calculateStoichiometry(components = []) {
  // Step 1: compute mmol and mass for each component based on provided data + MW
  const enriched = components.map((comp) => {
    const normalized = normalizeAmount(comp.amount);
    const mw = comp.pubchem?.molecularWeight || 0;
    let mmol = normalized.mmol;
    let mass = normalized.mass;
    if (!mmol && mass && mw) {
      mmol = (mass / mw) * 1000;
    }
    if (!mass && mmol && mw) {
      mass = (mmol / 1000) * mw;
    }
    return {
      ...comp,
      calculated: {
        mmol,
        mass,
        equivalents: null,
      },
    };
  });

  // Step 2: determine limiting reagent among reactants
  const reactants = enriched.filter((c) => c.role === 'Edukt' || c.role === 'Reaktant' || c.role === 'reactant');
  if (reactants.length > 0) {
    const perCoeff = reactants.map((r) => ({
      id: r.id,
      ratio: r.calculated.mmol && r.coefficient ? r.calculated.mmol / r.coefficient : Infinity,
    }));
    const limiting = perCoeff.reduce((a, b) => (b.ratio < a.ratio ? b : a), perCoeff[0]);

    enriched.forEach((c) => {
      if (c.calculated.mmol && c.coefficient) {
        const equivalents = limiting.ratio !== Infinity ? (c.calculated.mmol / c.coefficient) / limiting.ratio : null;
        c.calculated.equivalents = equivalents;
      }
    });
  }

  return enriched;
}
