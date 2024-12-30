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

## Installation

1. Clone the repository to your web server
```
git clone [repository-url]
```

2. Create a MySQL database named 'dashboard'

3. Import the database structure:
```
mysql -u [username] -p dashboard < 

dashboard.sql


```

4. Configure database connection:
- Navigate to `/includes/classes/`
- Copy `Database.example.php` to `Database.php`
- Update with your database credentials:
```php
private $host = 'localhost';
private $dbname = 'dashboard';
private $username = 'your_username';
private $password = 'your_password';
```

5. Set up web server:
- Point document root to `/webroot/` directory
- Ensure PHP 8.0+ is installed
- Enable PDO and MySQL extensions

6. Set folder permissions:
```bash
chmod 755 /webroot
chmod 644 /webroot/.htaccess
```

7. Access the application through your web browser

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