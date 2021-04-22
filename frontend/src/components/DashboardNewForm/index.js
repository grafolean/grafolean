import React from 'react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';
import { Formik } from 'formik';

import { ROOT_URL } from '../../store/actions';
import { fetchAuth } from '../../utils/fetch';
import Button from '../Button';
import { FormError } from '../isFormikForm';

import '../form.scss';

import NETFLOW_TEMPLATE from './netflow.template.json';
const DASHBOARD_TEMPLATES = [NETFLOW_TEMPLATE];

class DashboardNewForm extends React.Component {
  state = {
    submitted: false,
    newSlug: null,
    errorMsg: '',
  };

  validate = values => {
    const { name = '', initialize_from = '', template = '', entity = '' } = values;
    if (name.length === 0) {
      return { name: 'Name must not be empty' };
    }
    if (initialize_from === '') {
      return { initialize_from: 'Please select an option' };
    }
    if (initialize_from === 'template' && template === '') {
      return { template: 'Please select a template' };
    }
    if (initialize_from === 'entity' && entity === '') {
      return { template: 'Please select an entity' };
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
        true,
      );
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
    await fetchAuth(
      `${ROOT_URL}/accounts/${accountId}/dashboards/${dashboardSlug}/widgets_positions`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'PUT',
        body: JSON.stringify(positions),
      },
      true,
    );
  }

  constructPathFilterFromSensorOutputPath(outputPath) {
    // "if.in-octets.{$index}.{$1}" -> { pathFilter: "if.in-octets.?.?", renaming: "$1 $2" }
    // "lmsensors.temp.{$index}.{$1}" -> { pathFilter: "lmsensors.temp.?.?", renaming: "$1 $2" }
    // "lmsensors.temp.{$index}" -> { pathFilter: "lmsensors.temp.?", renaming: "$1" }
    let nReplacements = 0;
    const pathFilter = outputPath.replace(/[{][$][^}]+[}]/g, () => {
      nReplacements++;
      return '?';
    });
    const renaming = [...Array(nReplacements).keys()].map(k => `$${k + 1}`).join(' ');
    return {
      pathFilter: pathFilter,
      renaming: renaming,
    };
  }

  async createWidgetsMatchingEntitySensors(dashboardSlug, entityId) {
    /*
      To magically construct the widgets for enabled sensors on the entity, we need to traverse the sensors
      and guess correct chart parameters from its output_path.
    */
    const { accountId } = this.props.match.params;
    const response = await fetchAuth(`${ROOT_URL}/accounts/${accountId}/entities/${entityId}`, {}, true);
    const entity = await response.json();

    const { snmp, ping } = entity.protocols;
    if (snmp) {
      const { sensors } = snmp;
      for (let i = 0; i < sensors.length; i++) {
        const sensorId = sensors[i].sensor;
        const responseSensor = await fetchAuth(
          `${ROOT_URL}/accounts/${accountId}/sensors/${sensorId}`,
          {},
          true,
        );
        const sensor = await responseSensor.json();
        const sensorName = sensor.name;
        const outputPath = sensor.details.output_path;

        const { pathFilter, renaming } = this.constructPathFilterFromSensorOutputPath(outputPath);
        const params = {
          type: 'chart',
          title: sensorName,
          content: JSON.stringify([
            {
              path_filter: `entity.${entityId}.snmp.${pathFilter}`,
              renaming: renaming,
              expression: '$1',
              unit: '',
            },
          ]),
        };
        await fetchAuth(
          `${ROOT_URL}/accounts/${accountId}/dashboards/${dashboardSlug}/widgets`,
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify(params),
          },
          true,
        );
      }
    }

    if (ping && ping.sensors && ping.sensors.length > 0) {
      const params = {
        type: 'chart',
        title: `Ping: ${entity.name}`,
        content: JSON.stringify([
          {
            path_filter: `entity.${entityId}.ping.?.rtt`,
            renaming: 'packet: $1',
            expression: '$1',
            unit: 's',
          },
        ]),
      };
      await fetchAuth(
        `${ROOT_URL}/accounts/${accountId}/dashboards/${dashboardSlug}/widgets`,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify(params),
        },
        true,
      );
    }
  }

  handleSubmit = async (formValues, { setSubmitting }) => {
    try {
      const { accountId } = this.props.match.params;
      const { name = '', initialize_from = '', template = '', entity = '' } = formValues;
      const params = {
        name: name,
      };
      const response = await fetchAuth(
        `${ROOT_URL}/accounts/${accountId}/dashboards`,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify(params),
        },
        true,
      );

      const json = await response.json();
      const dashboardSlug = json.slug;

      if (initialize_from === 'template') {
        await this.createWidgetsFromTemplate(dashboardSlug, DASHBOARD_TEMPLATES[parseInt(template)].widgets);
      } else if (initialize_from === 'entity') {
        await this.createWidgetsMatchingEntitySensors(dashboardSlug, parseInt(entity));
      }

      this.setState({
        submitted: true,
        newSlug: dashboardSlug,
      });
    } catch (ex) {
      this.setState({
        errorMsg: ex.toString(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  render() {
    const { submitted, newSlug, errorMsg } = this.state;
    const { accountEntities } = this.props;
    if (submitted) {
      return <Redirect to={`/accounts/${this.props.match.params.accountId}/dashboards/view/${newSlug}`} />;
    }

    const deviceEntities = accountEntities.filter(e => e.entity_type === 'device');

    return (
      <div className="frame">
        <Formik
          initialValues={{
            name: '',
            initialize_from: '',
            template: '',
            entity: '',
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

              <div className="initialize_from field">
                <div className="radio_option_container">
                  <label>
                    <input
                      type="radio"
                      name="initialize_from"
                      value="empty"
                      checked={values.initialize_from === 'empty'}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                    <span>start with empty dashboard</span>
                  </label>
                </div>

                <div className="radio_option_container">
                  <label>
                    <input
                      type="radio"
                      name="initialize_from"
                      value="template"
                      checked={values.initialize_from === 'template'}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                    <span>initialize using a template</span>
                  </label>
                  {values.initialize_from === 'template' && (
                    <select
                      value={values.template}
                      name="template"
                      onChange={handleChange}
                      onBlur={handleBlur}
                    >
                      <option value="">-- please select --</option>
                      {DASHBOARD_TEMPLATES.map((dt, index) => (
                        <option key={index} value={`${index}`}>
                          {dt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="radio_option_container">
                  <label>
                    <input
                      type="radio"
                      name="initialize_from"
                      value="entity"
                      checked={values.initialize_from === 'entity'}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                    <span>initialize according to device entity</span>
                  </label>
                  {values.initialize_from === 'entity' && (
                    <select value={values.entity} name="entity" onChange={handleChange} onBlur={handleBlur}>
                      <option value="">-- please select --</option>
                      {deviceEntities.map(e => (
                        <option key={e.id} value={`${e.id}`}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {errorMsg && <FormError msg={errorMsg} />}
              <Button type="submit" isLoading={isSubmitting} disabled={!isValid}>
                Submit
              </Button>
              {!isValid && <FormError msg={errors} />}
            </form>
          )}
        </Formik>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  accountEntities: store.accountEntities,
});
export default connect(mapStoreToProps)(DashboardNewForm);
