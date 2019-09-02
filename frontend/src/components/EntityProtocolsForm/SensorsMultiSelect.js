import React from 'react';
import Checkbox from '../MultiSelect/Checkbox';

export default class SensorsMultiSelect extends React.Component {
  handleCheckboxChange = sensorId => {
    const { selectedSensors } = this.props;
    const newSelectedSensors = selectedSensors.find(s => s.sensor === sensorId)
      ? selectedSensors.filter(s => s.sensor !== sensorId)
      : [...selectedSensors, { sensor: sensorId, interval: null }];
    this.props.onChange(newSelectedSensors);
  };

  render() {
    const { sensors, selectedSensors } = this.props;
    return (
      <div className="sensors-multi-select">
        {sensors.map(sensor => (
          <div key={sensor.id}>
            <span>
              <Checkbox
                color="#ff6600"
                value={sensor.id}
                onChange={this.handleCheckboxChange}
                checked={selectedSensors && Boolean(selectedSensors.find(s => s.sensor === sensor.id))}
              >
                {sensor.name}
              </Checkbox>
            </span>
          </div>
        ))}
      </div>
    );
  }
}
