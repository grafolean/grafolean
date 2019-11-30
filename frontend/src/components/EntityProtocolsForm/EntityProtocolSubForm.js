import React from 'react';
import SensorsMultiSelect from './SensorsMultiSelect';

export default class EntityProtocolSubForm extends React.Component {
  render() {
    const {
      protocol,
      values: { protocols = {} },
      onChange,
      onBlur,
      setFieldValue,
      credentials,
      bots,
      sensors,
    } = this.props;

    const credentialId =
      protocols[protocol.slug] && protocols[protocol.slug]['credential']
        ? protocols[protocol.slug]['credential']
        : null;
    const selectedBotId =
      protocols[protocol.slug] && protocols[protocol.slug]['bot'] ? protocols[protocol.slug]['bot'] : null;
    const selectedSensors =
      protocols[protocol.slug] && protocols[protocol.slug]['sensors']
        ? protocols[protocol.slug]['sensors']
        : [];
    return (
      <div key={protocol.slug} className="field">
        <label>{protocol.label}</label>

        <div className="nested-field">
          {credentials.length === 0 ? (
            <p>No credentials available for protocol {protocol.label}.</p>
          ) : bots.length === 0 ? (
            <p>No bots available for protocol {protocol.label}.</p>
          ) : sensors.length === 0 ? (
            <p>No sensors available for protocol {protocol.label}.</p>
          ) : (
            <>
              <div className="nested-field">
                <span className="label">Credentials:</span>
                <select
                  value={credentialId || ''}
                  name={`protocols[${protocol.slug}][credential]`}
                  onChange={onChange}
                  onBlur={onBlur}
                >
                  <option value="">-- disabled --</option>
                  {credentials.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {credentialId && (
                <div className="nested-field">
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
                <div className="nested-field">
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
