<?php
session_start(); // Start the session

// Redirect to the public directory
header('Location: public/');
exit();
?>