# KPI Dashboard

A web-based KPI tracking system for managing competitions, teams, and performance metrics across different pods and users.

## Background

I help run a few competition across various teams at work. I t was getting a little unwieldly trying to manage all of these in an excel workbook so I decided that I would give creating my own a go. 

I should point out here that I have no idea where to start when it comes to coding so this app was builit with alot of help from various AIs in VS Code. So there's one thing I can almost gaurentee, the code is not pretty and could probably be slimmed down... but I have no idea where to start.

## Features

- Competition management
- Team & pod organization 
- Individual and team performance tracking
- Rule-based scoring system
- Performance analytics and reporting
- Date-based filtering
- Random team assignment functionality

## Roadmap

- Admin login 
- OAuth integration
- Microsoft 365 intigration
- - Button in teams where the users score for that button increases
- - Auto post to selected teams chat or channel on change of table
- Search for User function for adding points

## Installation

This setup assumes you have a lampstack setup already on whichever platform you intend to use. 
This app has been developed across the latest offical php, mariadb and phpmyadmin containers on docker.

1. ### install the webserver
some of these fetaures may not be required but has become park of my standard web deployment!
```
apt update && apt upgrade -y && apt install -y nano curl wget zip unzip apache2 php php-json php-mysqli php-curl php-dom php-exif php-fileinfo php-igbinary php-imagick php-intl php-mbstring php-xml php-zip php-apcu php-memcached php-opcache php-redis php-iconv php-shmop php-simplexml php-xmlreader php-ssh2 php-ftp php-sockets
```
Enable redirects in /etc/apache2/apache2.conf 
```
<Directory /var/www/>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
</Directory>
```
and make sure to setup the Virtual host file in /etc/apache2/sites-enabled/000-default.conf
```
<VirtualHost *:80>
    ServerName kpi.internal
    DocumentRoot /var/www/html

    # Main directory settings
    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted

        # Enable .htaccess files
        DirectoryIndex index.php
    </Directory>

    # Public directory settings
    <Directory /var/www/html/public>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Error handling
    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined

    # PHP settings
    <FilesMatch \.php$>
        SetHandler application/x-httpd-php
    </FilesMatch>
</VirtualHost>
```
2. ### Clone the repository

Clone the Repo to your webroot. I have found the easiest way to get this part setup it to first delete the html/ folder in the /var/www/ folder, clone the repo and rename the new folder.
```
cd /var/www/ && git clone https://github.com/jimdhope/kpi-dashboard && rm -r -d html && mv kpi-dashboard/ html/
```

3. ### Create User and Database

In PHPMyAdmin create a new user in the User Accounts Tab of the main dashboard and make sure to tick the **Create database with same name and grant all privileges** box.

4. ### Import the Database

Select the dashboard database from the list on the left ahdn side of PHPMyAdmin and then head over to the imports tab. Download the (databse.sql)[https://raw.githubusercontent.com/jimdhope/kpi-dashboard/refs/heads/main/dashboard.sql] file. Import the newly downloaded database.sql file scroll to the bottom and click import

5. ### Update Database Deatils

Copy the app_config_example.php file rename it app_config.php and Edit the /includes/app_config.php in your favorite editor and update the relevant section with the details you setup in PHPMyAdmin
```
sudo cp /var/www/html/inlcudes/app_config_example.php /var/www/html/includes/app_config.php
sudo nano /var/wwww/html/includes/app_config.php

<?php
define('DB_HOST', 'DB HOST');
define('DB_PORT', 'DB PORT');
define('DB_NAME', 'DB NAME');
define('DB_USER', 'DB USER');
define('DB_PASS', 'BP PASSWORD');
define('APP_NAME', 'Competition Tracker');
define('APP_TIMEZONE', 'UTC');
?>
```
7. Set folder permissions:
This may have got muddled during the whole process of setting up so always worth double checking the folder permsisions.
```
chmod 755 /var/www/html/
chmod 644 /var/www/.htaccess
```
8. Access the application through your web browser

You should now be able to point your browser to your instance and see the homepage of the KPI Dashboard app.

## Requirements

- PHP 8.0+
- MySQL 5.7+
- Apache/Nginx web server
- PDO PHP Extension
- MySQL PHP Extension

## Security

- Update database credentials
- Secure the admin directory
- Configure proper file permissions
- Enable error logging
- Implement SSL certificate

## License

MIT License