import React from 'react';
import { withRouter } from 'react-router-dom';

import isFormikForm from '../isFormikForm';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';
import { PersistentFetcher } from '../../utils/fetch';
import Loading from '../Loading';
import MultiSelect from '../MultiSelect/MultiSelect';

class EntityProtocolsFormRender extends React.Component {
  state = {
    accountCredentials: null,
    accountSensors: null,
  };

  validate = values => {
    return {};
  };

  renderForm() {
    const {
      values: { name = '', protocols = {} },
      onChange,
      onBlur,
      setFieldValue,
    } = this.props;
    const { accountCredentials, accountSensors } = this.state;

    return (
      <div className="frame">
        <div className="field">
          <label>Name:</label>
          <input type="text" value={name} name="name" onChange={onChange} onBlur={onBlur} />
        </div>

        <div className="field">
          <label>Protocols:</label>
          <div className="nested-field">
            {SUPPORTED_PROTOCOLS.map(protocol => (
              <ProtocolCredentialAndSensorsSubForm
                protocolLabel={protocol.label}
                protocolSlug={protocol.slug}
                credentialId={protocols[protocol.slug] ? protocols[protocol.slug]['credential'] : null}
                sensorsIds={protocols[protocol.slug] ? protocols[protocol.slug]['sensors'] : null}
                credentialsOptions={accountCredentials.filter(c => c.protocol === protocol.slug)}
                sensorsOptions={accountSensors.filter(s => s.protocol === protocol.slug)}
                onChange={onChange}
                onBlur={onBlur}
                setFieldValue={setFieldValue}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  render() {
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
        {accountCredentials === null || accountSensors === null ? <Loading /> : this.renderForm()}
      </>
    );
  }
}

class ProtocolCredentialAndSensorsSubForm extends React.Component {
  render() {
    const {
      protocolLabel,
      protocolSlug,
      credentialId,
      sensorsIds,
      credentialsOptions,
      sensorsOptions,
      onChange,
      onBlur,
      setFieldValue,
    } = this.props;
    return (
      <div className="field">
        <label>{protocolLabel}:</label>

        <div className="nested-field">
          {credentialsOptions.length === 0 ? (
            <p>
              No credentials available for protocol <i>{protocolLabel}</i>.
            </p>
          ) : (
            <select
              value={credentialId}
              name={`protocols[${protocolSlug}][credential]`}
              onChange={onChange}
              onBlur={onBlur}
            >
              <option value="">-- disabled --</option>
              {credentialsOptions.map(c => (
                <option value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          {credentialId && (
            <div className="field">
              <label>Sensors:</label>
              <MultiSelect
                options={sensorsOptions.map(s => ({ id: s.id, label: s.name }))}
                initialSelectedOptionsIds={sensorsIds}
                onChangeSelected={sensorsIds =>
                  setFieldValue(`protocols[${protocolSlug}][sensors]`, sensorsIds, true)
                }
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default isFormikForm(withRouter(EntityProtocolsFormRender));
