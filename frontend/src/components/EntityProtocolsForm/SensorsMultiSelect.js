import React from 'react';
import Checkbox from '../MultiSelect/Checkbox';

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
        interval: newInterval ? Number(newInterval) : null,
      },
    ];
    this.props.onChange(newSelectedSensors);
  }

  renderSensor(sensor, selectedSensor) {
    const isSensorSelected = Boolean(selectedSensor);
    return (
      <div key={sensor.id}>
        <Checkbox
          color="#663333"
          value={sensor.id}
          onChange={this.handleCheckboxChange}
          checked={isSensorSelected}
        >
          {sensor.name}
        </Checkbox>
        {isSensorSelected && (
          <div className="interval">
            Interval:{' '}
            {selectedSensor.interval ? (
              <>
                <input
                  type="number"
                  onChange={ev => this.handleIntervalChange(sensor.id, ev.target.value)}
                  value={selectedSensor.interval}
                />
                s
                <i className="fa fa-refresh" onClick={() => this.handleIntervalChange(sensor.id, null)} />
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
