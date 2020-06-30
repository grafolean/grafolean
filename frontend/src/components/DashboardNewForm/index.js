import React from 'react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';

import { ROOT_URL } from '../../store/actions';

import { fetchAuth } from '../../utils/fetch';

import '../form.scss';
import Button from '../Button';
import { Formik } from 'formik';

const DASHBOARD_TEMPLATES = [
  {
    label: 'NetFlow',
    widgets: [{ type: 'netflownavigation', content: '{}', p: 'header', title: 'Navigation' }],
  },
];

class DashboardNewForm extends React.Component {
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

  handleSubmit = async (formValues, { setSubmitting }) => {
    try {
      const { name = '', template = '' } = formValues;
      const params = {
        name: name,
      };
      const response = await fetchAuth(
        `${ROOT_URL}/accounts/${this.props.match.params.accountId}/dashboards`,
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
        this.setState({
          errorMsg: errorMsg,
        });
        return;
      }

      const json = await response.json();
      const dashboardSlug = json.slug;

      await this.createWidgetsFromTemplate(dashboardSlug, DASHBOARD_TEMPLATES[parseInt(template)].widgets);

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
                    <option value={`${index}`}>{dt.label}</option>
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

const mapAccountsListToProps = store => ({
  accounts: store.accounts,
});
export default connect(mapAccountsListToProps)(DashboardNewForm);
