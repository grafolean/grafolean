import React, { Component } from 'react';

import Loading from '../Loading';

const DashboardView = (props) => {
  return (
    <div>
        Dashboard: {props.match.params.slug}
        <hr />
        {(props.loading)?(
          <Loading />
        ):(props.name)}
    </div>
  )
};

export default DashboardView;
