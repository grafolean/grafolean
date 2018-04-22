import React from 'react';

import store from '../../store'
import { fetchDashboardDetails } from '../../store/actions';

import Button from '../Button';
import Loading from '../Loading';
import ChartForm from '../ChartForm';
import MoonChartWidget from '../MoonChart';

export default class DashboardView extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      newChartFormOpened: false,
    };
  }

  componentWillMount() {
    store.dispatch(fetchDashboardDetails(this.props.match.params.slug))
  }

  handleShowNewChartForm = (ev) => {
    ev.preventDefault();
    this.setState({
      newChartFormOpened: true,
    })
  }

  handleHideNewChartForm = (ev) => {
    ev.preventDefault();
    this.setState({
      newChartFormOpened: true,
    })
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
      <div
        style={{
          position: 'relative',
        }}
      >
        Dashboard:
        {this.props.fetching && (
          <Loading
            overlayParent={true}
          />
        )}
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
              refreshParent={() => store.dispatch(fetchDashboardDetails(this.props.match.params.slug))}
            />
          ))}
        </div>

        {(!this.state.newChartFormOpened) ? (
            <div>
                <Button onClick={this.handleShowNewChartForm}>+ add chart</Button>
            </div>
          ) : (
            <div>
              <Button onClick={this.handleHideNewChartForm}>- cancel</Button>
              <ChartForm dashboardSlug={this.props.match.params.slug}/>
            </div>
          )
        }
      </div>
    )
  }
};

