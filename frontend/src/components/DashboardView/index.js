import React from 'react';

import store from '../../store'
import { fetchDashboardDetails } from '../../store/actions';

import Loading from '../Loading';
import ChartAddForm from '../ChartAddForm';
import MoonChartWidget from '../MoonChart';

export default class DashboardView extends React.Component {

  componentWillMount() {
    store.dispatch(fetchDashboardDetails(this.props.match.params.slug))
  }

  render() {

    if (!this.props.valid) {
      if (this.props.fetching)
        return <Loading />
      else
        return (
          <div>
            Could not fetch data - please try again.
          </div>
        )
    }

    return (
      <div>
        Dashboard:
        <hr />

        {this.props.data.name}

        <div>
          {this.props.data.charts.map((chart) => (
            <MoonChartWidget
              key={chart.id}
              width={700}
              height={300}
              chartId={chart.id}
              dashboardSlug={this.props.match.params.slug}
              title={chart.name}
              paths={chart.paths}
            />
          ))}
        </div>

        <ChartAddForm dashboardSlug={this.props.match.params.slug}/>
      </div>
    )
  }
};

