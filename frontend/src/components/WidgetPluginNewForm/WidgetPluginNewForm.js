import React from 'react';
import { Redirect } from 'react-router-dom';
import { Formik } from 'formik';

import { ROOT_URL } from '../../store/actions';
import { fetchAuth } from '../../utils/fetch';
import Button from '../Button';

export default class WidgetPluginNewForm extends React.Component {
  static REPO_URL_REGEX = /^https:[/][/]github.com[/][^/]+[/][^/]+[/]?$/;
  state = {
    errorMsg: null,
    submitted: false,
  };

  validate = values => {
    const { repo_url = '' } = values;
    if (!repo_url.match(WidgetPluginNewForm.REPO_URL_REGEX)) {
      return {
        repo_url: 'Not a valid GitHub repository URL (example: https://github.com/username/repository)',
      };
    }
    return {};
  };

  handleSubmit = async (formValues, { setSubmitting }) => {
    const response = await fetchAuth(`${ROOT_URL}/plugins/widgets`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({
        repo_url: formValues.repo_url,
      }),
    });
    setSubmitting(false);
    if (!response.ok) {
      this.setState({
        errorMsg: await response.text(),
      });
      return;
    }
    this.setState({
      submitted: true,
    });
  };

  render() {
    const { submitted, errorMsg } = this.state;
    if (submitted) {
      return <Redirect to="/plugins/widgets" />;
    }
    return (
      <Formik
        initialValues={{
          repo_url: '',
        }}
        validate={this.validate}
        onSubmit={this.handleSubmit}
        isInitialValid={false}
      >
        {({
          values,
          errors,
          touched,
          handleChange,
          setFieldValue,
          handleBlur,
          handleSubmit,
          isSubmitting,
          isValid,
        }) => (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Plugin GitHub repository URL:</label>
              <input
                type="text"
                name="repo_url"
                value={values.repo_url}
                onChange={handleChange}
                onBlur={handleBlur}
              />
            </div>
            {errorMsg && (
              <div className="error info">
                <i className="fa fa-exclamation-triangle" /> {errorMsg}
              </div>
            )}
            <Button type="submit" isLoading={isSubmitting} disabled={!isValid}>
              Submit
            </Button>
          </form>
        )}
      </Formik>
    );
  }
}
