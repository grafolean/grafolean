import React from 'react';
import HelpSnippet from '../HelpSnippets/HelpSnippet';

export default class SNMPBotHelpSnippet extends React.Component {
  renderInstall() {
    const { bot } = this.props;
    const backendUrlHostname = new URL(process.env.REACT_APP_BACKEND_ROOT_URL).hostname;
    const backendUrlIsLocalhost =
      backendUrlHostname === 'localhost' || backendUrlHostname.match(/^127[.]0[.]0[.][0-9]{1,3}$/);
    const backendUrlHostnameInPre = <span className="pre">{backendUrlHostname}</span>;
    return (
      <HelpSnippet
        title={
          <>
            INSTRUCTIONS: How to send values using <b>"{bot.name}"</b> SNMP bot
          </>
        }
        foldable={true}
        initiallyOpened={false}
      >
        {backendUrlIsLocalhost && (
          <div className="p warning">
            <i className="fa fa-exclamation-triangle" />
            <b>IMPORTANT:</b> the example URLs below are incorrect. Since browser is accessing backend via
            {backendUrlHostnameInPre}, we can't know how SNMP Collector will be able to access it. However it
            will <i>not</i> be able use the address {backendUrlHostnameInPre}, even if started on the same
            machine (because SNMP Collector runs inside the container). In other words, please change the URLs
            appropriately (replace {backendUrlHostnameInPre} with appropriate domain or IP address), otherwise
            the bot will <b>not be able to connect</b>.
          </div>
        )}

        <div className="p">
          Bot <i>"{bot.name}"</i> is a SNMP bot / collector. It needs to be installed on a server which will
          have access to all the devices it needs to monitor, and it needs to be able to connect to Grafolean
          via HTTP(S) port.
        </div>
        <div className="p">
          The installation instructions are available on{' '}
          <a href="https://gitlab.com/grafolean/grafolean-collector-snmp">Grafolean SNMP collector</a> Git
          repository, but in short:
          <ol>
            <li>
              make sure that backend is reachable:
              <pre>
                {String.raw`$ curl ${process.env.REACT_APP_BACKEND_ROOT_URL}/status/info
{"alive": true, ...`}
              </pre>
            </li>

            <li>
              install SNMP collector:
              <pre>
                {String.raw`$ mkdir ~/snmpcollector
$ cd ~/snmpcollector
$ curl https://gitlab.com/grafolean/grafolean-collector-snmp/raw/master/docker-compose.yml -o docker-compose.yml
$ echo "BACKEND_URL=${process.env.REACT_APP_BACKEND_ROOT_URL}" > .env
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
          <span className="pre">docker logs -f grafolean-collector-snmp</span>.
        </div>
      </HelpSnippet>
    );
  }

  render() {
    return <div>{this.renderInstall()}</div>;
  }
}
