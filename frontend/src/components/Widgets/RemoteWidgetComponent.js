import React from 'react';
//import { resolve } from '../../remote-component.config';

// // regular import throws a warning about a missing remote-component.config.js:
// //   https://github.com/Paciolan/remote-component#you-may-see-some-warnings
// import { createUseRemoteComponent } from '@paciolan/remote-component/dist/hooks/useRemoteComponent';
// import { createRequires } from '@paciolan/remote-component/dist/createRequires';
// // import { createRequires, createUseRemoteComponent } from '@paciolan/remote-component';

// import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';

// const useRemoteComponent = createUseRemoteComponent({ requires: createRequires(resolve) });

// // we need to use a function component because of React hooks:
// const RemoteWidgetComponent = props => {
//   const { url, ...rest } = props;

//   const [loading, err, Component] = useRemoteComponent(url);
//   if (loading) {
//     return <div>Loading component...</div>;
//   }
//   if (err != null) {
//     return <div>Unknown Error: {err.toString()}</div>;
//   }

//   const g = {
//     components: {
//       PersistentFetcher: props => <PersistentFetcher {...props} />,
//     },
//     urlParams: props.match.params,
//   };

//   return <Component g={g} {...rest} />;
// };

const RemoteWidgetComponent = props => {
  return <div>RemoteWidgetComponent functionality is currently disabled.</div>;
}
export default RemoteWidgetComponent;
