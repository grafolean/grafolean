import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import moment from 'moment';

import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';
import { havePermission, fetchAuth } from '../../utils/fetch';
import { handleFetchErrors, ROOT_URL } from '../../store/actions';
import Loading from '../Loading';
import When from '../When';
import EditableLabel from '../EditableLabel';
import HelpSnippet from '../HelpSnippets/HelpSnippet';
import SNMPBotHelpSnippet from '../Bots/SNMPBotHelpSnippet';

import './Bot.scss';

class Bot extends React.Component {
  state = {
    bot: null,
    protocol: null,
    entitiesCount: null,
    entitiesWithCorrectProtocolCount: null,
    sensorsCount: null,
    credentials: null,
  };

  onBotUpdate = json => {
    const protocol = SUPPORTED_PROTOCOLS.find(p => p.slug === json.protocol);
    this.setState({
      bot: json,
      protocol: protocol,
    });
  };

  onEntitiesUpdate = json => {
    const { bot } = this.state;
    const entitiesWithCorrectProtocol = json.list.filter(e => !!e.protocols[bot.protocol]);
    let sensorsCount = 0;
    entitiesWithCorrectProtocol.forEach(e => {
      sensorsCount += e.protocols[bot.protocol].sensors.length;
    });
    this.setState({
      entitiesCount: json.list.length,
      entitiesWithCorrectProtocolCount: entitiesWithCorrectProtocol.length,
      sensorsCount: sensorsCount,
    });
  };

  onCredentialsUpdate = json => {
    const { bot } = this.state;
    this.setState({
      credentialsWithCorrectProtocolCount: json.list.map(c => c.protocol === bot.protocol).length,
    });
  };

  setBotName = async name => {
    const { accountId, botId } = this.props.match.params;
    const { bot } = this.state;
    const params = {
      name: name,
      protocol: bot.protocol,
    };
    fetchAuth(`${ROOT_URL}/accounts/${accountId}/bots/${botId}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'PUT',
      body: JSON.stringify(params),
    }).then(handleFetchErrors);
  };

  render() {
    const { accountId, botId } = this.props.match.params;
    const {
      bot,
      protocol,
      entitiesCount,
      entitiesWithCorrectProtocolCount,
      sensorsCount,
      credentialsWithCorrectProtocolCount,
    } = this.state;
    const { user } = this.props;
    const canEditBotName = havePermission(`accounts/${accountId}/bots/${botId}`, 'PUT', user.permissions);
    return (
      <>
        <PersistentFetcher resource={`accounts/${accountId}/bots/${botId}`} onUpdate={this.onBotUpdate} />

        {bot === null ? (
          <Loading overlayParent={true} />
        ) : (
          <>
            <PersistentFetcher resource={`accounts/${accountId}/entities`} onUpdate={this.onEntitiesUpdate} />
            <PersistentFetcher
              resource={`accounts/${accountId}/credentials`}
              onUpdate={this.onCredentialsUpdate}
            />
            <div className="frame">
              <span>
                Bot: <EditableLabel label={bot.name} onChange={this.setBotName} isEditable={canEditBotName} />
              </span>
            </div>

            {protocol && (
              <>
                {bot.last_login === null ? (
                  <HelpSnippet title="The bot is not installed yet" className="first-steps">
                    <p>Bot has never (successfully) connected to Grafolean yet.</p>
                    <hr />
                    <SNMPBotHelpSnippet bot={bot} />
                  </HelpSnippet>
                ) : entitiesCount === 0 ? (
                  <HelpSnippet title="There are no entities (devices) yet" className="first-steps">
                    <p>
                      <b>Entities</b> are the things you wish to monitor (for example devices, webpages,
                      apps,...).
                    </p>
                    <Link className="button green" to={`/accounts/${accountId}/entities/new`}>
                      <i className="fa fa-plus" /> Add an entity
                    </Link>
                  </HelpSnippet>
                ) : credentialsWithCorrectProtocolCount === 0 ? (
                  <HelpSnippet
                    title={`There are no credentials (protocol configurations) for ${protocol.label} yet`}
                    className="first-steps"
                  >
                    <p>
                      Protocol settings (<b>credentials</b>) must be entered.
                    </p>
                    <Link className="button green" to={`/accounts/${accountId}/credentials/new`}>
                      <i className="fa fa-plus" /> Add a credential
                    </Link>
                  </HelpSnippet>
                ) : entitiesWithCorrectProtocolCount === 0 ? (
                  <HelpSnippet
                    title={`None of the entities (devices) have ${protocol.label} credentials enabled yet`}
                    className="first-steps"
                  >
                    <p>
                      To monitor entities, credentials (protocol settings) must be set for entities. Open{' '}
                      <Link to={`/accounts/${accountId}/entities`}>entities</Link> page, select an entity and
                      fix its settings.
                    </p>
                  </HelpSnippet>
                ) : sensorsCount === 0 ? (
                  <HelpSnippet
                    title={`Last step: enable sensors for ${protocol.label} on entities`}
                    className="first-steps"
                  >
                    <p>
                      <b>Sensors</b> describe which data should be collected from each of the entities. Open{' '}
                      <Link to={`/accounts/${accountId}/entities`}>entities</Link> page, select an entity and
                      select sensors via "Settings" button.
                    </p>
                  </HelpSnippet>
                ) : null}

                {entitiesCount !== null && (
                  <div className="frame">
                    Protocol: {protocol.label}
                    <br />
                    Last succesful login to this account:{' '}
                    {bot.last_login === null ? (
                      'Never'
                    ) : (
                      <>
                        {moment.utc(bot.last_login * 1000).format('YYYY-MM-DD HH:mm:ss')} UTC (
                        <When t={bot.last_login} />)
                      </>
                    )}
                    <br />
                    <br />
                    Entities: {entitiesCount}
                    <br />
                    Credentials for {protocol.label}: {credentialsWithCorrectProtocolCount}
                    <br />
                    Entities that have credentials for {protocol.label} enabled:{' '}
                    {entitiesWithCorrectProtocolCount}
                    <br />
                    Total number of sensors enabled on these entities: {sensorsCount}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </>
    );
  }
}
const mapStoreToProps = store => ({
  user: store.user,
});
export default connect(mapStoreToProps)(Bot);
