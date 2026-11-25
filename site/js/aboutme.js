/* About me. Edit the text between the back-ticks below; it is ordinary HTML.
   HTML is the English page and HTML_FR the French one (shown when the site is in French); keep the two in step. */
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

<div class="links">
  <a class="btn" href="https://www.wikitree.com/wiki/Savoie-2387" target="_blank" rel="noopener" style="text-decoration:none">My WikiTree profile ↗</a>
  <a class="btn" href="https://www.wikitree.com/wiki/Project:Acadians" target="_blank" rel="noopener" style="text-decoration:none">The Acadians Project ↗</a>
  <a class="btn" href="https://www.linkedin.com/in/rodriguesavoie/" target="_blank" rel="noopener" style="text-decoration:none">LinkedIn ↗</a>
  <a class="btn" href="https://www.facebook.com/rod.savoie" target="_blank" rel="noopener" style="text-decoration:none">Facebook ↗</a>
  <a class="btn" href="#/" style="text-decoration:none">Open the Family Observatory</a>
  <a class="btn" href="#/contact" style="text-decoration:none">Contact me</a>
</div>
`;

  const HTML_FR = `
<div class="caps">À propos de moi</div>
<h1>Rod Savoie</h1>

<img class="me-photo" src="img/rod-savoie.jpg" width="720" height="720" alt="Portrait de Rod Savoie au crayon">

<p class="lede">Ingénieur de formation, enseignant d’instinct, gérant musical par engagement familial et, depuis quelque temps, quelqu’un qui passe beaucoup de temps avec des gens morts il y a trois cents ans.</p>

<h2>Pourquoi Cognitive Overload</h2>
<p>Nous n’avons jamais eu autant d’information à portée de main, ni si peu de temps pour lui donner un sens. Chaque jour apporte plus de fils d’actualité, d’alertes, de données et d’opinions que personne ne peut en absorber. La pile ne cesse de grossir, pendant que la durée de vie de ce que nous savons ne cesse de raccourcir.</p>
<p>J’ai passé la plus grande partie de ma vie professionnelle autour de ce problème&nbsp;: d’abord en salle de classe, puis en créant des technologies d’apprentissage, puis en travaillant avec des données de santé publique. Cognitive Overload est mon petit coin pour l’explorer. L’idée est simple&nbsp;: prendre quelque chose de trop grand pour tenir dans sa tête, et trouver une façon de le voir.</p>
<p>Un arbre généalogique est un bon test. Le mien compte plus de sept mille personnes. Sous forme de liste, il est illisible. Dessiné en étoiles, en anneaux, en rivières et en fils, il commence à raconter une histoire. C’est à cela que sert l’<a href="#/">Observatoire familial</a> de ce site.</p>

<h2>La version courte d’une vie</h2>
<ol class="timeline">
  <li><b>1965</b>Naissance à Tracadie, au Nouveau-Brunswick, à l’hôpital le plus proche de mon village natal, Néguac. J’y ai grandi avec un frère et deux sœurs.</li>
  <li><b>1984 à 1986</b>Trois saisons de baseball avec les Keefe Cubs juniors de Moncton. Retenez bien ça.</li>
  <li><b>1987 à 1996</b>Le génie mécanique, trois fois plutôt qu’une&nbsp;: un baccalauréat à l’École Polytechnique de Montréal, une maîtrise à l’Université de Moncton, accompagnée de la Médaille d’or du Gouverneur général, et un doctorat à l’Université de Sherbrooke sur la simulation de l’écoulement des fluides.</li>
  <li><b>1990</b>Mariage avec Pauline à Moncton. Trois enfants formidables ont suivi&nbsp;: une autrice-compositrice-interprète, un ingénieur en logiciel et un médecin.</li>
  <li><b>1992 à 2001</b>Professeur à l’Université de Moncton, à Moncton et à Edmundston. Plus de vingt cours, de la thermodynamique et de la mécanique des fluides à une introduction au multimédia et, oui, à la construction résidentielle.</li>
  <li><b>2001</b>Arrivée au Conseil national de recherches du Canada, à Moncton, pour deux décennies consacrées aux technologies d’apprentissage. Le groupe que je dirigeais est passé de trois à plus de vingt personnes. En chemin sont venus une quarantaine d’articles de recherche et deux brevets.</li>
  <li><b>2012</b>Je deviens président-directeur général, directeur financier et gérant de Caroline Savoie Music Inc. C’est une façon bien solennelle de dire que je m’occupe du côté affaires de la carrière musicale de ma fille <a href="https://www.carolinesavoie.com" target="_blank" rel="noopener">Caroline</a>.</li>
  <li><b>2022 à 2024</b>À la tête de la division de l’innovation en matière de données à l’Agence de la santé publique du Canada, à bâtir les chaînes de données qui alimentent les décisions de santé publique.</li>
  <li><b>2024</b>Retour au Conseil national de recherches, où je travaille aujourd’hui.</li>
  <li><b>2025 et 2026</b>Ces équipes des Keefe Cubs sont entrées au Mur de la renommée sportive de Moncton, puis, un an plus tard, au Temple de la renommée sportive des Maritimes. Quarante ans, c’est long pour attendre un rappel.</li>
</ol>

<h2>Comment la généalogie m’a happé</h2>
<p>Je suis venu à la généalogie sur le tard, au début des années 2020, un peu par accident. Quand les résultats ADN de ma femme sont arrivés, elle apparaissait comme ma cousine au troisième degré. Elle ne l’est pas. Elle est ma cousine au sixième degré une fois, puis au septième, au huitième et ainsi de suite, de nombreuses fois. Mes propres parents se sont révélés apparentés entre eux à peu près de la même façon.</p>
<p>C’est ainsi que j’ai découvert l’implexe, un mot que je n’avais jamais entendu. Dans une petite population fondatrice où les familles se marient entre elles pendant des générations, les mêmes ancêtres reviennent sans cesse. Plus d’une vingtaine de mes ancêtres me rejoignent chacun par plus de vingt chemins différents. Antoinette Landry est mon ancêtre près de cinquante fois&nbsp;: ce site compte 49 lignées distinctes, et la vue <a href="#/collapse">Implexe</a> les dessinera toutes.</p>
<p>Même mon ADN est d’accord. Ma lignée paternelle directe et ma lignée maternelle directe remontent toutes deux au même couple fondateur acadien, François Savoie et Catherine LeJeune. Par ma mère, l’arbre rejoint aussi Charles Saint-Étienne de La Tour, l’une des premières figures de l’Acadie.</p>
<p>Je suis ingénieur, alors forcément, j’ai voulu mesurer tout cela et le dessiner. Plus je creusais, plus j’étais surpris, et je n’ai pas cessé de creuser.</p>

<h2>Le projet Acadiens sur WikiTree</h2>
<p>WikiTree est un site gratuit et collaboratif où chacun travaille sur un seul arbre partagé plutôt que sur des milliers de copies privées. Son <a href="https://www.wikitree.com/wiki/Project:Acadians" target="_blank" rel="noopener">projet Acadiens</a> est l’un des plus vastes du site. Le but&nbsp;: un arbre unique et bien documenté des familles françaises établies en Acadie entre 1600 et 1763, de leurs descendants, et des Acadiens déplacés qui ont vécu en exil après les déportations commencées en 1755.</p>
<p>C’est important parce que c’est l’histoire d’un peuple façonné par la migration, la perte et la résilience. Les familles ont été dispersées sur plus d’un continent, et elles ont pourtant gardé leur identité et rebâti leurs communautés. Les traces écrites ont été dispersées avec elles&nbsp;: recensements, listes de passagers et registres paroissiaux, dans plus d’un pays. C’est en rassemblant ces morceaux, avec soin et avec des sources, que l’histoire reste vraie.</p>
<p>Je travaille surtout avec des sources primaires&nbsp;: je transcris, j’indexe et j’organise des documents des XVII<sup>e</sup> et XVIII<sup>e</sup> siècles pour que tout le monde puisse les lire et les citer. Environ la moitié des <a href="https://www.wikitree.com/wiki/Category:Acadians_Project_Free_Space_Pages" target="_blank" rel="noopener">pages d’espace libre</a> du projet, des recensements aux listes des navires de la déportation, sont des pages que j’ai créées et dont je m’occupe. On y trouve notamment une transcription complète du <a href="https://www.wikitree.com/wiki/Space:1671_Acadian_Census_Transcript" target="_blank" rel="noopener">recensement acadien de 1671</a>, les convois qui ont mené des réfugiés acadiens de <a href="https://www.wikitree.com/wiki/Space:Ch%C3%A2tellerault_to_Nantes:_The_Acadian_Convoys_of_1775_and_1776" target="_blank" rel="noopener">Châtellerault à Nantes en 1775 et 1776</a>, et un relevé combiné des recensements des <a href="https://www.wikitree.com/wiki/Space:1756_-_1766_Combined_Censuses_of_Acadian_Exiles_in_Massachusetts" target="_blank" rel="noopener">exilés acadiens au Massachusetts de 1756 à 1766</a>.</p>
<p>L’écriture est l’une des difficultés. Pages abîmées, graphie ancienne et encre pâlie mettent en échec la reconnaissance de texte ordinaire. J’ai donc mis au point une méthode qui confie à des modèles d’IA récents la lecture de chaque page, la résolution des vieilles abréviations et le classement des noms, des dates et des lieux dans des tableaux propres. Je me concentre en ce moment sur les registres paroissiaux de l’Île Royale, dont les habitants ont, historiquement, reçu moins d’attention.</p>

<div class="links">
  <a class="btn" href="https://www.wikitree.com/wiki/Savoie-2387" target="_blank" rel="noopener" style="text-decoration:none">Mon profil WikiTree ↗</a>
  <a class="btn" href="https://www.wikitree.com/wiki/Project:Acadians" target="_blank" rel="noopener" style="text-decoration:none">Le projet Acadiens ↗</a>
  <a class="btn" href="https://www.linkedin.com/in/rodriguesavoie/" target="_blank" rel="noopener" style="text-decoration:none">LinkedIn ↗</a>
  <a class="btn" href="https://www.facebook.com/rod.savoie" target="_blank" rel="noopener" style="text-decoration:none">Facebook ↗</a>
  <a class="btn" href="#/" style="text-decoration:none">Ouvrir l’Observatoire familial</a>
  <a class="btn" href="#/contact" style="text-decoration:none">Me contacter</a>
</div>
`;

  FO.renderMe = function (page) {
    const fr = FO.lang === 'fr';
    document.title = fr ? 'À propos de moi | Cognitive Overload' : 'About me | Cognitive Overload';
    const art = document.createElement('article');
    art.className = 'me';
    art.innerHTML = fr ? HTML_FR : HTML;
    page.append(art);
  };
})();
