import React from 'react';
import { withRouter, Link } from 'react-router-dom';

import SensorsMultiSelect from './SensorsMultiSelect';

class EntityProtocolSubForm extends React.Component {
  componentDidUpdate(prevProps) {
    // whenever credentials are first selected, if there is only a single bot available, select it by default:
    if (
      (!prevProps.values || !prevProps.values.credential) &&
      this.props.values &&
      this.props.values.credential &&
      this.props.bots.length === 1 &&
      !this.props.values.selectedBotId
    ) {
      const { setFieldValue, protocol, bots } = this.props;
      setFieldValue(`protocols[${protocol.slug}][bot]`, bots[0].id, true);
    }
  }

  render() {
    const { protocol, values = {}, onChange, onBlur, setFieldValue, credentials, bots, sensors } = this.props;
    const { accountId } = this.props.match.params;

    const credentialId = values['credential'] ? values['credential'] : null;
    const selectedBotId = values['bot'] ? values['bot'] : null;
    const selectedSensors = values['sensors'] ? values['sensors'] : [];
    return (
      <div key={protocol.slug} className="field framed-field entity-protocol-subform">
        <label>{protocol.label}</label>

        <div className="nested-field">
          {credentials.length === 0 ? (
            <p>
              No <Link to={`/accounts/${accountId}/credentials`}>credentials</Link> available for protocol{' '}
              {protocol.label}.
            </p>
          ) : bots.length === 0 ? (
            <p>
              No <Link to={`/accounts/${accountId}/bots`}>bots</Link> available for protocol {protocol.label}.
            </p>
          ) : sensors.length === 0 ? (
            <p>
              No <Link to={`/accounts/${accountId}/sensors`}>sensors</Link> available for protocol{' '}
              {protocol.label}.
            </p>
          ) : (
            <>
              <div className="nested-field credentials">
                <span className="label">Credentials:</span>
                <select
                  value={credentialId || ''}
                  name={`protocols[${protocol.slug}][credential]`}
                  onChange={onChange}
                  onBlur={onBlur}
                >
                  <option value="">-- please select to enable --</option>
                  {credentials.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {credentialId && (
                <div className="nested-field bot">
                  <span className="label">Bot fetching this data:</span>
                  <select
                    value={selectedBotId || ''}
                    name={`protocols[${protocol.slug}][bot]`}
                    onChange={onChange}
                    onBlur={onBlur}
                  >
                    <option value="">-- please select --</option>
                    {bots.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {credentialId && (
                <div className="nested-field sensors">
                  <span className="label">Enabled sensors:</span>
                  <SensorsMultiSelect
                    sensors={sensors}
                    selectedSensors={selectedSensors}
                    onChange={newSelectedSensors =>
                      setFieldValue(`protocols[${protocol.slug}][sensors]`, newSelectedSensors)
                    }
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
}

export default withRouter(EntityProtocolSubForm);
