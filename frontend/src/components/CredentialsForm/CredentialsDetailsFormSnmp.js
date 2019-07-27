import React from 'react';

export default class CredentialsDetailsFormSnmp extends React.Component {
  handleChangeEventOnInput = ev => {
    const fieldName = ev.target.name;
    const fieldValue = ev.target.value;
    const newValue = {
      ...this.props.value,
      [fieldName]: fieldValue,
    };
    this.props.onChange(newValue);
  };

  renderSnmpV12() {
    const {
      value: { snmpv12_community = '' },
    } = this.props;
    return (
      <>
        <div className="field">
          <label>Community:</label>
          <input
            type="text"
            value={snmpv12_community}
            name="snmpv12_community"
            onChange={this.handleChangeEventOnInput}
          />
        </div>
      </>
    );
  }

  renderSnmpV3() {
    const {
      value: { snmpv3_sth = '' },
    } = this.props;
    return (
      <>
        <div className="field">
          <label>v3:</label>
          <input type="text" value={snmpv3_sth} name="snmpv3_sth" onChange={this.handleChangeEventOnInput} />
        </div>
      </>
    );
  }

  render() {
    const {
      value: { version = 'snmpv12' },
    } = this.props;
    return (
      <div className="nested-field">
        <div className="field">
          <label>Version:</label>
          <select value={version} name="version" onChange={this.handleChangeEventOnInput}>
            <option value="snmpv12">SNMP v1/2</option>
            <option value="snmpv3">SNMP v3</option>
          </select>
        </div>
        <div className="nested-field">
          {version !== 'snmpv3' ? this.renderSnmpV12() : this.renderSnmpV3()}
        </div>
      </div>
    );
  }
}
