import React from 'react';
import { connect } from 'react-redux';

import { doLogout } from '../../store/helpers';

import { MQTTFetcherSingleton } from './MQTTFetcherSingleton';

const withMqttConnected = WrappedComponent => {
  const wrappedComponent = class Form extends React.Component {
    state = {
      mqttIsConnected: false,
    };

    componentDidMount() {
      this.ensureSubscribed();
    }

    componentDidUpdate(prevProps) {
      // backendStatus or jwtToken might not be available when this component mounts, so we listen
      // for change (when they become available) and subscribe then:
      if (
        (!prevProps.backendStatus && !!this.props.backendStatus) ||
        (!prevProps.jwtToken && !!this.props.jwtToken)
      ) {
        this.ensureSubscribed();
      }
    }

    ensureSubscribed = () => {
      // make sure all the data you need to connect is here, otherwise return and we will try again later:
      if (!this.props.backendStatus || !this.props.jwtToken) {
        return;
      }
      // while connecting, multiple instances of this HOC may be trying to supply config - only one should do it:
      if (!MQTTFetcherSingleton.hasSettings()) {
        const { backendStatus, jwtToken } = this.props;
        // by default, mqtt websockets connection is proxied through nginx, so it is available under the same hostname and port as this frontend:
        const mqttWsHostname = backendStatus.mqtt_ws_hostname || window.location.hostname;
        const mqttWsSsl = window.location.protocol === 'https:'; // why not a separate setting? Because we would need numerous other settings too. It is much easier to just proxy mqtt through nginx and not set anything, if one wants wss.
        const mqttWsPort = backendStatus.mqtt_ws_port || window.location.port || (mqttWsSsl ? 443 : 80);
        try {
          MQTTFetcherSingleton.setUp(mqttWsHostname, mqttWsPort, mqttWsSsl, jwtToken);
        } catch (ex) {
          console.error('Could not connect to MQTT', ex);
          doLogout();
          return;
        }
      }

      MQTTFetcherSingleton.ensureMqttConnected()
        .then(() => {
          this.setState({
            mqttIsConnected: true,
          });
        })
        .catch(err => {
          console.error('Could not connect to MQTT', err);
          doLogout();
        });
    };

    render() {
      const { mqttIsConnected } = this.state;
      const { backendStatus, jwtToken, ...rest } = this.props;
      if (!mqttIsConnected) {
        return null;
      }
      return <WrappedComponent {...rest} />;
    }
  };

  const mapStoreToProps = store => ({
    backendStatus: store.backendStatus.status,
    jwtToken: store.user ? store.user.jwtToken : undefined,
  });
  return connect(mapStoreToProps)(wrappedComponent);
};

export default withMqttConnected;
