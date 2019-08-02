import React from 'react';
import Button from '../Button';
import { FieldArray } from 'formik';

class OidsInput extends React.Component {
  static DEFAULT_VALUES = [
    {
      oid: '',
      fetch_method: 'get',
    },
  ];

  render() {
    const { values, namePrefix, onChange } = this.props;
    return (
      <FieldArray name={`${namePrefix}.oids`}>
        {({ insert }) => (
          <div className="field">
            <label>Fetch OIDS:</label>
            <div className="nested-field">
              {values.map((o, i) => (
                <div className="field" key={i}>
                  <label>${i + 1}:</label>
                  <input
                    type="text"
                    name={`${namePrefix}.oids[${i}].oid`}
                    value={o.oid}
                    pattern="[.]?([0-9]+[.])+[0-9]+"
                    onChange={onChange}
                  />
                  <input
                    type="radio"
                    name={`${namePrefix}.oids[${i}].fetch_method`}
                    value="get"
                    checked={o.fetch_method === 'get'}
                    onChange={onChange}
                  />{' '}
                  SNMP GET
                  <input
                    type="radio"
                    name={`${namePrefix}.oids[${i}].fetch_method`}
                    value="walk"
                    checked={o.fetch_method === 'walk'}
                    onChange={onChange}
                  />{' '}
                  SNMP WALK
                </div>
              ))}
              <Button type="button" onClick={() => insert(values.length, OidsInput.DEFAULT_VALUES[0])}>
                <i className="fa fa-plus" /> additional OID
              </Button>
            </div>
          </div>
        )}
      </FieldArray>
    );
  }
}

export default class SensorDetailsFormSnmp extends React.Component {
  static DEFAULT_VALUES = {
    oids: OidsInput.DEFAULT_VALUES,
    expression: '$1',
    output_path: '',
  };

  static validate = value => {
    let errors = {};
    // const invalidOids = value.oids.find(o => o.oid === '');
    // if (invalidOids) {
    //   errors['oids'] = 'OIDs must be entered'
    // }
    return errors;
  };

  render() {
    if (Object.keys(this.props.values).length === 0) {
      return null;
    }

    const {
      values: { oids, expression, output_path },
      namePrefix,
      onChange,
    } = this.props;
    const oidWithWalkPresent = Boolean(oids.find(o => o.fetch_method === 'walk'));
    return (
      <div className="nested-field">
        <OidsInput values={oids} namePrefix={namePrefix} onChange={onChange} />

        <div className="field">
          <label>Expression to calculate output value:</label>
          <input type="text" value={expression} name={`${namePrefix}.expression`} onChange={onChange} />
        </div>

        <div className="field">
          <label>Save values to path:</label>
          <input type="text" value={output_path} name={`${namePrefix}.output_path`} onChange={onChange} />
          <p className="hint">
            &lt;entity_id&gt;.snmp.{output_path || '...'}
            {oidWithWalkPresent ? '.<snmpwalk_index>' : ''}
          </p>
        </div>
      </div>
    );
  }
}
