FROM node:10.15-jessie-slim as build-deps
WORKDIR /usr/src/app
# first copy just package.json & lock, so we don't re-install anything on every change:
COPY package.json yarn.lock ./
RUN yarn install
COPY . ./
ARG GRAFOLEAN_CORS_DOMAINS
ARG REACT_APP_BACKEND_ROOT_URL
RUN yarn build


FROM nginx:1.14-alpine
COPY --from=build-deps /usr/src/app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]