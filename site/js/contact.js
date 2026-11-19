/* Contact me. The form posts to contact.php, which sends the message by e-mail.
   Edit the wording between the back-ticks; it is ordinary HTML. */
(function () {
  'use strict';
  const FO = window.FO;

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

  FO.renderContact = function (page) {
    document.title = 'Contact me | Cognitive Overload';
    const art = document.createElement('article');
    art.className = 'me contact';
    art.innerHTML = HTML;
    page.append(art);
    const form = art.querySelector('form'), status = art.querySelector('.contact-status'), send = form.querySelector('button');
    const F = n => form.elements.namedItem(n); // not form.name: that is the form's own name
    F('t').value = String(Date.now());
    const say = (msg, kind) => { status.textContent = msg; status.className = 'contact-status' + (kind ? ' ' + kind : ''); };
    const fallback = why => {
      say('');
      const p = document.createElement('p');
      p.className = 'contact-fallback';
      p.append(why + ' You can write to me directly at ');
      const a = document.createElement('a'); a.href = 'mailto:' + addr(); a.textContent = addr();
      p.append(a, '.');
      form.querySelector('.contact-fallback') && form.querySelector('.contact-fallback').remove();
      form.append(p);
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = F('name').value.trim(), email = F('email').value.trim(), message = F('message').value.trim();
      if (!name) { say('Please add your name.', 'err'); F('name').focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('Please check your e-mail address.', 'err'); F('email').focus(); return; }
      if (message.length < 5) { say('Please write a message.', 'err'); F('message').focus(); return; }
      send.disabled = true; say('Sending…');
      fetch('contact.php', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(r => r.json().catch(() => ({ ok: false, unavailable: true })).then(j => (r.ok ? j : Object.assign({ ok: false, unavailable: r.status === 404 || r.status === 405 }, j))))
        .then(j => {
          if (j.ok) {
            form.innerHTML = '';
            const done = document.createElement('div'); done.className = 'contact-done';
            done.innerHTML = '<h3>Thank you</h3><p>Your message is on its way. I will reply as soon as I can.</p>';
            form.append(done);
            return;
          }
          send.disabled = false;
          if (j.unavailable) fallback('The message form is not working right now.');
          else say(j.error || 'The message could not be sent. Please try again in a moment.', 'err');
        })
        .catch(() => { send.disabled = false; fallback('The message could not be sent.'); });
    });
  };
})();
