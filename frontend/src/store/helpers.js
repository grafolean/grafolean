import { MQTTFetcherSingleton } from '../utils/fetch/MQTTFetcherSingleton';
import store from '.';
import { clearNotifications, onLogout } from './actions';

export function doLogout() {
  window.sessionStorage.removeItem('grafolean_jwt_token');
  MQTTFetcherSingleton.disconnect();
  store.dispatch(clearNotifications());
  store.dispatch(onLogout());
}
