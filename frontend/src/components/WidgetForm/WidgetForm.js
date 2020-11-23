import React from 'react';
import { withRouter } from 'react-router-dom';

import isFormikForm from '../isFormikForm';
import NoPathsHelpSnippet from '../HelpSnippets/NoPathsHelpSnippet';

import { KNOWN_WIDGET_TYPES } from '../Widgets/knownWidgets';

import './WidgetForm.scss';

class WidgetForm extends React.Component {
  static validate = values => {
    if (!values.type) {
      return {
        type: 'widget type not selected',
      };
    }
    const selectedWidgetType = KNOWN_WIDGET_TYPES[values.type];
    if (selectedWidgetType['formComponent'].validate) {
      const validationResult = selectedWidgetType['formComponent'].validate(values.content);
      // We are not sure what we will receive, but if it is empty, we want to receive an empty object (which is
      // what formik expects). So we are a bit careful when checking:
      if (Array.isArray(validationResult) && validationResult.length === 0) {
        return {};
      } else if (typeof validationResult === 'object' && Object.keys(validationResult).length === 0) {
        return {};
      } else if (!validationResult) {
        return {};
      }
      // there was an error, return non-empty object:
      return {
        content: validationResult,
      };
    }
    return {};
  };

  static convertFetchedFormValues = fetchedFormValues => {
    return {
      ...fetchedFormValues,
      content: JSON.parse(fetchedFormValues.content),
      id: undefined,
      x: undefined,
      y: undefined,
      w: undefined,
      h: undefined,
    };
  };

  static fixValuesBeforeSubmit = formValues => {
    const selectedWidgetType = KNOWN_WIDGET_TYPES[formValues.type];
    const x = {
      ...formValues,
      content: JSON.stringify(formValues.content),
      p: selectedWidgetType.isHeaderWidget ? 'header' : formValues.p,
    };
    return x;
  };

  changeWidgetType = ev => {
    const widgetType = ev.target.value;
    this.props.setFieldValue('type', widgetType);
    // initialize to default values:
    const selectedWidgetType = KNOWN_WIDGET_TYPES[widgetType];
    const initialFormContent =
      selectedWidgetType.formComponent === null ? {} : selectedWidgetType.formComponent.DEFAULT_FORM_CONTENT;
    this.props.setFieldValue('content', initialFormContent);
    this.props.setFieldValue('p', this.props.page);
  };

  render() {
    const {
      values: { type, title = '', content },
      onChange,
      onBlur,
      setFieldValue,
      lockWidgetType,
      sharedValues,
    } = this.props;

    const selectedWidgetType = KNOWN_WIDGET_TYPES[type];
    const WidgetTypeForm = selectedWidgetType ? selectedWidgetType.formComponent : null;
    return (
      <div className="widget-form">
        <NoPathsHelpSnippet />

        <div className="field">
          <label>Widget title:</label>
          <input type="text" name="title" value={title} onChange={onChange} onBlur={onBlur} />
        </div>

        {!lockWidgetType && (
          <div className="field">
            <label>Type:</label>
            {Object.values(KNOWN_WIDGET_TYPES).map(wt => (
              <label key={wt.type} className="widget-type">
                <input
                  type="radio"
                  name="widget-type"
                  value={wt.type}
                  checked={type === wt.type}
                  onChange={this.changeWidgetType}
                />
                <i className={`fa fa-fw fa-${wt.icon} widget-type`} />
                {wt.label}
              </label>
            ))}
          </div>
        )}

        {WidgetTypeForm && (
          <div className="widget-type-form nested-field">
            <WidgetTypeForm
              onChange={onChange}
              onBlur={onBlur}
              setFieldValue={setFieldValue}
              content={content ? content : {}}
              sharedValues={sharedValues}
            />
          </div>
        )}
      </div>
    );
  }
}

export default isFormikForm(withRouter(WidgetForm));
