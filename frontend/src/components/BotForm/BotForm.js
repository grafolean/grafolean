import React from 'react';
import BotFormRender from './BotFormRender';
import { fetchAuth } from '../../utils/fetch';
import { handleFetchErrors, ROOT_URL } from '../../store/actions';

import './BotForm.scss';

/*
  This form is used for:
  - creating and editing a bot
  - for account bots and systemwide bots
  Consequently, there is a bit more if-s in the code, but also less code duplication.
*/

class BotForm extends React.Component {
  fixValuesBeforeSubmit = formValues => {
    return {
      name: formValues.name,
      protocol: formValues.protocol,
    };
  };

  requestPermission = async (accountId, botId, resourcePrefix, methods) => {
    const permissionsUrl = accountId
      ? `${ROOT_URL}/accounts/${accountId}/bots/${botId}/permissions`
      : `${ROOT_URL}/bots/${botId}/permissions`;
    const responsePermissions = await fetchAuth(permissionsUrl, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({
        resource_prefix: resourcePrefix,
        methods: methods,
      }),
    });
    handleFetchErrors(responsePermissions);
  };

  afterSubmit = async response => {
    // if we have created a new bot, we should assign it appropriate permissions too:
    const { accountId, botId } = this.props.match.params;

    const editing = Boolean(botId);
    if (!editing && accountId) {
      // only if we are creating an account bot, do we assign permissions
      const responseJson = await response.json();
      const newId = responseJson.id;
      // assign permissions to bot:
      await this.requestPermission(accountId, newId, `accounts/${accountId}/values`, ['POST', 'PUT']);
      await this.requestPermission(accountId, newId, `accounts/${accountId}/entities`, ['GET']);
      await this.requestPermission(accountId, newId, `accounts/${accountId}/credentials`, ['GET']);
      await this.requestPermission(accountId, newId, `accounts/${accountId}/sensors`, ['GET']);
    }

    const redirectTo = accountId ? `/accounts/${accountId}/bots` : '/bots';
    return redirectTo;
  };

  render() {
    const { accountId, botId } = this.props.match.params;
    const editing = Boolean(botId);
    const resource = accountId
      ? editing
        ? `accounts/${accountId}/bots/${botId}`
        : `accounts/${accountId}/bots`
      : editing
      ? `bots/${botId}`
      : `bots`;
    return (
      <BotFormRender
        initialFormValues={{}}
        editing={editing}
        resource={resource}
        afterSubmit={this.afterSubmit}
        fixValuesBeforeSubmit={this.fixValuesBeforeSubmit}
      />
    );
  }
}
export default BotForm;
