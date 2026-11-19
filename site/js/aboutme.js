/* About me. Edit the text between the back-ticks below; it is ordinary HTML. */
(function () {
  'use strict';
  const FO = window.FO;

  const HTML = `
<div class="caps">About me</div>
<h1>Rod Savoie</h1>

<img class="me-photo" src="img/rod-savoie.jpg" width="720" height="720" alt="Pencil sketch portrait of Rod Savoie">

<p class="lede">Engineer by training, teacher by instinct, music manager by family commitment, and lately someone who spends a lot of time with people who died three hundred years ago.</p>

<h2>Why Cognitive Overload</h2>
<p>We've never had so much information within reach, and never so little time to make sense of it. Every day brings more feeds, more alerts, more data and more opinions than anyone can take in. The pile keeps growing while the shelf life of what we know keeps shrinking.</p>
<p>I've spent most of my working life around that problem: first in classrooms, then building learning technologies, then working with public health data. Cognitive Overload is my small corner for exploring that. The idea is simple. Take something too big to hold in your head, and find a way to see it.</p>
<p>A family tree is a good test. Mine has more than seven thousand people in it. As a list it is unreadable. Drawn as stars, rings, rivers and threads, it starts to tell a story. That is what the <a href="#/">Family Observatory</a> on this site is for.</p>

<h2>The short version of a life</h2>
<ol class="timeline">
  <li><b>1965</b>Born in Tracadie, New Brunswick, the hospital nearest my home town of Néguac. I grew up there with a brother and two sisters.</li>
  <li><b>1984 to 1986</b>Three seasons of baseball with the Moncton Junior Keefe Cubs. Hold that thought.</li>
  <li><b>1987 to 1996</b>Mechanical engineering, three times over: a bachelor's degree at École Polytechnique de Montréal, a master's at Université de Moncton, which came with a Governor General's Gold Medal, and a doctorate at Université de Sherbrooke on simulating how fluids move.</li>
  <li><b>1990</b>Married Pauline in Moncton. Three great children followed: a singer-songwriter, a software engineer and a physician.</li>
  <li><b>1992 to 2001</b>Taught at Université de Moncton, in Moncton and in Edmundston. More than twenty courses, from thermodynamics and fluid mechanics to an introduction to multimedia and, yes, residential construction.</li>
  <li><b>2001</b>Joined the National Research Council of Canada in Moncton and spent two decades on learning technologies. The group I led grew from three people to more than twenty. Along the way came some forty research papers and two patents.</li>
  <li><b>2012</b>Became chief executive, chief financial officer and manager of Caroline Savoie Music Inc. That is a grand way of saying I look after the business side of my daughter <a href="https://www.carolinesavoie.com" target="_blank" rel="noopener">Caroline's</a> music career.</li>
  <li><b>2022 to 2024</b>Led the Data Innovation division at the Public Health Agency of Canada, building the data pipelines that feed public health decisions.</li>
  <li><b>2024</b>Back at the National Research Council, where I work today.</li>
  <li><b>2025 and 2026</b>Those Keefe Cubs teams were inducted into the Moncton Sports Wall of Fame, and a year later into the Maritime Sports Hall of Fame. Forty years is a long wait for a call-up.</li>
</ol>

<h2>How genealogy got hold of me</h2>
<p>I came to genealogy late, in the early 2020s, and more or less by accident. When my wife's DNA results came back, she showed up as my third cousin. She's not. She's my sixth cousin once, and my seventh, eighth and so on, many times over. My own parents turned out to be related to each other in much the same way.</p>
<p>That was my introduction to pedigree collapse, a term I had never heard. In a small founding population where families intermarry for generations, the same ancestors keep coming back. More than twenty of my ancestors each reach me by more than twenty different paths. Antoinette Landry is my ancestor close to fifty times over; this site counts 49 separate lines, and the <a href="#/collapse">Pedigree Collapse</a> view will draw every one of them.</p>
<p>Even my DNA agrees. My direct paternal line and my direct maternal line both lead back to the same Acadian founding couple, François Savoie and Catherine LeJeune. Through my mother, the tree also reaches Charles Saint-Étienne de La Tour, one of the early figures of Acadie.</p>
<p>I'm an engineer, so naturally I wanted to measure all of this and draw it. The more I dug, the more surprised I was, and I haven't stopped digging.</p>

<h2>The Acadians Project on WikiTree</h2>
<p>WikiTree is a free, collaborative site where everyone works on one shared family tree instead of thousands of private copies. Its <a href="https://www.wikitree.com/wiki/Project:Acadians" target="_blank" rel="noopener">Acadians Project</a> is one of the most extensive on the site. The goal is a single, well-sourced tree of the French families who settled in Acadie between 1600 and 1763, of their descendants, and of the Acadians who were displaced and lived in exile after the deportations that began in 1755.</p>
<p>It matters because this is the history of a people shaped by migration, loss and resilience. Families were scattered across more than one continent, and they still kept their identity and rebuilt their communities. The paper trail was scattered with them: census lists, ship manifests and parish registers, in more than one country. Putting those pieces back together, carefully and with sources, is how the story stays true.</p>
<p>I work mostly with primary sources. From transcribing, to indexing and organizing documents from the 1600s and 1700s so that anyone can read and cite them. About half of the project's <a href="https://www.wikitree.com/wiki/Category:Acadians_Project_Free_Space_Pages" target="_blank" rel="noopener">Free Space pages</a>, from census lists to the manifests of deportation ships, are ones I built and curate. Among them are a full transcript of the <a href="https://www.wikitree.com/wiki/Space:1671_Acadian_Census_Transcript" target="_blank" rel="noopener">1671 Acadian census</a>, the convoys that carried Acadian refugees from <a href="https://www.wikitree.com/wiki/Space:Ch%C3%A2tellerault_to_Nantes:_The_Acadian_Convoys_of_1775_and_1776" target="_blank" rel="noopener">Châtellerault to Nantes in 1775 and 1776</a>, and a combined record of the censuses of <a href="https://www.wikitree.com/wiki/Space:1756_-_1766_Combined_Censuses_of_Acadian_Exiles_in_Massachusetts" target="_blank" rel="noopener">Acadian exiles in Massachusetts from 1756 to 1766</a>.</p>
<p>The handwriting is one of the difficult parts. Weathered pages, archaic script and faded ink make ordinary text recognition challenging, so I built a workflow that uses current AI models to read each page, resolve the old abbreviations and sort the names, dates and places into clean tables. A present focus is the parish registers of Île Royale, whose people have historically received less attention.</p>
<p>It is volunteer work, and the most rewarding kind. Every page transcribed puts a few more people back into the record.</p>

<div class="links">
  <a class="btn" href="https://www.wikitree.com/wiki/Savoie-2387" target="_blank" rel="noopener" style="text-decoration:none">My WikiTree profile ↗</a>
  <a class="btn" href="https://www.wikitree.com/wiki/Project:Acadians" target="_blank" rel="noopener" style="text-decoration:none">The Acadians Project ↗</a>
  <a class="btn" href="https://www.linkedin.com/in/rodriguesavoie/" target="_blank" rel="noopener" style="text-decoration:none">LinkedIn ↗</a>
  <a class="btn" href="https://www.facebook.com/rod.savoie" target="_blank" rel="noopener" style="text-decoration:none">Facebook ↗</a>
  <a class="btn" href="#/" style="text-decoration:none">Open the Family Observatory</a>
  <a class="btn" href="#/contact" style="text-decoration:none">Contact me</a>
</div>
`;

  FO.renderMe = function (page) {
    document.title = 'About me | Cognitive Overload';
    const art = document.createElement('article');
    art.className = 'me';
    art.innerHTML = HTML;
    page.append(art);
  };
})();
