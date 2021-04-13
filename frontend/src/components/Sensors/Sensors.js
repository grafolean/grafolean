import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchAuth } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { ROOT_URL } from '../../store/actions';

import LinkButton from '../LinkButton/LinkButton';
import Loading from '../Loading';
import Button from '../Button';

function Sensors(props) {
  const [sensors, setSensors] = useState(null);
  const [fetchError, setFetchError] = useState(false);

  const accountId = props.match.params.accountId;

  const onSensorsUpdate = responseData => {
    setSensors(responseData.list);
    setFetchError(false);
  };

  const onSensorsUpdateError = errMsg => {
    setSensors(null);
    setFetchError(true);
  };

  const performDelete = (ev, sensorId) => {
    ev.preventDefault();

    const sensor = sensors.find(sensor => sensor.id === sensorId);
    if (!window.confirm(`Are you sure you want to delete sensor "${sensor.name}" ? This can't be undone!`)) {
      return;
    }

    fetchAuth(`${ROOT_URL}/accounts/${accountId}/sensors/${sensorId}`, {
      method: 'DELETE',
    });
  };

  return (
    <div className="sensors frame">
      <PersistentFetcher
        resource={`accounts/${accountId}/sensors`}
        onUpdate={onSensorsUpdate}
        onError={onSensorsUpdateError}
      />

      {fetchError ? (
        <>
          <i className="fa fa-exclamation-triangle" /> Error fetching sensors
        </>
      ) : sensors === null ? (
        <Loading />
      ) : (
        <>
          {sensors.length > 0 && (
            <table className="list">
              <tbody>
                <tr>
                  <th>Protocol</th>
                  <th>Name</th>
                  <th>Details</th>
                  <th />
                  <th />
                </tr>
                {sensors.map(sensor => (
                  <tr key={sensor.id}>
                    <td>{sensor.protocol}</td>
                    <td>{sensor.name}</td>
                    <td>/</td>
                    <td>
                      <LinkButton title="Edit" to={`/accounts/${accountId}/sensors/edit/${sensor.id}`}>
                        <i className="fa fa-pencil" /> Edit
                      </LinkButton>
                    </td>
                    <td>
                      <Button className="red" onClick={ev => performDelete(ev, sensor.id)}>
                        <i className="fa fa-trash" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Link className="button green" to={`/accounts/${accountId}/sensors/new`}>
            <i className="fa fa-plus" /> Add sensor
          </Link>
        </>
      )}
    </div>
  );
}

export default Sensors;
