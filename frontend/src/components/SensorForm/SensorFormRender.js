import React from 'react';

import isFormikForm from '../isFormikForm';
import SensorDetailsFormSnmp from './SensorDetailsFormSnmp';

class SensorFormRender extends React.Component {
  static DEFAULT_VALUES = {
    name: '',
    protocol: '',
  };

  static validate = values => {
    const { name = '', protocol = '', details } = values;
    let errors = {};
    if (name.length === 0) {
      errors['name'] = 'Name should not be empty';
    }
    if (protocol.length === 0) {
      errors['protocol'] = 'Protocol should be chosen';
    }
    // we must be careful not to throw an exception in validate() or the results are unpredictable:
    try {
      let detailsErrors;
      switch (protocol) {
        case 'snmp':
          detailsErrors = SensorDetailsFormSnmp.validate(details);
          break;
        default:
          break;
      }
      if (detailsErrors && Object.keys(detailsErrors).length > 0) {
        errors['details'] = detailsErrors;
      }
    } catch (errorMsg) {
      console.error(errorMsg);
      errors['details'] = errorMsg;
    }
    return errors;
  };

  handleProtocolChange = ev => {
    // when protocol changes, use the protocol component's DEFAULT_VALUES to initialize the values:
    const fieldName = ev.target.name;
    const value = ev.target.value;
    this.props.setFieldValue(fieldName, value, false);
    switch (value) {
      case 'snmp':
        this.props.setFieldValue('details', SensorDetailsFormSnmp.DEFAULT_VALUES, true);
        break;
      default:
        break;
    }
  };

  render() {
    const {
      values: { name = '', protocol = '', details = {} },
      errors,
      onChange,
      onBlur,
    } = this.props;

    return (
      <div className="frame">
        <div className="field">
          <label>Name:</label>
          <input type="text" value={name} name="name" onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="field">
          <label>Protocol:</label>
          <select value={protocol} name="protocol" onChange={this.handleProtocolChange} onBlur={onBlur}>
            <option value="">-- please select --</option>
            <option value="snmp">SNMP</option>
          </select>
        </div>
        {protocol === 'snmp' ? (
          <SensorDetailsFormSnmp
            values={details}
            namePrefix="details"
            onChange={onChange}
            errors={errors['details']}
          />
        ) : null}
      </div>
    );
  }
}

export default isFormikForm(SensorFormRender);
