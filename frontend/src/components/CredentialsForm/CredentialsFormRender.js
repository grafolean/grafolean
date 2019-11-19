import React from 'react';

import isForm from '../isForm';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';
import CredentialsDetailsFormSnmp from './CredentialsDetailsFormSnmp';
import CredentialsDetailsFormPing from './CredentialsDetailsFormPing';

class CredentialsFormRender extends React.Component {
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
            onChange={this.handleCredentialsTypeChange}
            onBlur={this.performValidation}
          >
            <option value="">-- please select the type of credentials --</option>
            {SUPPORTED_PROTOCOLS.map(protocol => (
              <option key={protocol.slug} value={protocol.slug}>
                {protocol.label}
              </option>
            ))}
          </select>
        </div>
        {protocol === 'snmp' ? (
          <CredentialsDetailsFormSnmp value={details} onChange={this.handleDetailsChange} />
        ) : protocol === 'ping' ? (
          <CredentialsDetailsFormPing value={details} onChange={this.handleDetailsChange} />
        ) : null}
      </div>
    );
  }
}

export default isForm(CredentialsFormRender);
