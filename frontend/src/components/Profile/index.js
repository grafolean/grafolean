import React from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';

import store from '../../store';
import { doLogout } from '../../store/helpers';

import Button from '../Button';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import Loading from '../Loading';
import EditableLabel from '../EditableLabel';
import { fetchAuth, havePermission } from '../../utils/fetch';
import { handleFetchErrors, onFailure, ROOT_URL } from '../../store/actions';
import LinkButton from '../LinkButton/LinkButton';

class Profile extends React.Component {
  state = {
    person: null,
    selectedTimezone: null,
    loadingKeys: [],
  };

  handlePersonUpdate = json => {
    this.setState({
      person: json,
      selectedTimezone: json.timezone || 'UTC',
    });
  };

  changeName = newValue => {
    this.updatePerson({ name: newValue });
  };
  changeUsername = newValue => {
    this.updatePerson({ username: newValue });
  };
  changeEmail = newValue => {
    this.updatePerson({ email: newValue });
  };
  handleTimezoneSelectChange = ev => {
    this.setState({ selectedTimezone: ev.target.value });
  };
  saveTimezone = () => {
    this.updatePerson({ timezone: this.state.selectedTimezone });
  };

  updatePerson = async changes => {
    const { person } = this.state;
    const { user } = this.props;
    const personData = {
      name: person.name,
      username: person.username,
      email: person.email,
      timezone: person.timezone,
      ...changes,
    };
    this.setState({ loadingKeys: Object.keys(changes) });
    try {
      const response = await fetchAuth(`${ROOT_URL}/persons/${user.user_id}`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'PUT',
        body: JSON.stringify(personData),
      });
      handleFetchErrors(response);
    } catch (errorMsg) {
      console.error(errorMsg);
      store.dispatch(onFailure(errorMsg.toString()));
    }
    this.setState({ loadingKeys: [] });
  };

  render() {
    const { person, selectedTimezone, loadingKeys } = this.state;
    const { user } = this.props;
    const canChangePassword = havePermission(`persons/${user.user_id}/password`, 'POST', user.permissions);
    const canChangePerson = havePermission(`persons/${user.user_id}`, 'PUT', user.permissions);
    return (
      <div>
        <PersistentFetcher resource={`persons/${user.user_id}`} onUpdate={this.handlePersonUpdate} />
        {person === null ? (
          <Loading />
        ) : (
          <>
            <p>User ID: {person.user_id}</p>
            <p>
              Name:{' '}
              {loadingKeys.includes('name') ? (
                <Loading />
              ) : (
                <EditableLabel label={person.name} onChange={this.changeName} isEditable={canChangePerson} />
              )}
            </p>
            <p>
              Username:{' '}
              {loadingKeys.includes('username') ? (
                <Loading />
              ) : (
                <EditableLabel
                  label={person.username}
                  onChange={this.changeUsername}
                  isEditable={canChangePerson}
                />
              )}
            </p>
            <p>
              E-mail:{' '}
              {loadingKeys.includes('email') ? (
                <Loading />
              ) : (
                <EditableLabel
                  label={person.email}
                  onChange={this.changeEmail}
                  isEditable={canChangePerson}
                />
              )}
            </p>
            <hr />
            <LinkButton to="/profile/change-password" disabled={!canChangePassword}>
              <i className="fa fa-fw fa-key" /> Change password
            </LinkButton>
            <hr />
            <p>Timezone:</p>
            <select
              onChange={this.handleTimezoneSelectChange}
              value={selectedTimezone}
              disabled={!canChangePerson}
            >
              {moment.tz.names().map(tzName => (
                <option value={tzName}>{tzName}</option>
              ))}
            </select>
            {loadingKeys.includes('timezone') ? (
              <Loading />
            ) : (
              <Button onClick={this.saveTimezone} disabled={person.timezone === selectedTimezone}>
                Save
              </Button>
            )}
            <hr />
            <Button onClick={doLogout}>
              <i className="fa fa-fw fa-power-off" /> Logout
            </Button>
          </>
        )}
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  user: store.user,
});
export default connect(mapStoreToProps)(Profile);
