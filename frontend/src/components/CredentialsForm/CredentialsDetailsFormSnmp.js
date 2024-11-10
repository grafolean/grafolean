import React from 'react';

export default class CredentialsDetailsFormSnmp extends React.Component {
  DEFAULT_VALUES = {
    version: '',
    snmpv12_community: '',
  };

  componentDidMount() {
    this.ensureDefaultValue();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) {
      this.ensureDefaultValue();
    }
  }

  ensureDefaultValue() {
    if (Object.keys(this.props.value).length === 0) {
      this.props.onChange(this.DEFAULT_VALUES);
    }
  }

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
      value: {
        snmpv3_securityName = '',
        snmpv3_securityLevel = '',
        snmpv3_authProtocol = '',
        snmpv3_authKey = '',
        snmpv3_privProtocol = '',
        snmpv3_privKey = '',
      },
    } = this.props;
    /*
    http://www.net-snmp.org/tutorial/tutorial-5/commands/snmpv3.html
      Parameter	      Command Line Flag	            snmp.conf token
      securityName	  -u NAME	                      defSecurityName   NAME
      authProtocol	  -a (MD5|SHA)	                defAuthType       (MD5|SHA)
      privProtocol	  -x (AES|DES)	                defPrivType       DES
      authKey	        -A PASSPHRASE	                defAuthPassphrase PASSPHRASE
      privKey	        -X PASSPHRASE	                defPrivPassphrase PASSPHRASE
      securityLevel	  -l (noAuthNoPriv|authNoPriv|authPriv)
                                                    defSecurityLevel (noAuthNoPriv|authNoPriv|authPriv)
      context	        -n CONTEXTNAME                defContext CONTEXTNAME
    */
    return (
      <>
        <div className="field">
          <label>Security username / securityName:</label>
          <input
            type="text"
            value={snmpv3_securityName}
            name="snmpv3_securityName"
            onChange={this.handleChangeEventOnInput}
          />
        </div>
        <div className="field">
          <label>Security level:</label>
          <select
            value={snmpv3_securityLevel}
            name="snmpv3_securityLevel"
            onChange={this.handleChangeEventOnInput}
          >
            <option value="">-- please select --</option>
            <option value="noAuthNoPriv">noAuthNoPriv</option>
            <option value="authNoPriv">authNoPriv</option>
            <option value="authPriv">authPriv</option>
          </select>
        </div>
        {snmpv3_securityLevel.startsWith('auth') && (
          <div className="nested-field">
            <div className="field">
              <label>Authentication type / authProtocol:</label>
              <select
                value={snmpv3_authProtocol}
                name="snmpv3_authProtocol"
                onChange={this.handleChangeEventOnInput}
              >
                <option value="">-- please select --</option>
                <option value="MD5">MD5</option>
                <option value="SHA">SHA</option>
              </select>
            </div>
            <div className="field">
              <label>Authentication passphrase / authKey:</label>
              <input
                type="text"
                value={snmpv3_authKey}
                name="snmpv3_authKey"
                onChange={this.handleChangeEventOnInput}
              />
            </div>
          </div>
        )}
        {snmpv3_securityLevel === 'authPriv' && (
          <div className="nested-field">
            <div className="field">
              <label>Privacy protocol / privProtocol:</label>
              <select
                value={snmpv3_privProtocol}
                name="snmpv3_privProtocol"
                onChange={this.handleChangeEventOnInput}
              >
                <option value="">-- please select --</option>
                <option value="AES">AES</option>
                <option value="DES">DES</option>
              </select>
            </div>
            <div className="field">
              <label>Privacy passphrase / privKey:</label>
              <input
                type="text"
                value={snmpv3_privKey}
                name="snmpv3_privKey"
                onChange={this.handleChangeEventOnInput}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  render() {
    if (Object.keys(this.props.value).length === 0) {
      return null;
    }

    const {
      value: { version = 'snmpv12' },
    } = this.props;
    return (
      <div className="nested-field">
        <div className="field">
          <label>Version:</label>
          <select value={version} name="version" onChange={this.handleChangeEventOnInput}>
            <option value="">-- please select SNMP version --</option>
            <option value="snmpv1">SNMP v1</option>
            <option value="snmpv2c">SNMP v2c</option>
            <option value="snmpv3">SNMP v3</option>
          </select>
        </div>
        <div className="nested-field">
          {version === 'snmpv1' || version === 'snmpv2c'
            ? this.renderSnmpV12()
            : version === 'snmpv3'
              ? this.renderSnmpV3()
              : null}
        </div>
      </div>
    );
  }
}
