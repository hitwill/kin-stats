# Kin Metrics
This code reads data from Kin ecosystem's stellar blockchain and persists it in a database
You can connect the database to grafana to see a dashboard of the data

# Installation
This code uses node.js
1. Download the source from github
2. Create a .env file with DB_CREDENTIALS=mysql://DB_USER:DB_PASSq@DB_URL:DB_PORT/DB_NAME
3. Run kin.sql to create the database on your server
4. Upload the grafana json file to see the data on grafana