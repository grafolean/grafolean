/*
  Priority order for determining if we should use dark mode instead of light
  - light mode by default
  - unless env var "PREFER_DARK_MODE" is set to "yes" on the backend (communicated through /api/status/info/ gateway)
  - unless prefers-color-scheme css
  - unless localStorage entry indicates that someone has set their preference on this browser
  - unless user has set their preference explicitly (but his only works when logged in)
*/

const mqlPrefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');

export const isDarkMode = () => {
  return mqlPrefersDarkMode.matches;
};
