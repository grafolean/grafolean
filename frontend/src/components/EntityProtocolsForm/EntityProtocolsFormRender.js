import React from 'react';
import { withRouter } from 'react-router-dom';

import isFormikForm from '../isFormikForm';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';
import { PersistentFetcher } from '../../utils/fetch';
import Loading from '../Loading';
import SensorsMultiSelect from './SensorsMultiSelect';

class EntityProtocolsFormRender extends React.Component {
  state = {
    accountCredentials: null,
    accountSensors: null,
  };

  validate = values => {
    return {};
  };

  renderProtocolCredentialAndSensors(protocol) {
    const {
      values: { protocols = {} },
      onChange,
      onBlur,
      setFieldValue,
    } = this.props;
    const { accountCredentials, accountSensors } = this.state;

    const credentialId =
      protocols[protocol.slug] && protocols[protocol.slug]['credential']
        ? protocols[protocol.slug]['credential']
        : null;
    const sensors = accountSensors.filter(s => s.protocol === protocol.slug);
    const selectedSensors =
      protocols[protocol.slug] && protocols[protocol.slug]['sensors']
        ? protocols[protocol.slug]['sensors']
        : [];
    const credentials = accountCredentials.filter(c => c.protocol === protocol.slug);
    return (
      <div className="field">
        <label>{protocol.label}:</label>

        <div className="nested-field">
          {credentials.length === 0 ? (
            <p>
              No credentials available for protocol <i>{protocol.label}</i>.
            </p>
          ) : (
            <select
              value={credentialId}
              name={`protocols[${protocol.slug}][credential]`}
              onChange={onChange}
              onBlur={onBlur}
            >
              <option value="">-- disabled --</option>
              {credentials.map(c => (
                <option value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          {credentialId && (
            <SensorsMultiSelect
              sensors={sensors}
              selectedSensors={selectedSensors}
              onChange={newSelectedSensors =>
                setFieldValue(`protocols[${protocol.slug}][sensors]`, newSelectedSensors)
              }
            />
          )}
        </div>
      </div>
    );
  }

  render() {
    const {
      values: { name = '' },
      onChange,
      onBlur,
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
                {SUPPORTED_PROTOCOLS.map(protocol => this.renderProtocolCredentialAndSensors(protocol))}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}

export default isFormikForm(withRouter(EntityProtocolsFormRender));
