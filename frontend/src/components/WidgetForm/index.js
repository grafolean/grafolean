import React from 'react';
import ChartForm from '../ChartForm';

export default class WidgetForm extends React.Component {
  static defaultProps = {
    dashboardSlug: null,
  }

  constructor(props) {
    super(props);
    this.state = {
      widget_type: 'chart',
    };
  }

  render() {
    return (
      <div>
        <select
          onChange={(ev) => this.setState({ widget_type: ev.target.value })}
        >
          <option value="chart">chart</option>
          <option value="last">last value</option>
        </select>

        {this.state.widget_type === 'chart' && (
          <ChartForm
            dashboardSlug={this.props.dashboardSlug}
          />
        )}

        {this.state.widget_type === 'last' && (
          <div>
            Yeah, that.
          </div>
        )}

      </div>
    );
  }
}
