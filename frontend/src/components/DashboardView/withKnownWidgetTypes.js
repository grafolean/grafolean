import React from 'react';
import { withRouter } from 'react-router-dom';

import { ROOT_URL } from '../../store/actions';
import isWidget from '../Widgets/isWidget';
import { INITIAL_KNOWN_WIDGET_TYPES } from '../Widgets/knownWidgets';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
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
          widgetComponent: withRouter(isWidget(RemoteWidgetComponent)),
          widgetAdditionalProps: {
            url: `${ROOT_URL}/plugins/widgets/${wp.id}/widget.js`,
          },
          formComponent: withRouter(RemoteWidgetComponent),
          formAdditionalProps: {
            url: `${ROOT_URL}/plugins/widgets/${wp.id}/form.js`,
          },
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
