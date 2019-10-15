import moment from 'moment';
import { stringify } from 'qs';
import debounce from 'lodash/debounce';

import { ROOT_URL, handleFetchErrors } from '../../store/actions';

import { VERSION_INFO } from '../../VERSION';
import { fetchAuth } from '.';

class MQTTFetcher {
  _mqttSettings = null;
  listeners = {};
  _nextListenerId = 1;
  _connectingToMqttPromise = null;
  _mqttClient = null;
  _subscribedToTopics = new Set();

  setUp = (mqttWsHostname, mqttWsPort, mqttWsSsl, jwtToken) => {
    this._mqttSettings = {
      wsHostname: mqttWsHostname,
      wsPort: mqttWsPort,
      wsIsSsl: mqttWsSsl,
      jwtToken: jwtToken,
    };
  };

  hasSettings = () => {
    return this._mqttSettings !== null;
  };

  isConnected = () => {
    return this._mqttClient !== null;
  };

  // whenever JWT token changes, it needs to be updated, so that we have the correct data in case we need to reconnect:
  updateJWTToken = newJwtToken => {
    this._mqttSettings.jwtToken = newJwtToken;
  };

  addListener = async (
    topic,
    queryParams,
    onFetchCallback,
    onErrorCallback,
    onNotification,
    mqttTopicOverride = null,
  ) => {
    const listenerId = '' + this._nextListenerId;
    this._nextListenerId += 1;
    const listener = {
      listenerId: listenerId,
      topic: topic,
      queryParams: queryParams,
      onFetchCallback: onFetchCallback,
      onErrorCallback: onErrorCallback, // (errMsg, isTerminalError) => {}
      onNotification: onNotification,
      mqttTopicOverride: mqttTopicOverride,
      abortController: null,
      // When we want do debounce HTTP calls (for example if we receive many MQTT messages because many values
      // got updated, but they all affect the same listener - like for charts' autoupdating), we can't just use
      // debounce directly, because multiple listeners might want to trigger the fetching at approximately the
      // same time, and debounce would only trigger one of them. The solution is to have a debouncedFetch function
      // for each listener:
      debouncedDoFetchHttp: debounce(() => this._doFetchHttp(listenerId), 1000),
    };

    // make sure we are connected to MQTT, that we can subscribe, and that we got the initial value:
    try {
      this.listeners[listenerId] = listener;
      this._mqttSubscribeToTopic(listenerId);
      this._doFetchHttp(listenerId); // start the network request - it might fail, but we don't care here (listener will be notified via callbacks)
      return listenerId;
    } catch (err) {
      console.error(`Listening to topic [${topic}] failed: ${err}`);
      this.removeListener(listenerId);
      return null;
    }
  };

  removeListener = listenerId => {
    if (!this.listeners[listenerId]) {
      console.debug(`Not removing listener, not there at all: ${listenerId}.`);
      return;
    }
    const { topic, mqttTopicOverride } = this.listeners[listenerId];
    const mqttTopic = mqttTopicOverride !== null ? mqttTopicOverride : topic;

    // unsubscribe from mqtt:
    if (Object.values(this.listeners).find(f => f.topic === mqttTopic || f.mqttTopicOverride === mqttTopic)) {
      // some other listener is still using this topic, let it be:
      console.debug('Not unsubscribing, some other listener is still subscribed to the topic: ' + mqttTopic);
    } else {
      console.debug('Unsubscribing from topic: ' + topic);
      this._mqttClient.unsubscribe(topic);
    }

    // abort any ongoing fetches:
    if (this.listeners[listenerId].abortController) {
      this.listeners[listenerId].abortController.abort();
    }
    delete this.listeners[listenerId];
  };

  ensureMqttConnected = () => {
    // there might be multiple requests to connection in parallel (before the first one succeeds), so we
    // must make sure that only one MQTT connection is requested. We do this by caching the promise:
    if (this._connectingToMqttPromise === null) {
      const { wsHostname, wsPort, wsIsSsl, jwtToken } = this._mqttSettings;
      this._connectingToMqttPromise = new Promise((resolve, reject) => {
        let notYetConnectedClient = new window.Paho.MQTT.Client(
          wsHostname,
          Number(wsPort),
          `grafolean-frontend-${VERSION_INFO.ciCommitTag || 'v?.?.?'}-${moment().format('x')}`,
        );
        notYetConnectedClient.onConnectionLost = responseObject => {
          if (responseObject.errorCode !== 0) {
            console.error('MQTT connection lost!');
            //this.ensureMqttConnected(); // !!! handling, retries?
          }
        };
        notYetConnectedClient.onMessageArrived = this._onMessageReceived;
        notYetConnectedClient.connect({
          onSuccess: () => {
            console.log('MQTT connected.');
            this._mqttClient = notYetConnectedClient;
            resolve();
          },
          onFailure: () => {
            console.error('Error connecting to MQTT broker via WebSockets');
            reject();
          },
          timeout: 5,
          reconnect: true, // not sure how to control reconnect? especially since reconnects need an updated jwt token?
          keepAliveInterval: 36000000,
          userName: jwtToken,
          password: 'can.be.empty',
          useSSL: wsIsSsl,
        });
      });
    }
    return this._connectingToMqttPromise;
  };

  _doFetchHttp = listenerId => {
    if (!this.listeners[listenerId]) {
      // we are sometimes called via debounce, so by the time this is executed, the listener
      // might have been removed already. Let's just not do anything then.
      return;
    }

    const paramsString = this.listeners[listenerId].queryParams
      ? `?${stringify(this.listeners[listenerId].queryParams)}`
      : '';
    const url = `${ROOT_URL}/${this.listeners[listenerId].topic}${paramsString}`;
    this.listeners[listenerId].abortController = new window.AbortController();
    fetchAuth(url, { signal: this.listeners[listenerId].abortController.signal })
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => {
        if (!this.listeners[listenerId]) {
          return; // not subscribed anymore? silently ignore response.
        }
        try {
          this.listeners[listenerId].onFetchCallback(json, this.listeners[listenerId]);
        } catch (err) {
          console.error(err);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err);
          try {
            this.listeners[listenerId].onErrorCallback(err, false);
          } catch (callbackErr) {
            console.error(callbackErr);
          }
        }
      });
  };

  _mqttSubscribeToTopic = listenerId => {
    if (!this.listeners[listenerId]) {
      return;
    }
    const { topic, mqttTopicOverride } = this.listeners[listenerId];
    const mqttTopic = mqttTopicOverride !== null ? mqttTopicOverride : topic;
    if (
      Object.values(this.listeners).find(
        f => f.listenerId !== listenerId && (f.topic === mqttTopic || f.mqttTopicOverride === mqttTopic),
      )
    ) {
      // some other listener is already subscribed to this topic, let it be:
      console.debug(
        'Some existing listener is already subscribed to (or is in the process of subscribing to) the topic, no need to subscribe again: ' +
          mqttTopic,
      );
      return;
    }
    console.debug('MQTT subscribing to: ' + mqttTopic);
    this._mqttClient.subscribe(`changed/${mqttTopic}`, {
      onSuccess: () => console.debug('Successfully subscribed to topic: ' + mqttTopic),
      onFailure: onFailureErr => {
        console.error(
          `Error subscribing to topic: ${mqttTopic}; ${onFailureErr.errorCode} ${onFailureErr.errorMessage}`,
          onFailureErr,
        );
        // if this happens, we should nuke every listener that listens to this topic:
        Object.values(this.listeners)
          .filter(f => f.topic === mqttTopic || f.mqttTopicOverride === mqttTopic)
          .forEach(listener => {
            listener.onErrorCallback('Error subscribing to topic: ' + mqttTopic, true);
            this.removeListener(listener.listenerId);
          });
      },
    });
  };

  _onMessageReceived = message => {
    // Note that unsubscribe is async so it might happen that some messages come *after* the unsubscribe:
    //   https://www.eclipse.org/paho/files/jsdoc/Paho.MQTT.Client.html
    // Since we can't rush the unsubscribing process, we simply ignore such messages (they match no known topic).
    console.debug('Message received:', message.destinationName, message.topic, message.payloadString);
    if (!message.destinationName.startsWith('changed/')) {
      console.error('Message doesn\'t start with "changed/", how did we get it?');
      return;
    }
    const changedTopic = message.destinationName.substring('changed/'.length);
    Object.keys(this.listeners).forEach(listenerId => {
      const listener = this.listeners[listenerId];

      // check if the topic matches what the listener wants:
      if (listener.mqttTopicOverride !== null) {
        const topicRegex = listener.mqttTopicOverride.replace('+', '[^/]+').replace(/[/]#$/, '/.*');
        if (!changedTopic.match(topicRegex)) {
          return;
        }
      } else {
        if (listener.topic !== changedTopic) {
          return;
        }
      }

      try {
        // We know that the resource has changed, but we still need to re-issue REST request - MQTT
        // mostly just notifies us of the change.
        if (listener.onNotification) {
          // But - for those topics that need parameters, MQTT gives us additional data that lets
          // us decide if we wish to fetch new data or not (for example, when observing values, we
          // could decide based on timestamp if we wish to refetch data or not).
          const shouldContinueWithFetch = listener.onNotification(
            JSON.parse(message.payloadString),
            changedTopic,
          );
          if (!shouldContinueWithFetch) {
            return;
          }
        }
        // some other notification might trigger the same fetch, so we debounce it to avoid multiple
        // identical calls in quick succession:
        this.listeners[listenerId].debouncedDoFetchHttp();
      } catch (e) {
        console.error('Error handling MQTT message', e);
      }
    });
  };

  disconnect = () => {
    Object.keys(this.listeners).forEach(listenerId => this.removeListener(listenerId));
    if (this._mqttClient) {
      this._mqttClient.disconnect();
      this._mqttClient = null;
    }
    this.listeners = {};
    this._nextListenerId = 1;
    this._connectingToMqttPromise = null;
  };
}

export const MQTTFetcherSingleton = new MQTTFetcher();
