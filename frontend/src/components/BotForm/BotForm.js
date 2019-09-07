import React from 'react';
import BotFormRender from './BotFormRender';
import { fetchAuth } from '../../utils/fetch';
import { handleFetchErrors, ROOT_URL } from '../../store/actions';

class BotForm extends React.Component {
  requestPermission = async (accountId, botId, resourcePrefix, methods) => {
    const responsePermissions = await fetchAuth(
      `${ROOT_URL}/accounts/${accountId}/bots/${botId}/permissions`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          resource_prefix: resourcePrefix,
          methods: methods,
        }),
      },
    );
    await handleFetchErrors(responsePermissions);
  };

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
    await this.requestPermission(accountId, newId, `accounts/${accountId}/values`, ['POST', 'PUT']);
    await this.requestPermission(accountId, newId, `accounts/${accountId}/entities`, ['GET']);
    await this.requestPermission(accountId, newId, `accounts/${accountId}/credentials`, ['GET']);
    await this.requestPermission(accountId, newId, `accounts/${accountId}/sensors`, ['GET']);
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
