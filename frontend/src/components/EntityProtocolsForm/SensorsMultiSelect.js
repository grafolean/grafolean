import React from 'react';
import Checkbox from '../MultiSelect/Checkbox';

import './SensorsMultiSelect.scss';

export default class SensorsMultiSelect extends React.Component {
  DEFAULT_INTERVAL = 300;

  handleCheckboxChange = sensorId => {
    const { selectedSensors } = this.props;
    const newSelectedSensors = selectedSensors.find(s => s.sensor === sensorId)
      ? selectedSensors.filter(s => s.sensor !== sensorId)
      : [...selectedSensors, { sensor: sensorId, interval: null }];
    this.props.onChange(newSelectedSensors);
  };

  handleIntervalChange(sensorId, newInterval) {
    const { selectedSensors } = this.props;
    const newSelectedSensors = [
      ...selectedSensors.filter(s => s.sensor !== sensorId),
      {
        sensor: sensorId,
        interval: newInterval,
      },
    ];
    this.props.onChange(newSelectedSensors);
  }

  renderSensor(sensor, selectedSensor) {
    const isSensorSelected = Boolean(selectedSensor);
    return (
      <div key={sensor.id}>
        <Checkbox
          color="#3671bd"
          value={sensor.id}
          onChange={this.handleCheckboxChange}
          checked={isSensorSelected}
        >
          {sensor.name}
        </Checkbox>
        {isSensorSelected && sensor.default_interval && (
          <div className="interval">
            Interval:{' '}
            {selectedSensor.interval !== null ? (
              <>
                <input
                  type="text"
                  onChange={ev => this.handleIntervalChange(sensor.id, ev.target.value)}
                  value={selectedSensor.interval}
                />
                s
                <i className="fa fa-undo" onClick={() => this.handleIntervalChange(sensor.id, null)} />
              </>
            ) : (
              <>
                {sensor.default_interval ? sensor.default_interval : this.DEFAULT_INTERVAL}s
                <i
                  className="fa fa-pencil"
                  onClick={() =>
                    this.handleIntervalChange(sensor.id, sensor.default_interval || this.DEFAULT_INTERVAL)
                  }
                />
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  render() {
    const { sensors, selectedSensors } = this.props;
    return (
      <div className="sensors-multi-select">
        {sensors.map(sensor =>
          this.renderSensor(sensor, selectedSensors && selectedSensors.find(s => s.sensor === sensor.id)),
        )}
      </div>
    );
  }
}
