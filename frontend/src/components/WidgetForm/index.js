import React from 'react';
import { connect } from 'react-redux';
import { stringify } from 'qs';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import { fetchAuth } from '../../utils/fetch';
import Button from '../Button';
import Loading from '../Loading';

import ChartForm from '../Widgets/GLeanChartWidget/ChartForm';
import LastValueForm from '../Widgets/LastValueWidget/LastValueForm';

import '../form.scss';
import './widgetForm.scss';

const WIDGET_TYPES = [
  { type: 'chart', label: 'chart', form: ChartForm },
  { type: 'lastvalue', label: 'last value', form: LastValueForm },
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
      widgetType: this.props.widgetId ? null : WIDGET_TYPES[0].type,
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
      `${ROOT_URL}/accounts/${this.props.accounts.selected.id}/dashboards/${
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
      `${ROOT_URL}/accounts/${this.props.accounts.selected.id}/dashboards/${
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

    const WidgetTypeForm = WIDGET_TYPES.find(wt => wt.type === widgetType).form;
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
              <select onChange={ev => this.setState({ widgetType: ev.target.value })} value={widgetType}>
                {WIDGET_TYPES.map(wt => (
                  <option key={wt.type} value={wt.type}>
                    {wt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="widget-type-form">
            <WidgetTypeForm onChange={this.handleFormContentChange} initialFormContent={widgetContent} />
          </div>

          <Button isLoading={submitting} onClick={this.handleSubmit} disabled={widgetName.length === 0}>
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
export default connect(mapStoreToProps)(WidgetForm);
