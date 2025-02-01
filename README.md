# CCOMM-SERVER - Administration server for 'CCOMM' application

This project is a basic server that manages authentication, channel creation, and granting access and communication tokens.


## Description

Authentication is IP-based, where only ten simultaneous access token are granted per IP. 

Data is stored and managed with the Redis cache database. 

Communication tokens are granted by Ably, where the server is the unique authorized to create them.


## Requirements
- Node.js
- Nest.js
- Redis
- Ably
