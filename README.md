### Library Management System

Steps to run the code: 
 1. ```bash
      git clone https://github.com/AbhinavKaintura/Library-Management-System.git
    ```
2.  Add .env file and update it with your postgres server details. For example :
    ```bash
      PG_USER="postgres"  
      PG_HOST="localhost"
      PG_DATABASE="library"
      PG_PASSWORD="yourPassword"
      PG_PORT="5432"
      PORT=3000
    ```
3.  Run command
     ```bash
     npm i
     ```
4.  Run the server.js
    ```bash
    node server.js
    ```
5. Server will be running at port 3000.
