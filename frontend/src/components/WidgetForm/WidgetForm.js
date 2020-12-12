import React from 'react';
import { withRouter } from 'react-router-dom';

import NoPathsHelpSnippet from '../HelpSnippets/NoPathsHelpSnippet';
import { INITIAL_KNOWN_WIDGET_TYPES } from '../Widgets/knownWidgets';

import './WidgetForm.scss';
import FetchingFormik from '../FetchingFormik';

class WidgetForm extends React.Component {
  validate = values => {
    const { knownWidgetTypes } = this.props;
    if (!values.type) {
      return {
        type: 'widget type not selected',
      };
    }
    const selectedWidgetType = knownWidgetTypes[values.type];
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

  convertFetchedFormValues = fetchedFormValues => {
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

  fixValuesBeforeSubmit = formValues => {
    // note that this is not correct - we should also consider widget plugins:
    // (but this is a static method; some refactoring is in order before we can do that)
    const selectedWidgetType = INITIAL_KNOWN_WIDGET_TYPES[formValues.type];
    const x = {
      ...formValues,
      content: JSON.stringify(formValues.content),
      p: selectedWidgetType && selectedWidgetType.isHeaderWidget ? 'header' : formValues.p,
    };
    return x;
  };

  changeWidgetType = (ev, setFieldValue) => {
    const { knownWidgetTypes } = this.props;
    const widgetType = ev.target.value;
    setFieldValue('type', widgetType);
    // initialize to default values:
    const selectedWidgetType = knownWidgetTypes[widgetType];
    const initialFormContent =
      selectedWidgetType.formComponent === null ? {} : selectedWidgetType.formComponent.DEFAULT_FORM_CONTENT;
    setFieldValue('content', initialFormContent);
    setFieldValue('p', this.props.page);
  };

  render() {
    const { lockWidgetType, sharedValues, knownWidgetTypes } = this.props;

    return (
      <FetchingFormik
        convertFetchedFormValues={this.convertFetchedFormValues}
        fixValuesBeforeSubmit={this.fixValuesBeforeSubmit}
        validate={this.validate}
        resource={this.props.resource}
        editing={this.props.editing}
        afterSubmit={this.props.afterSubmit}
        afterSubmitRedirectTo={this.props.afterSubmitRedirectTo}
      >
        {({
          values,
          values: { type, title = '', content },
          errors,
          handleChange,
          setFieldValue,
          handleBlur,
        }) => {
          const selectedWidgetType = knownWidgetTypes[type];
          const WidgetTypeForm = selectedWidgetType ? selectedWidgetType.formComponent : null;
          return (
            <div className="widget-form">
              <NoPathsHelpSnippet />

              <div className="field">
                <label>Widget title:</label>
                <input type="text" name="title" value={title} onChange={handleChange} onBlur={handleBlur} />
              </div>

              {!lockWidgetType && (
                <div className="field">
                  <label>Type:</label>
                  {Object.values(knownWidgetTypes).map(wt => (
                    <label key={wt.type} className="widget-type">
                      <input
                        type="radio"
                        name="widget-type"
                        value={wt.type}
                        checked={values.type === wt.type}
                        onChange={ev => this.changeWidgetType(ev, setFieldValue)}
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
                    onChange={handleChange}
                    onBlur={handleBlur}
                    setFieldValue={setFieldValue}
                    content={content ? content : {}}
                    sharedValues={sharedValues}
                    {...selectedWidgetType.formAdditionalProps}
                  />
                </div>
              )}
            </div>
          );
        }}
      </FetchingFormik>
    );
  }
}

export default withRouter(WidgetForm);
