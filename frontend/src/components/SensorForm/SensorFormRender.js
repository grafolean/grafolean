import React from 'react';

import isForm from '../isForm';
import SensorDetailsFormSnmp from './SensorDetailsFormSnmp';

class SensorFormRender extends React.Component {
  areFormValuesValid() {
    const {
      formValues: { name = '', protocol = '' },
    } = this.props;
    if (name.length === 0 || protocol.length === 0) {
      return false;
    }
    return true;
  }

  performValidation = () => {
    const valid = this.areFormValuesValid();
    this.props.onValidChange(valid);
  };

  handleInputChange = ev => {
    this.props.onInputChangeEvent(ev);
    this.performValidation();
  };

  handleDetailsChange = details => {
    this.props.onInputChange('details', details);
    this.performValidation();
  };

  render() {
    const {
      formValues: { name = '', protocol = '', details = {} },
    } = this.props;

    return (
      <div className="frame">
        <div className="field">
          <label>Name:</label>
          <input
            type="text"
            value={name}
            name="name"
            onChange={this.handleInputChange}
            onBlur={this.performValidation}
          />
        </div>
        <div className="field">
          <label>Protocol:</label>
          <select
            value={protocol}
            name="protocol"
            onChange={this.handleInputChange}
            onBlur={this.performValidation}
          >
            <option value="">-- please select --</option>
            <option value="snmp">SNMP</option>
          </select>
        </div>
        {protocol === 'snmp' ? (
          <SensorDetailsFormSnmp value={details} onChange={this.handleDetailsChange} />
        ) : null}
      </div>
    );
  }
}

export default isForm(SensorFormRender);
