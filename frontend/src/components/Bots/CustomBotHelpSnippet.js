import React from 'react';
import { withRouter } from 'react-router-dom';

import HelpSnippet from '../HelpSnippets/HelpSnippet';
import { ROOT_URL } from '../../store/actions';
import { backendHostname } from '../../utils/fetch';

class CustomBotHelpSnippet extends React.Component {
  render() {
    const { bot } = this.props;
    const accountId = this.props.match.params.accountId;
    const backendUrlHostname = backendHostname();
    const backendUrlIsLocalhost =
      backendUrlHostname === 'localhost' || backendUrlHostname.match(/^127[.]0[.]0[.][0-9]{1,3}$/);
    const backendUrlHostnameInPre = <span className="pre">{backendUrlHostname}</span>;
    return (
      <HelpSnippet
        title={
          <>
            INSTRUCTIONS: How to send values using <b>"{bot.name}"</b> custom bot
          </>
        }
        foldable={true}
        initiallyOpened={false}
      >
        {backendUrlIsLocalhost && (
          <div className="p warning">
            <i className="fa fa-exclamation-triangle" />
            <b>IMPORTANT:</b> the example URLs below might be incorrect. Since browser is accessing backend
            via {backendUrlHostnameInPre}, we can't know how the bot will be able to access it. In other
            words, please change the URLs appropriately (replace {backendUrlHostnameInPre} with externally
            accessible domain or IP address), otherwise the bot might not be able to connect.
          </div>
        )}

        <div className="p">
          Bot <i>"{bot.name}"</i> is a "custom" bot, which means that it is <strong>not</strong> configured
          via Grafolean UI. Instead, it should simply periodically send data to Grafolean. Usually this is
          done with <a href="https://en.wikipedia.org/wiki/Cron">cron</a> jobs, but you can use any other
          scheduler / platform / script / programming language - we are using regular HTTP(S) API to receive
          values.
        </div>
        <div className="p">
          Sending values using current time uses <i>POST</i> method:
          <pre>
            {String.raw`$ curl \
  -X POST \
  '${ROOT_URL}/accounts/${accountId}/values/?p=myhouse.livingroom.humidity&v=57.3&b=${bot.token}'`}
          </pre>
        </div>
        <div className="p">
          Sending more values at once is also possible:
          <pre>
            {String.raw`$ curl \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '[ { "p": "myhouse.livingroom.humidity", "v": 57.3 }, { "p": "myhouse.livingroom.temperature.kelvin", "v": 293.2 } ]' \
  '${ROOT_URL}/accounts/${accountId}/values/?b=${bot.token}'`}
          </pre>
        </div>
        <div className="p">
          For sending historical data you must use <i>PUT</i> method and specify the time explicitly:
          <pre>
            {String.raw`$ curl \
  -X PUT \
  -H 'Content-Type: application/json' \
  -d '[ { "p": "myhouse.livingroom.humidity", "v": 57.3, "t": 1234567890.012345 }, { "p": "myhouse.livingroom.humidity", "v": 57.2, "t": 1234567899 } ]' \
  '${ROOT_URL}/accounts/${accountId}/values/?b=${bot.token}'`}
          </pre>
        </div>
      </HelpSnippet>
    );
  }
}
export default withRouter(CustomBotHelpSnippet);
