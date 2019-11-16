import React from 'react';
import { Link } from 'react-router-dom';

import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';
import Loading from '../Loading';
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
                Bot: {bot.name}, protocol: {protocol ? protocol.label : 'custom'}
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
export default Bot;
