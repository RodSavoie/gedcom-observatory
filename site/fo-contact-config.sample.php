<?php
/* Settings for the Contact me form (contact.php).

   1. Copy this file and name the copy  fo-contact-config.php
   2. Fill in the password below.
   3. Upload the copy to your hosting HOME folder, the one ABOVE public_html (or above whatever
      folder holds the site), never inside the public web folder. contact.php looks for it there.
   This sample holds no password, so it is harmless if it ends up on the server too. */
return [
  'to'          => 'you@example.com',        // where messages are delivered
  'from'        => 'you@example.com',        // the sender address; must be allowed to send on the mail server
  'from_name'   => 'My family site',            // the sender name you will see in your inbox

  'smtp_host'   => 'mail.example.com',       // your outgoing mail server
  'smtp_port'   => 465,                             // 465 with 'ssl', or 587 with 'tls'
  'smtp_secure' => 'ssl',
  'smtp_user'   => 'you@example.com',        // usually the full e-mail address
  'smtp_pass'   => '',

  'subject_prefix' => '[my family site]',
  'max_per_hour'   => 5,                            // messages allowed from one visitor in an hour
];
