import React from 'react';

import { ROOT_URL } from '../../store/actions';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { INITIAL_KNOWN_WIDGET_TYPES } from '../Widgets/knownWidgets';
import RemoteWidgetComponent from '../Widgets/RemoteWidgetComponent';

/*
  Fetches widget plugins list from the backend and attaches them to INITIAL_KNOWN_WIDGET_TYPES, passing them to the wrapped component.
*/
const withKnownWidgetTypes = WrappedComponent => {
  const wrappedComponent = class Form extends React.Component {
    state = {
      widgetPlugins: [],
    };

    onWidgetPluginsUpdate = json => {
      this.setState({ widgetPlugins: json.list });
    };

    getKnownWidgetTypes() {
      const { widgetPlugins } = this.state;
      let widgetTypesFromPlugins = {};
      widgetPlugins.forEach(wp => {
        widgetTypesFromPlugins[wp.repo_url] = {
          type: wp.repo_url,
          icon: wp.icon,
          label: wp.label,
          widgetComponent: RemoteWidgetComponent,
          widgetAdditionalProps: {
            url: `${ROOT_URL}/plugins/widgets/${wp.id}/widget.js`,
          },
          formComponent: null,
          isHeaderWidget: wp.is_header_widget,
        };
      });
      return {
        ...INITIAL_KNOWN_WIDGET_TYPES,
        ...widgetTypesFromPlugins,
      };
    }

    render() {
      const knownWidgetTypes = this.getKnownWidgetTypes();
      return (
        <>
          <PersistentFetcher resource="plugins/widgets" onUpdate={this.onWidgetPluginsUpdate} />
          <WrappedComponent knownWidgetTypes={knownWidgetTypes} {...this.props} />
        </>
      );
    }
  };
  return wrappedComponent;
};

export default withKnownWidgetTypes;
