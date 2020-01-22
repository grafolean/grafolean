import React from 'react';

import './UnitFormField.scss';

// const METRIC_PREFIXES = [
//   { prefix: 'P', name: 'peta', power: 15 },
//   { prefix: 'T', name: 'tera', power: 12 },
//   { prefix: 'G', name: 'giga', power: 9 },
//   { prefix: 'M', name: 'mega', power: 6 },
//   { prefix: 'k', name: 'kilo', power: 3 },
//   { prefix: 'h', name: 'hecto', power: 2 },
//   { prefix: 'd', name: 'deci', power: 1 },
//   { prefix: 'c', name: 'centi', power: -2 },
//   { prefix: 'm', name: 'milli', power: -3 },
//   { prefix: 'µ', name: 'micro', power: -6 },
//   { prefix: 'n', name: 'nano', power: -9 },
//   { prefix: 'p', name: 'pico', power: -12 },
// ];
const KNOWN_UNITS = {
  '%': { name: 'percent', allowedPrefixes: '' },
  '°C': { name: 'degrees Celcius', allowedPrefixes: '' },
  s: { name: 'second', allowedPrefixes: 'mµnp' },
  m: { name: 'meter', allowedPrefixes: 'pnµmcdk' },
  bps: { name: 'bits per second', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
  B: { name: 'byte', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
  Bps: { name: 'bytes per second', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
};

export default class UnitFormField extends React.Component {
  getAllKnownUnits() {
    let allUnits = Object.keys(KNOWN_UNITS).map(unit => ({
      value: unit,
      label: `${unit} (${KNOWN_UNITS[unit].name})`,
      allowedPrefixes: KNOWN_UNITS[unit].allowedPrefixes,
    }));
    const { otherKnownUnits } = this.props;
    if (otherKnownUnits) {
      for (let ou of otherKnownUnits) {
        if (allUnits.find(u => u.value === ou.value)) {
          continue;
        }
        allUnits.push(ou);
      }
    }
    return allUnits;
  }

  render() {
    const { value, name, onBlur, onChange, setFieldValue } = this.props;

    const allUnits = this.getAllKnownUnits();
    return (
      <div className="form-item field">
        <label>Unit:</label>
        <input type="text" value={value} name={name} onChange={onChange} onBlur={onBlur} />
        <p className="hint markdown">
          Commonly used units:
          {allUnits.map(u => (
            <span
              key={u.label}
              className="set-unit"
              onClick={() => setFieldValue(name, u.value)}
              title={u.label}
            >
              {u.value}
            </span>
          ))}
        </p>
      </div>
    );
  }
}
