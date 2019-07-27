import React from 'react';

import isForm from '../isForm';
import CredentialsDetailsFormSnmp from './CredentialsDetailsFormSnmp';

class CredentialsFormRender extends React.Component {
  areFormValuesValid() {
    const {
      formValues: { name = '', credentials_type = '' },
    } = this.props;
    if (name.length === 0 || credentials_type.length === 0) {
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

  handleCredentialsTypeChange = ev => {
    this.handleInputChange(ev);
    // when type of credentials changes, reset the credentials details:
    this.handleDetailsChange({});
  };

  handleDetailsChange = details => {
    this.props.onInputChange('details', details);
    this.performValidation();
  };

  render() {
    const {
      formValues: { name = '', credentials_type = '', details = {} },
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
          <label>Monitored credentials type:</label>
          <select
            value={credentials_type}
            name="credentials_type"
            onChange={this.handleCredentialsTypeChange}
            onBlur={this.performValidation}
          >
            <option value="">-- please select the type of credentials --</option>
            <option value="snmp">SNMP</option>
          </select>
        </div>
        {credentials_type === 'snmp' ? (
          <CredentialsDetailsFormSnmp value={details} onChange={this.handleDetailsChange} />
        ) : null}
      </div>
    );
  }
}

export default isForm(CredentialsFormRender);
