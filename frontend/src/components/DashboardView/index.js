import React from 'react';

import store from '../../store'
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';

import Button from '../Button';
import Loading from '../Loading';
import ChartForm from '../ChartForm';
import MoonChartWidget from '../MoonChart';

export default class DashboardView extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      valid: true,
      widgets: [],
      newChartFormOpened: false,
    };
  }

  componentDidMount() {
    this.fetchDashboardDetails();
  }

  fetchDashboardDetails = () => {
    this.setState({
      loading: true,
    });
    fetch(`${ROOT_URL}/dashboards/${this.props.match.params.slug}`)
      .then(handleFetchErrors)
      .then(response => response.json()
        .then(json => {
          this.setState({
            name: json.name,
            widgets: json.widgets.map(w => ({
              type: w.type,
              title: w.title,
              content: JSON.parse(w.content),
            })),
            loading: false,
          })
        }),
      )
      .catch(errorMsg => {
        store.dispatch(onFailure(errorMsg.toString()));
        this.setState({
          valid: false,
          loading: false,
        })
      });
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

    if (!this.state.valid) {
      if (this.state.loading)
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
        {this.state.loading && (
          <Loading
            overlayParent={true}
          />
        )}
        <hr />

        {this.state.name}

        <div>
          {this.state.widgets.map((widget) => (
            <MoonChartWidget
              key={widget.id}
              width={this.props.width}
              height={500}
              chartId={widget.id}
              dashboardSlug={this.props.match.params.slug}
              title={widget.title}
              chartContent={widget.content}
              refreshParent={this.fetchDashboardDetails}
            />
          ))}
        </div>

        {(!this.state.newChartFormOpened) ? (
            <div>
              <Button onClick={this.handleShowNewChartForm}>+ add widget</Button>
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

