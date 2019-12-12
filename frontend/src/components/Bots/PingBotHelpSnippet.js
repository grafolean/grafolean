import React from 'react';
import HelpSnippet from '../HelpSnippets/HelpSnippet';
import { ROOT_URL } from '../../store/actions';
import { backendHostname } from '../../utils/fetch';

export default class PingBotHelpSnippet extends React.Component {
  render() {
    const { bot } = this.props;
    const backendUrlHostname = backendHostname();
    const backendUrlIsLocalhost =
      backendUrlHostname === 'localhost' || backendUrlHostname.match(/^127[.]0[.]0[.][0-9]{1,3}$/);
    const backendUrlHostnameInPre = <span className="pre">{backendUrlHostname}</span>;
    return (
      <HelpSnippet
        title={
          <>
            INSTRUCTIONS: How to send values using <b>"{bot.name}"</b> ICMP Ping bot
          </>
        }
        foldable={true}
        initiallyOpened={false}
      >
        {backendUrlIsLocalhost && (
          <div className="p warning">
            <i className="fa fa-exclamation-triangle" />
            <b>IMPORTANT:</b> the example URLs below are incorrect. Since browser is accessing backend via
            {backendUrlHostnameInPre}, we can't know how ICMP Ping bot will be able to access it. However it
            will <i>not</i> be able use the address {backendUrlHostnameInPre}, even if started on the same
            machine (because ICMP Ping bot runs inside the container). In other words, please change the URLs
            appropriately (replace {backendUrlHostnameInPre} with appropriate domain or IP address), otherwise
            the bot will <b>not be able to connect</b>.
          </div>
        )}

        <div className="p">
          Bot <i>"{bot.name}"</i> is a ICMP Ping bot. It needs to be installed on a server which will have
          access to all the devices it needs to monitor, and it needs to be able to connect to Grafolean via
          HTTP(S) port.
        </div>
        <div className="p">
          The installation instructions are available on{' '}
          <a href="https://github.com/grafolean/grafolean-ping-bot">Grafolean ICMP Ping bot</a> Git
          repository, but in short:
          <ol>
            <li>
              make sure that backend is reachable:
              <pre>
                {String.raw`$ curl ${ROOT_URL}/status/info
{"alive": true, ...`}
              </pre>
            </li>

            <li>
              install ICMP Ping bot:
              <pre>
                {String.raw`$ mkdir ~/pingbot
$ cd ~/pingbot
$ curl https://github.com/grafolean/grafolean-ping-bot/raw/master/docker-compose.yml -o docker-compose.yml
$ echo "BACKEND_URL=${ROOT_URL}" > .env
$ echo "BOT_TOKEN=${bot.token}" >> .env
$ docker-compose up -d
`}
              </pre>
            </li>
          </ol>
        </div>
        <div className="p">
          If installation was successful, you should see the updated "Last successful login" time for this bot
          in a few minutes. Congratulations, now you can configure Entities (devices), their Credentials and
          Sensors.
        </div>
        <div className="p">
          If not, the best place to start is the logs:{' '}
          <span className="pre">docker logs -f grafolean-ping-bot</span>.
        </div>
      </HelpSnippet>
    );
  }
}
