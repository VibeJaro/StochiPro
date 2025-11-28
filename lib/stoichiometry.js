function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function calculateAmounts(component) {
  const { quantity, unit, molecularWeight, density } = component;
  if (!quantity || !unit) return { mass: null, moles: null };

  if (unit === 'g' || unit === 'gram' || unit === 'grams' || unit === 'gramm') {
    const mass = quantity;
    if (molecularWeight) {
      return { mass, moles: (mass / molecularWeight) * 1000 };
    }
    return { mass, moles: null };
  }

  if (unit === 'mg') {
    const mass = quantity / 1000;
    if (molecularWeight) {
      return { mass, moles: (mass / molecularWeight) * 1000 };
    }
    return { mass, moles: null };
  }

  if (unit === 'mmol') {
    const moles = quantity;
    return { mass: molecularWeight ? (moles / 1000) * molecularWeight : null, moles };
  }

  if (unit === 'mol') {
    const moles = quantity * 1000;
    return { mass: molecularWeight ? quantity * molecularWeight : null, moles };
  }

  if (unit === 'ml' || unit === 'mL') {
    if (density) {
      const mass = quantity * density;
      return { mass, moles: molecularWeight ? (mass / molecularWeight) * 1000 : null };
    }
    return { mass: null, moles: null };
  }

  return { mass: null, moles: null };
}

function computeEquivalents(components) {
  const moles = components
    .filter((c) => c.moles)
    .map((c) => c.moles / c.coefficient);
  if (!moles.length) return;

  const limiting = Math.min(...moles);
  components.forEach((component) => {
    if (!component.moles) {
      component.equivalents = null;
      return;
    }
    component.equivalents = Number((component.moles / component.coefficient / limiting).toFixed(2));
    component.limiting = Math.abs(component.equivalents - 1) < 0.05;
  });
}

function enrichStoichiometry(components) {
  components.forEach((component) => {
    const { mass, moles } = calculateAmounts(component);
    component.mass = mass;
    component.moles = moles;
    component.coefficient = component.coefficient || 1;
  });
  computeEquivalents(components);
  return components;
}

function calculateStoichiometry(components) {
  const enriched = components.map((component) => {
    const coefficient = component.coefficient || 1;
    const mw = component.pubchem?.molecularWeight;
    const unit = component.amount?.unit;
    const value = toNumber(component.amount?.value);

    let mass = null;
    let mmol = null;

    if (value !== null && value !== undefined) {
      if (unit === 'g') {
        mass = value;
        mmol = mw ? (mass / mw) * 1000 : null;
      } else if (unit === 'mg') {
        mass = value / 1000;
        mmol = mw ? (mass / mw) * 1000 : null;
      } else if (unit === 'mol') {
        mass = mw ? value * mw : null;
        mmol = value * 1000;
      } else if (unit === 'mmol') {
        mmol = value;
        mass = mw ? (value / 1000) * mw : null;
      }
    }

    return {
      ...component,
      coefficient,
      calculated: {
        mass,
        mmol,
        equivalents: null
      }
    };
  });

  const moles = enriched
    .filter((c) => c.calculated.mmol)
    .map((c) => c.calculated.mmol / c.coefficient);
  if (moles.length) {
    const limiting = Math.min(...moles);
    enriched.forEach((component) => {
      if (!component.calculated.mmol) return;
      component.calculated.equivalents = Number(
        (component.calculated.mmol / component.coefficient / limiting).toFixed(2)
      );
    });
  }

  return enriched;
}

export { calculateStoichiometry, enrichStoichiometry, toNumber };
