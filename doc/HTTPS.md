# HTTPS

If you follow default installation (docker), setting up Grafolean for HTTPS should be easy. All traffic (including websockets) is going through Nginx, so it is enough to install certificate there.

There are two options:
- use LetsEncrypt - recommended
- use existing certificate

## Configuring certbot (LetsEncrypt certificates)

The guide below describes how to setup `certbot` on host computer, so that it correctly manages SSL/TLS certificates.

IMPORTANT: you need to replace `yourdomain.example.org` everywhere in this guide with some domain or IP address that actually leads to your host, both on port 80 and 443. Make sure you don't block port 80, because it is important for (re)issuing certificates.

1) Install `certbot` on the host machine. On Debian / Ubuntu:
  ```bash
    $ sudo add-apt-repository ppa:certbot/certbot
    $ sudo apt install certbot
  ```

2) If Grafolean is already running, stop it:
  ```bash
    $ sudo docker-compose down
  ```

3) Create a valid certificate using `certbot`:
  ```bash
    $ sudo certbot certonly --standalone -d yourdomain.example.org
  ```
  (replace `yourdomain.example.org` with the actual domain or IP address)

4) Create a directory that will allow container to serve certbot challenge:
  ```bash
    $ sudo mkdir -p /etc/letsencrypt/acme-challenge
  ```

5) Edit `docker-compose.yml` and make sure the following lines are enabled in `grafolean` service:
  ```
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt/acme-challenge:/var/www/acme-challenge
      - /etc/letsencrypt/live/yourdomain.example.org/fullchain.pem:/etc/certs/cert.crt
      - /etc/letsencrypt/live/yourdomain.example.org/privkey.pem:/etc/certs/cert.key
  ```
  (replace `yourdomain.example.org` with the actual domain or IP address)

6) Run Grafolean:
  ```bash
    $ sudo docker-compose up -d
  ```
  If everything went according to plan, you should now be able to access the service at `https://yourdomain.example.org/`. Congratulations!

7) Important final step - setup automatic certificate renewal process. Edit `/etc/cron.daily/certbot-renew` and enter the following content:
  ```
    #!/bin/sh
    /usr/bin/certbot renew --webroot --webroot-path /etc/letsencrypt/acme-challenge/ -n --post-hook "docker restart grafolean"
  ```
  Also make the file executable:
  ```bash
    $ sudo chmod 755 /etc/cron.daily/certbot-renew
  ```

  Note: the reason that `--post-hook` restarts the whole container instead of restarting just nginx is because certbot changes the inodes of the
  certificate files on renewal, which means they are not updated inside the container. If restarting container presents a problem, it can be
  solved by mounting the directory instead of certificate files (and changing configs appropriately).

## Existing certificates

If you have your own certificates and will renew them manually, it is enough to expose port `443` and mount certificates (as indicated in `docker-compose.yml`). When changing the certificates you also need to restart nginx:

```bash
docker exec -ti grafolean service nginx reload
```
