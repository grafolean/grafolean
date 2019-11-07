import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { stringify } from 'qs';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import { fetchAuth } from '../../utils/fetch';
import Button from '../Button';
import Loading from '../Loading';

import ChartForm from '../Widgets/GLeanChartWidget/ChartForm/ChartForm';
import LastValueForm from '../Widgets/LastValueWidget/LastValueForm';

import '../form.scss';
import './widgetForm.scss';

const WIDGET_TYPES = [
  { type: 'chart', icon: 'area-chart', label: 'chart', form: ChartForm },
  { type: 'lastvalue', icon: 'thermometer-half', label: 'last value', form: LastValueForm },
];

class WidgetForm extends React.Component {
  static defaultProps = {
    dashboardSlug: null,
    widgetId: null,
    onUpdate: () => {},
  };

  alteredWidgetData = {};
  fetchWidgetDataAbortController = null;

  constructor(props) {
    super(props);
    this.state = {
      loading: this.props.widgetId ? true : false,
      errorFetching: false,
      widgetType: null,
      widgetName: '',
      widgetContent: null,
    };
    if (this.props.widgetId) {
      this.fetchWidgetData();
    }
  }

  componentWillUnmount() {
    if (this.fetchWidgetDataAbortController !== null) {
      this.fetchWidgetDataAbortController.abort();
      this.fetchWidgetDataAbortController = null;
    }
  }

  fetchWidgetData = () => {
    this.fetchWidgetDataAbortController = new window.AbortController();
    const query_params = {
      paths_limit: 0,
    };
    fetchAuth(
      `${ROOT_URL}/accounts/${this.props.match.params.accountId}/dashboards/${
        this.props.dashboardSlug
      }/widgets/${this.props.widgetId}?${stringify(query_params)}`,
      { signal: this.fetchWidgetDataAbortController.signal },
    )
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => {
        const content = JSON.parse(json.content);
        this.alteredWidgetData[json.type] = {
          valid: true,
          content: content,
        };
        this.setState({
          widgetName: json.title,
          widgetType: json.type,
          widgetContent: content,
          loading: false,
        });
      })
      .catch(errorMsg => {
        console.error(errorMsg);
        this.setState({
          fetchingError: true,
          loading: false,
        });
      })
      .then(() => {
        this.fetchWidgetDataAbortController = null;
      });
  };

  handleNameChange = ev => {
    this.setState({
      widgetName: ev.target.value,
    });
  };

  handleFormContentChange = (widgetType, content, valid) => {
    this.alteredWidgetData[widgetType] = {
      valid: valid,
      content: content,
    };
  };

  handleSubmit = ev => {
    ev.preventDefault();

    const { widgetType, widgetName } = this.state;
    if (!this.alteredWidgetData[widgetType] || !this.alteredWidgetData[widgetType].valid) {
      store.dispatch(onFailure('Form contents not valid!'));
      return;
    }

    const params = {
      type: widgetType,
      title: widgetName,
      content: this.alteredWidgetData[widgetType]
        ? JSON.stringify(this.alteredWidgetData[widgetType].content)
        : null,
    };
    fetchAuth(
      `${ROOT_URL}/accounts/${this.props.match.params.accountId}/dashboards/${
        this.props.dashboardSlug
      }/widgets/${this.props.widgetId || ''}`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: this.props.widgetId ? 'PUT' : 'POST',
        body: JSON.stringify(params),
      },
    )
      .then(handleFetchErrors)
      .then(() => {
        this.props.onUpdate();
        if (this.props.afterUpdateRedirectTo) {
          this.props.history.push(this.props.afterUpdateRedirectTo);
        }
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  render() {
    const { loading, errorFetching, widgetType, widgetName, widgetContent, submitting } = this.state;
    const { lockWidgetType } = this.props;
    if (loading) {
      return <Loading />;
    }
    if (errorFetching) {
      return <div>Error fetching data.</div>;
    }

    const selectedWidgetType = WIDGET_TYPES.find(wt => wt.type === widgetType);
    const WidgetTypeForm = selectedWidgetType ? selectedWidgetType.form : null;
    return (
      <div className="widget-form">
        <form>
          <div className="field">
            <label>Widget title:</label>
            <input type="text" name="name" value={widgetName} onChange={this.handleNameChange} />
          </div>

          {!lockWidgetType && (
            <div className="field">
              <label>Type:</label>
              {WIDGET_TYPES.map(wt => (
                <i
                  key={wt.type}
                  className={`fa fa-${wt.icon} widget-type ${widgetType === wt.type && 'selected'}`}
                  onClick={ev => this.setState({ widgetType: wt.type })}
                />
              ))}
            </div>
          )}

          {WidgetTypeForm && (
            <div className="widget-type-form">
              <WidgetTypeForm onChange={this.handleFormContentChange} initialFormContent={widgetContent} />
            </div>
          )}

          <Button
            isLoading={submitting}
            onClick={this.handleSubmit}
            disabled={!selectedWidgetType || widgetName.length === 0}
          >
            Submit
          </Button>
        </form>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  accounts: store.accounts,
});
export default withRouter(connect(mapStoreToProps)(WidgetForm));
