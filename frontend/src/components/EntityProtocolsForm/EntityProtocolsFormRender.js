import React from 'react';
import { withRouter } from 'react-router-dom';

import isFormikForm from '../isFormikForm';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import Loading from '../Loading';
import EntityProtocolSubForm from './EntityProtocolSubForm';

class EntityProtocolsFormRender extends React.Component {
  state = {
    accountCredentials: null,
    accountSensors: null,
    accountBots: null,
    systemwideBots: null,
  };

  static validate = values => {
    let errors = {};
    for (let protocol in values.protocols) {
      if (!values.protocols[protocol].credential) {
        continue;
      }
      if (!values.protocols[protocol].bot) {
        const protocolInfo = SUPPORTED_PROTOCOLS.find(p => p.slug === protocol);
        errors['protocols'] = {
          [protocol]: {
            bot: `Please specify a bot for protocol: ${protocolInfo.label}`,
          },
        };
      }
    }
    return errors;
  };

  render() {
    const {
      values,
      values: { name = '' },
      onChange,
      onBlur,
      setFieldValue,
    } = this.props;
    const { accountId } = this.props.match.params;
    const { accountCredentials, accountSensors, accountBots, systemwideBots } = this.state;
    const bots = accountBots === null || systemwideBots === null ? null : accountBots.concat(systemwideBots);
    return (
      <>
        <PersistentFetcher
          resource={`accounts/${accountId}/credentials`}
          onUpdate={response => this.setState({ accountCredentials: response.list })}
        />
        <PersistentFetcher
          resource={`accounts/${accountId}/sensors`}
          onUpdate={response => this.setState({ accountSensors: response.list })}
        />
        <PersistentFetcher
          resource={`accounts/${accountId}/bots`}
          onUpdate={response => this.setState({ accountBots: response.list })}
        />
        <PersistentFetcher
          resource={`bots`}
          onUpdate={response => this.setState({ systemwideBots: response.list })}
        />

        {accountCredentials === null || accountSensors === null || bots === null ? (
          <Loading />
        ) : (
          <div className="frame">
            <div className="field">
              <label>Name:</label>
              <input type="text" value={name} name="name" onChange={onChange} onBlur={onBlur} />
            </div>

            <div className="field">
              <label>Protocols:</label>
              <div className="nested-field">
                {SUPPORTED_PROTOCOLS.map(protocol => (
                  <EntityProtocolSubForm
                    key={protocol.slug}
                    values={values}
                    onChange={onChange}
                    onBlur={onBlur}
                    setFieldValue={setFieldValue}
                    protocol={protocol}
                    credentials={accountCredentials.filter(c => c.protocol === protocol.slug)}
                    sensors={accountSensors.filter(s => s.protocol === protocol.slug)}
                    bots={bots.filter(b => b.protocol === protocol.slug)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}

export default isFormikForm(withRouter(EntityProtocolsFormRender));
