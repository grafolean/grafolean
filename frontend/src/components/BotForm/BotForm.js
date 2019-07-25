import React from 'react';
import BotFormRender from './BotFormRender';
import { fetchAuth } from '../../utils/fetch';
import { handleFetchErrors, ROOT_URL } from '../../store/actions';

class BotForm extends React.Component {
  afterSubmit = async response => {
    // if we have created a new bot, we should assign it appropriate permissions too:
    const { accountId, botId } = this.props.match.params;
    const editing = Boolean(botId);
    if (editing) {
      const redirectTo = `/accounts/${accountId}/bots?infoAbout=${botId}`;
      return redirectTo;
    }

    const responseJson = await response.json();
    const newId = responseJson.id;
    // assign permissions to bot:
    const responsePermissions = await fetchAuth(
      `${ROOT_URL}/accounts/${accountId}/bots/${newId}/permissions`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          resource_prefix: `accounts/${accountId}/values`,
          methods: ['POST', 'PUT'],
        }),
      },
    );
    await handleFetchErrors(responsePermissions);
    const redirectTo = `/accounts/${accountId}/bots?infoAbout=${newId}`;
    return redirectTo;
  };

  render() {
    const { accountId, botId } = this.props.match.params;
    const editing = Boolean(botId);
    const resource = editing ? `accounts/${accountId}/bots/${botId}` : `accounts/${accountId}/bots`;
    return (
      <BotFormRender
        initialFormValues={{}}
        editing={editing}
        resource={resource}
        afterSubmit={this.afterSubmit}
      />
    );
  }
}
export default BotForm;
