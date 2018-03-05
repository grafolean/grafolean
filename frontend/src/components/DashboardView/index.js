import React from 'react';

import store from '../../store'
import { fetchDashboardDetails } from '../../store/actions';

import Loading from '../Loading';
import ChartAddForm from '../ChartAddForm';
import RePinchy from '../RePinchy';
import MoonChart from '../MoonChart';

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
        {(this.props.fetching)?(
          <Loading />
        ):('')}

        {this.props.data.name}

        <div>
          {this.props.data.charts.map((v) => {
            return (
              <RePinchy
                key={v.id}
                width={600}
                height={300}
                padLeft={60}
                initialState={{
                  x: -1234567820.0,
                  y: 0.0,
                  scale: 1.0,
                }}
              >
                {(w, h, x, y, scale, zoomInProgress) => (
                  <MoonChart
                    chartId={v.id}
                    paths={v.paths}
                    portWidth={w}
                    portHeight={h}
                    panX={-x}
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

