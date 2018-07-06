import React from 'react';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onSuccess, onFailure } from '../../store/actions';

import ChartForm from '../ChartForm';
import Loading from '../Loading';
import LastValueForm from '../Widgets/LastValueWidget/LastValueForm';

const WIDGET_TYPES = [
  { type: 'chart', label: 'chart', form: ChartForm },
  { type: 'lastvalue', label: 'last value', form: LastValueForm },
]

export default class WidgetForm extends React.Component {
  static defaultProps = {
    dashboardSlug: null,
    widgetId: null,
    lockWidgetType: null,
  }

  formValues = {};

  constructor(props) {
    super(props);
    this.state = {
      widgetType: props.lockWidgetType ? props.lockWidgetType : WIDGET_TYPES[0].type,
    };
  }

  handleFormContentChange = (widgetType, title, content, valid) => {
    this.formValues[widgetType] = {
      title,
      content,
      valid,
    }
  }

  handleSubmit = (widgetType) => {
    const widgetTypeFormValues = this.formValues[widgetType];
    if (!widgetTypeFormValues.valid) {
      store.dispatch(onFailure("Form contents not valid!"));
      return;
    };

    const params = {
      type: widgetType,
      title: widgetTypeFormValues.title,
      content: JSON.stringify(widgetTypeFormValues.content),
    }
    fetch(`${ROOT_URL}/dashboards/${this.props.dashboardSlug}/widgets/${this.props.widgetId || ''}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      method: this.props.widgetId ? 'PUT' : 'POST',
      body: JSON.stringify(params),
    })
      .then(handleFetchErrors)
      .then(() => {
        store.dispatch(onSuccess(this.props.widgetId ? 'Widget successfully updated.' : 'New widget successfully created.'));
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())))
  }


  render() {
    const WidgetTypeForm = WIDGET_TYPES.find(wt => wt.type === this.state.widgetType).form;
    return (
      <div>
        <form id={this.props.formid} onSubmit={(ev) => { ev.preventDefault(); this.handleSubmit(this.state.widgetType); }}>
          {!this.props.lockWidgetType && (
            <select
              onChange={(ev) => this.setState({ widgetType: ev.target.value })}
            >
              {WIDGET_TYPES.map(wt => (
                <option
                  key={wt.type}
                  value={wt.type}
                >
                  {wt.label}
                </option>
              ))}
            </select>
          )}

          <WidgetTypeForm
            onChange={this.handleFormContentChange}
            initialFormData={this.props.initialFormData}
          />

          {(this.state.submitting) ? (
            <Loading />
          ) : (
            <input type="submit" value="Submit" />
          )}
        </form>
      </div>
    );
  }
}
