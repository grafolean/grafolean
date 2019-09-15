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
  static OID_REGEX = '^[.]?([0-9]+[.])+[0-9]+$';

  render() {
    const { values, namePrefix, onChange } = this.props;
    return (
      <FieldArray name={`${namePrefix}.oids`}>
        {({ insert, remove }) => (
          <div className="field oids-input">
            <label>Fetch OIDS:</label>
            <div className="nested-field">
              {values.map((o, i) => (
                <div className="field field-array-element" key={i}>
                  <label>${i + 1}:</label>
                  <input
                    type="text"
                    name={`${namePrefix}.oids[${i}].oid`}
                    value={o.oid}
                    pattern={OidsInput.OID_REGEX}
                    onChange={onChange}
                  />
                  <i className="fa fa-trash" onClick={() => remove(i)} />
                  <div>
                    <label>
                      <input
                        type="radio"
                        name={`${namePrefix}.oids[${i}].fetch_method`}
                        value="get"
                        checked={o.fetch_method === 'get'}
                        onChange={onChange}
                      />{' '}
                      SNMP GET
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`${namePrefix}.oids[${i}].fetch_method`}
                        value="walk"
                        checked={o.fetch_method === 'walk'}
                        onChange={onChange}
                      />{' '}
                      SNMP WALK
                    </label>
                  </div>
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
  static OUTPUT_PATH_REGEX = '^[0-9a-zA-Z_-]+([.][0-9a-zA-Z_-]+)*$';

  static validate = values => {
    const { oids, expression, output_path } = values;
    let errors = {};
    // expression should include $X for each X in range from 1 to oids.length:
    for (let i = 0; i < oids.length; i++) {
      if (!expression.includes(`$${i + 1}`)) {
        errors['expression'] = `Expression should contain $${i + 1}`;
        break;
      }
    }
    // output_path should not be empty and should match regex pattern:
    if (output_path.length === 0) {
      errors['output_path'] = 'Output path should not be empty';
    } else if (!output_path.match(SensorDetailsFormSnmp.OUTPUT_PATH_REGEX)) {
      errors['output_path'] =
        'Output path should containt only digits, ASCII letters, dashes and underscores, separated by dots';
    }
    // !!! this doesn't play well with Formik's error handling:
    // if (oids.length === 0) {
    //   errors['oids'] = 'At least one OID should be fetched';
    // } else if (oids.find(o => o.oid === '')) {
    //   errors['oids'] = 'OIDs should not be empty';
    // } else if (oids.find(o => ! o.oid.match(OidsInput.OID_REGEX))) {
    //   errors['oids'] = 'OIDs should be composed of digits, separated by dots';
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
          <input
            type="text"
            value={output_path}
            name={`${namePrefix}.output_path`}
            onChange={onChange}
            pattern={SensorDetailsFormSnmp.OUTPUT_PATH_REGEX}
          />
          {output_path && (
            <p className="hint">
              Data will be saved to path: entity.&lt;entity_id&gt;.snmp.{output_path || '...'}
              {oidWithWalkPresent ? '.<snmpwalk_index>' : ''}
            </p>
          )}
        </div>
      </div>
    );
  }
}
