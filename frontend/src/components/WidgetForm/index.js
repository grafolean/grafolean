import React from 'react';
import { stringify } from 'qs';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onSuccess, onFailure } from '../../store/actions';

import ChartForm from '../ChartForm';
import Loading from '../Loading';
import LastValueForm from '../Widgets/LastValueWidget/LastValueForm';
import { fetchAuth } from '../../utils/fetch';

import '../form.scss';
import Button from '../Button';

const WIDGET_TYPES = [
  { type: 'chart', label: 'chart', form: ChartForm },
  { type: 'lastvalue', label: 'last value', form: LastValueForm },
];

export default class WidgetForm extends React.Component {
  static defaultProps = {
    dashboardSlug: null,
    widgetId: null,
  };

  alteredWidgetData = {};
  fetchWidgetDataAbortController = null;

  constructor(props) {
    super(props);
    this.state = {
      loading: this.props.widgetId ? true : false,
      errorFetching: false,
      widgetType: props.widgetId ? null : WIDGET_TYPES[0].type,
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
      `${ROOT_URL}/accounts/1/dashboards/${this.props.dashboardSlug}/widgets/${
        this.props.widgetId
      }?${stringify(query_params)}`,
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
        this.fetchPathsAbortController = null;
      });
  };

  handleNameChange = ev => {
    this.setState({
      widgetName: ev.target.value,
    });
  };

  handleFormContentChange = (widgetType, content, valid) => {
    this.alteredWidgetData[widgetType] = {
      content,
      valid,
    };
  };

  handleSubmit = ev => {
    ev.preventDefault();

    const { widgetType, widgetName } = this.state;
    if (!this.alteredWidgetData[widgetType].valid) {
      store.dispatch(onFailure('Form contents not valid!'));
      return;
    }

    const params = {
      type: widgetType,
      title: widgetName,
      content: JSON.stringify(this.alteredWidgetData[widgetType].content),
    };
    fetchAuth(
      `${ROOT_URL}/accounts/1/dashboards/${this.props.dashboardSlug}/widgets/${this.props.widgetId || ''}`,
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
        store.dispatch(
          onSuccess(
            this.props.widgetId ? 'Widget successfully updated.' : 'New widget successfully created.',
          ),
        );
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  render() {
    const { loading, errorFetching, widgetType, widgetName, widgetContent, submitting } = this.state;
    const { formid, lockWidgetType } = this.props;
    if (loading) {
      return <Loading />;
    }
    if (errorFetching) {
      return <div>Error fetching data.</div>;
    }

    const WidgetTypeForm = WIDGET_TYPES.find(wt => wt.type === widgetType).form;
    return (
      <div>
        <form id={formid} style={{ marginTop: 20 }}>
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

          <WidgetTypeForm onChange={this.handleFormContentChange} initialFormContent={widgetContent} />

          <Button isLoading={submitting} onClick={this.handleSubmit} disabled={widgetName.length === 0}>
            Submit
          </Button>
        </form>
      </div>
    );
  }
}
