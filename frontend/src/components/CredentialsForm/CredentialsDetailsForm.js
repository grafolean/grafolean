import React from 'react';

export default class CredentialsDetailsForm extends React.Component {
  handleChangeEventOnInput = ev => {
    const fieldName = ev.target.name;
    const fieldValue = ev.target.value;
    const newValue = {
      ...this.props.value,
      [fieldName]: fieldValue,
    };
    this.props.onChange(newValue);
  };

  renderSnmp() {
    const {
      value: { snmpv12_community = '' },
    } = this.props;
    return (
      <div className="nested-field">
        <div className="field">
          <label>Community:</label>
          <input
            type="text"
            value={snmpv12_community}
            name="snmpv12_community"
            onChange={this.handleChangeEventOnInput}
          />
        </div>
      </div>
    );
  }

  render() {
    const { credentialsType } = this.props;

    switch (credentialsType) {
      case 'snmp':
        return this.renderSnmp();
      default:
        return null;
    }
  }
}
