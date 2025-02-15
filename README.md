# mail-connect

API bridge for docker-mailserver

*mail-connect is still in early beta*

## What is it

mail-connect aims to connect your `docker-mailserver` to *anything* you can imagine, through the power of an API. Despite being used as a core component of LibreCloud, you can still implement mail-connect any way you wish!

We provide an extendable API which interacts with the `setup` utility via a Docker socket. While this offers advantages, mail-connect is still slow on some functions (such as listing accounts), as it's merely executing pre-made commands and parsing the output.

## Features

All features marked with an **E** are extended features, and are not a part of the original `setup` utility.

### Email

- [X] Create email
- [X] List emails
- [ ] **E** Create email from file
- [ ] Change password
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
- [ ] Unban IP
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
