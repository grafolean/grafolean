import React from 'react';

export default class WelcomePage extends React.PureComponent {
  render() {
    return (
      <div>
        <h3>Welcome!</h3>
        <p>
          This page displays information about the latest values received and provides guidance on how to post
          these values.
        </p>
        <WebSocketsTest hostname="localhost" port={9883} />
      </div>
    );
  }
}

class WebSocketsTest extends React.PureComponent {
  mqttClient = undefined;

  componentDidMount() {
    this.mqttClient = new window.Paho.MQTT.Client(this.props.hostname, Number(this.props.port), 'clientId');
    this.mqttClient.onConnectionLost = this.onConnectionLost;
    this.mqttClient.onMessageArrived = this.onMessageArrived;
    this.mqttClient.connect({ onSuccess: this.onConnect });
  }

  // called when the client connects
  onConnect = () => {
    // Once a connection has been made, make a subscription and send a message.
    console.log('onConnect');
    this.mqttClient.subscribe('test');
    const message = new window.Paho.MQTT.Message('Hello');
    message.destinationName = 'test';
    this.mqttClient.send(message);
  };

  // called when the client loses its connection
  onConnectionLost = responseObject => {
    if (responseObject.errorCode !== 0) {
      console.log('onConnectionLost:' + responseObject.errorMessage);
    }
  };

  // called when a message arrives
  onMessageArrived = message => {
    console.log('onMessageArrived:' + message.payloadString);
  };

  componentWillUnmount() {
    if (this.ws) {
      this.ws.close();
    }
  }

  onSocketOpen = () => {
    console.log('Socket opened');
    this.ws.send('test123');
    console.log('Message is sent...');
  };

  onSocketMessage = evt => {
    var received_msg = evt.data;
    console.log('Message received:', received_msg);
  };

  onSocketClose = () => {
    console.log('Connection is closed...');
  };

  render() {
    return <div>See console for messages.</div>;
  }
}
