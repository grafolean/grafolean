import React from 'react';

export default class SensorsMultiSelect extends React.Component {
  render() {
    const { sensors } = this.props;
    return (
      <table>
        <thead>
          <tr>
            <th>[ ]</th>
            <th>
              <input type="text" />
              <i className="fa fa-filter" />
            </th>
            <th>Override default interval</th>
          </tr>
        </thead>
        <tbody>
          {sensors.map(sensor => (
            <tr key={sensor.id}>
              <td>[ ]</td>
              <td>{sensor.name}</td>
              <td>
                [ ] <input type="number" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
}
