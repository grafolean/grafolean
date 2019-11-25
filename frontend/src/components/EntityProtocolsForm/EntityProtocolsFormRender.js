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
  };

  static validate = values => {
    return {};
  };

  render() {
    const {
      values,
      values: { name = '' },
      onChange,
      onBlur,
      setFieldValue,
    } = this.props;
    const { accountCredentials, accountSensors } = this.state;
    const { accountId } = this.props.match.params;
    return (
      <>
        <PersistentFetcher
          resource={`accounts/${accountId}/credentials`}
          onUpdate={response => this.setState({ accountCredentials: response['list'] })}
        />
        <PersistentFetcher
          resource={`accounts/${accountId}/sensors`}
          onUpdate={response => this.setState({ accountSensors: response['list'] })}
        />

        {accountCredentials === null || accountSensors === null ? (
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
