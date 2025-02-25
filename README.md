# mail-connect

[![Build Status](https://git.pontusmail.org/librecloud/mail-connect/actions/workflows/docker.yml/badge.svg)](https://git.pontusmail.org/librecloud/mail-connect/actions/?workflow=docker.yml)
[![Build Status](https://git.pontusmail.org/librecloud/mail-connect/actions/workflows/ci.yml/badge.svg)](https://git.pontusmail.org/librecloud/mail-connect/actions/?workflow=ci.yml)
[![Build Status](https://git.pontusmail.org/librecloud/mail-connect/actions/workflows/bump.yml/badge.svg)](https://git.pontusmail.org/librecloud/mail-connect/actions/?workflow=bump.yml)

API bridge for docker-mailserver

*mail-connect is still in early beta*

## What is it

mail-connect aims to connect your `docker-mailserver` to *anything* you can imagine, through the power of an API. Despite being used as a core component of LibreCloud, you can still implement mail-connect any way you wish!

We provide an extendable API which interacts with the `setup` utility via a Docker socket. We have implemented a SQLite database with Drizzle ORM for faster polling of users, with strategic caching and updating.

## What this API is NOT

This API is insecure by nature, however not completely. `mail-connect` is intended to be an API which is used internally _only_. The systems connected to this API should have proper protections against abuse. Think about it... would you like me to direct your mailserver security? I sure hope not...

As such, users who have access to this API are able to create unlimited accounts, and modify anyone's email address. Thus, your code should be the only user of this API. Once again, **do not make this API public**.

This provides more upsides than downsides, as it lets you implement enterprise-level security, or have simple IP-based ratelimits. Basic ratelimits have been added in case this API is abused on accident due to a failure in your system. You can configure this based on your expected traffic (plus a lot more, as sometimes you will get reasonable spikes of traffic).

## Features

All features marked with an **E** are extended features, and are not a part of the original `setup` utility.

## Self-Host with Docker

1. **Clone the repository**

   ```bash
   git clone https://git.pontusmail.org/librecloud/mail-connect.git
   ```

2. **Initialize database**

   ```bash
   bunx drizzle-kit generate
   bunx drizzle-kit migrate
   ```

3. **Copy/modify necessary files**

   ```bash
   touch migrate.txt # put emails (one per line) which already exist on the server which users can claim
   cp .env.example .env # you don't need to change anything here
   vim ratelimit.json # optional, customize to your liking...
   ```
   
   **Note:** If you are running mail-connect outside a Docker container (or changing the binds), please change the `MAILCONNECT_ROOT_DIR` to match your environment.

4. **Build and run the container**

   ```bash
   docker-compose up -d --build
   ```

   Pre-built images are provided in the [Packages](https://git.pontusmail.org/librecloud/mail-connect/packages) tab

   Your server will now be running on port `6723` by default (change this in `docker-compose.yml`)!

### Email

- [X] Create email
- [X] List emails
- [X] **E** View individual user details
- [X] **E** Create email from file
- [X] Change password
- [ ] Delete email
- [ ] Restrict email

### Alias

- [ ] Create alias
- [ ] List aliases
- [ ] Delete alias

### Quotas

- [ ] Set quota
- [ ] Delete quota

### dovecot-master

- [ ] Add
- [ ] Update
- [ ] Delete
- [ ] List

### Config

- [ ] DKIM

### Relay

- [ ] Add auth
- [ ] Add domain
- [ ] Exclude domain

### Fail2Ban

- [ ] Ban IP
- [ ] Un-ban IP
- [ ] Ban log
- [ ] Fail2Ban status

### Debug

- [ ] Fetchmail
- [ ] Login
- [ ] Show mail logs

## Future Improvements

I plan to implement a *much* more powerful API, when everything else has settled. I will be taking a look at the setup utility itself, and seeing how a more efficient approach can be taken.

Since `docker-mailserver` is built on Dovecot and Postfix, I am confident we can improve this API to be speedy and efficient as ever.

## To-Do

- [ ] Implement aforementioned features
- [ ] Swagger support
