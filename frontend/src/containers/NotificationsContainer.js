import { connect } from 'react-redux'
import Notifications from '../components/Notifications'

const mapStateToProps = (state, ownProps) => {
  if (!state.notifications) {
    return {notifications: []}
  }

  return {
    notifications: state.notifications,
  }
}

const NotificationsContainer = connect(
  mapStateToProps,
)(Notifications)

export default NotificationsContainer
