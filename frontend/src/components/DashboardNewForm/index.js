import React from 'react';
import { Redirect } from 'react-router-dom';
import { Formik } from 'formik';

import { ROOT_URL } from '../../store/actions';
import { fetchAuth } from '../../utils/fetch';
import Button from '../Button';

import '../form.scss';

import NETFLOW_TEMPLATE from './netflow.template.json';
const DASHBOARD_TEMPLATES = [NETFLOW_TEMPLATE];

export default class DashboardNewForm extends React.Component {
  state = {
    submitted: false,
    newSlug: null,
    errorMsg: '',
  };

  validate = values => {
    const { name = '' } = values;
    if (name.length === 0) {
      return { name: 'Name must not be empty' };
    }
    return {};
  };

  async createWidgetsFromTemplate(dashboardSlug, widgets) {
    const { accountId } = this.props.match.params;
    let positions = [];
    for (let i = 0; i < widgets.length; i++) {
      const params = {
        type: widgets[i].type,
        title: widgets[i].title,
        p: widgets[i].p,
        content: widgets[i].content,
      };
      const response = await fetchAuth(
        `${ROOT_URL}/accounts/${accountId}/dashboards/${dashboardSlug}/widgets`,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify(params),
        },
      );
      if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(`Error creating widgets: ${errorMsg}`);
      }
      const json = await response.json();
      positions.push({
        widget_id: json.id,
        x: widgets[i].x,
        y: widgets[i].y,
        w: widgets[i].w,
        h: widgets[i].h,
        p: widgets[i].p,
      });
    }
    await this.setWidgetsPositions(dashboardSlug, positions);
  }

  async setWidgetsPositions(dashboardSlug, positions) {
    const { accountId } = this.props.match.params;
    const response = await fetchAuth(
      `${ROOT_URL}/accounts/${accountId}/dashboards/${dashboardSlug}/widgets_positions`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'PUT',
        body: JSON.stringify(positions),
      },
    );
    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`Error creating widgets: ${errorMsg}`);
    }
  }

  handleSubmit = async (formValues, { setSubmitting }) => {
    try {
      const { accountId } = this.props.match.params;
      const { name = '', template = '' } = formValues;
      const params = {
        name: name,
      };
      const response = await fetchAuth(`${ROOT_URL}/accounts/${accountId}/dashboards`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const errorMsg = await response.text();
        this.setState({
          errorMsg: errorMsg,
        });
        return;
      }

      const json = await response.json();
      const dashboardSlug = json.slug;

      if (template) {
        await this.createWidgetsFromTemplate(dashboardSlug, DASHBOARD_TEMPLATES[parseInt(template)].widgets);
      }

      this.setState({
        submitted: true,
        newSlug: dashboardSlug,
      });
    } finally {
      setSubmitting(false);
    }
  };

  render() {
    const { submitted, newSlug } = this.state;
    if (submitted) {
      return <Redirect to={`/accounts/${this.props.match.params.accountId}/dashboards/view/${newSlug}`} />;
    }

    return (
      <div className="frame">
        <Formik
          initialValues={{
            name: '',
            template: '',
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
                <label>Name:</label>
                <input
                  type="text"
                  name="name"
                  value={values.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                />
              </div>

              <div className="field">
                <label>Initialize using a template:</label>
                <select value={values.template} name="template" onChange={handleChange} onBlur={handleBlur}>
                  <option value="">-- no template (empty dashboard) --</option>
                  {DASHBOARD_TEMPLATES.map((dt, index) => (
                    <option key={index} value={`${index}`}>{dt.label}</option>
                  ))}
                </select>
              </div>

              <Button type="submit" isLoading={isSubmitting} disabled={!isValid}>
                Submit
              </Button>
            </form>
          )}
        </Formik>
      </div>
    );
  }
}
