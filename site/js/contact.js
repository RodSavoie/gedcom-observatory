/* Contact me. The form posts to contact.php, which sends the message by e-mail.
   Edit the wording between the back-ticks; it is ordinary HTML. HTML is the English page and HTML_FR the French one;
   the messages further down go through T() (js/lang/fr.js). */
(function () {
  'use strict';
  const FO = window.FO;
  const T = FO.T;

  /* the address, put together here so it is not sitting in the page for address-harvesting robots */
  const addr = () => ['rod', 'carolinesavoie.com'].join('@');

  const LINKS = `
  <a class="btn" href="https://www.linkedin.com/in/rodriguesavoie/" target="_blank" rel="noopener" style="text-decoration:none">LinkedIn ↗</a>
  <a class="btn" href="https://www.facebook.com/rod.savoie" target="_blank" rel="noopener" style="text-decoration:none">Facebook ↗</a>
  <a class="btn" href="https://www.wikitree.com/wiki/Savoie-2387" target="_blank" rel="noopener" style="text-decoration:none">WikiTree ↗</a>`;
  FO.socialLinks = LINKS;

  const HTML = `
<div class="caps">Contact me</div>
<h1>Write to me</h1>
<p class="lede">A question about an Acadian family, a correction to the tree, an idea for the site, or just a hello: I read every message.</p>
<div class="contact-grid">
  <form class="contact-form" novalidate>
    <label><span>Your name</span><input name="name" type="text" autocomplete="name" maxlength="100" required></label>
    <label><span>Your e-mail address</span><input name="email" type="email" autocomplete="email" maxlength="200" required></label>
    <label><span>Subject <small>(optional)</small></span><input name="subject" type="text" maxlength="150"></label>
    <label><span>Message</span><textarea name="message" rows="8" maxlength="5000" required></textarea></label>
    <label class="hp" aria-hidden="true"><span>Leave this empty</span><input name="website" type="text" tabindex="-1" autocomplete="off"></label>
    <input type="hidden" name="t">
    <div class="contact-row">
      <button type="submit" class="pill dark">Send the message</button>
      <span class="contact-status" role="status"></span>
    </div>
    <p class="muted contact-note">Your message is sent to me by e-mail and is not kept on this site. I will only use your address to reply.</p>
  </form>
  <aside class="contact-side">
    <h3>Elsewhere</h3>
    <p>You can also find me here.</p>
    <div class="links">${LINKS}</div>
    <h3>Genealogy</h3>
    <p>For a correction to someone in the tree, the quickest route is often their WikiTree profile, which anyone can help improve. Every person on this site links to theirs.</p>
  </aside>
</div>`;

  const HTML_FR = `
<div class="caps">Me contacter</div>
<h1>M’écrire</h1>
<p class="lede">Une question sur une famille acadienne, une correction à l’arbre, une idée pour le site ou simplement un bonjour&nbsp;: je lis tous les messages.</p>
<div class="contact-grid">
  <form class="contact-form" novalidate>
    <label><span>Votre nom</span><input name="name" type="text" autocomplete="name" maxlength="100" required></label>
    <label><span>Votre adresse courriel</span><input name="email" type="email" autocomplete="email" maxlength="200" required></label>
    <label><span>Objet <small>(facultatif)</small></span><input name="subject" type="text" maxlength="150"></label>
    <label><span>Message</span><textarea name="message" rows="8" maxlength="5000" required></textarea></label>
    <label class="hp" aria-hidden="true"><span>Laissez ce champ vide</span><input name="website" type="text" tabindex="-1" autocomplete="off"></label>
    <input type="hidden" name="t">
    <div class="contact-row">
      <button type="submit" class="pill dark">Envoyer le message</button>
      <span class="contact-status" role="status"></span>
    </div>
    <p class="muted contact-note">Votre message m’est envoyé par courriel et n’est pas conservé sur ce site. Je n’utiliserai votre adresse que pour vous répondre.</p>
  </form>
  <aside class="contact-side">
    <h3>Ailleurs</h3>
    <p>Vous pouvez aussi me trouver ici.</p>
    <div class="links">${LINKS}</div>
    <h3>Généalogie</h3>
    <p>Pour corriger une personne de l’arbre, le plus rapide est souvent de passer par son profil WikiTree, que tout le monde peut aider à améliorer. Chaque personne sur ce site renvoie au sien.</p>
  </aside>
</div>`;

  // what contact.php may answer (it writes English), in the reader's language
  const SERVER = {
    'Please add your name.': T('Please add your name.'),
    'Please check your e-mail address.': T('Please check your e-mail address.'),
    'Please write a message.': T('Please write a message.'),
    'Send the form to use this address.': T('Send the form to use this address.'),
    'The message form is not set up yet.': T('The message form is not set up yet.'),
    'This form can only be used from its own page.': T('This form can only be used from its own page.'),
    'Too many messages in a short time. Please try again later.': T('Too many messages in a short time. Please try again later.'),
    'The message could not be sent just now. Please try again later.': T('The message could not be sent just now. Please try again later.')
  };

  FO.renderContact = function (page) {
    const fr = FO.lang === 'fr';
    document.title = fr ? 'Me contacter | Cognitive Overload' : 'Contact me | Cognitive Overload';
    const art = document.createElement('article');
    art.className = 'me contact';
    art.innerHTML = fr ? HTML_FR : HTML;
    page.append(art);
    const form = art.querySelector('form'), status = art.querySelector('.contact-status'), send = form.querySelector('button');
    const F = n => form.elements.namedItem(n); // not form.name: that is the form's own name
    F('t').value = String(Date.now());
    const say = (msg, kind) => { status.textContent = msg; status.className = 'contact-status' + (kind ? ' ' + kind : ''); };
    const fallback = why => {
      say('');
      const p = document.createElement('p');
      p.className = 'contact-fallback';
      p.append(why + ' ' + T('You can write to me directly at') + ' ');
      const a = document.createElement('a'); a.href = 'mailto:' + addr(); a.textContent = addr();
      p.append(a, '.');
      form.querySelector('.contact-fallback') && form.querySelector('.contact-fallback').remove();
      form.append(p);
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = F('name').value.trim(), email = F('email').value.trim(), message = F('message').value.trim();
      if (!name) { say(T('Please add your name.'), 'err'); F('name').focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say(T('Please check your e-mail address.'), 'err'); F('email').focus(); return; }
      if (message.length < 5) { say(T('Please write a message.'), 'err'); F('message').focus(); return; }
      send.disabled = true; say(T('Sending…'));
      fetch('contact.php', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(r => r.json().catch(() => ({ ok: false, unavailable: true })).then(j => (r.ok ? j : Object.assign({ ok: false, unavailable: r.status === 404 || r.status === 405 }, j))))
        .then(j => {
          if (j.ok) {
            form.innerHTML = '';
            const done = document.createElement('div'); done.className = 'contact-done';
            done.innerHTML = T('<h3>Thank you</h3><p>Your message is on its way. I will reply as soon as I can.</p>');
            form.append(done);
            return;
          }
          send.disabled = false;
          if (j.unavailable) fallback(T('The message form is not working right now.'));
          else say(SERVER[j.error] || j.error || T('The message could not be sent. Please try again in a moment.'), 'err');
        })
        .catch(() => { send.disabled = false; fallback(T('The message could not be sent.')); });
    });
  };
})();
