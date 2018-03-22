import React from 'react';
import moment from 'moment';

import store from '../../store'
import { fetchDashboardDetails } from '../../store/actions';

import Loading from '../Loading';
import ChartAddForm from '../ChartAddForm';
import RePinchy from '../RePinchy';
import MoonChartContainer from '../MoonChart';

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

    const width = 600, height = 300;
    const chartWidth = 540;
    const toTs = moment().unix();
    const fromTs = moment().subtract(1, 'month').unix();
    const initialScale = chartWidth / (toTs - fromTs);
    const initialPanX = - fromTs * initialScale;
    return (
      <div>
        Dashboard:
        <hr />
        {(this.props.fetching)?(
          <Loading />
        ):('')}

        {this.props.data.name}

        <div>
          {this.props.data.charts.map((v) => {
            return (
              <RePinchy
                key={v.id}
                width={width}
                height={height}
                padLeft={width - chartWidth}
                initialState={{
                  x: initialPanX,
                  y: 0.0,
                  scale: initialScale,
                }}
              >
                {(w, h, x, y, scale, zoomInProgress) => (
                  <MoonChartContainer
                    chartId={v.id}
                    paths={v.paths}
                    portWidth={w}
                    portHeight={h}
                    fromTs={Math.round(-x/scale)}
                    toTs={Math.round(-x/scale) + Math.round(w / scale)}
                    scale={scale}
                    zoomInProgress={zoomInProgress}
                  />
                )}
              </RePinchy>
            )
          })}
        </div>

        <ChartAddForm dashboardSlug={this.props.match.params.slug}/>
      </div>
    )
  }
};

