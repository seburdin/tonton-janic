/* =========================================================
   L’Affaire de la Moustache d’Or
   Un jeu d’enquête en français — HTML / CSS / JS sans dépendance.
   ========================================================= */
'use strict';

(() => {
  /* ---------- Petits outils ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const melange = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const auHasard = arr => arr[Math.floor(Math.random() * arr.length)];
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  /* =========================================================
     SONS (WebAudio, aucun fichier)
     ========================================================= */
  const Son = {
    ctx: null,
    muet: false,
    init() {
      if (this.ctx) return;
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    },
    bip(freq = 440, duree = 0.08, type = 'square', vol = 0.04, delai = 0) {
      if (this.muet) return;
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime + delai;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + duree + 0.02);
    },
    clic() { this.bip(880, 0.03, 'square', 0.02); },
    touche() { this.bip(1300 + Math.random() * 400, 0.012, 'square', 0.006); },
    indice() { [523, 659, 784].forEach((f, i) => this.bip(f, 0.12, 'triangle', 0.06, i * 0.08)); },
    enigme() { [392, 523, 659, 784, 1046].forEach((f, i) => this.bip(f, 0.16, 'triangle', 0.07, i * 0.09)); },
    victoire() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.bip(f, 0.22, 'triangle', 0.07, i * 0.13)); },
    rate() { this.bip(190, 0.22, 'sawtooth', 0.05); this.bip(140, 0.3, 'sawtooth', 0.05, 0.14); },
    coincoin() { this.bip(620, 0.08, 'sawtooth', 0.05); this.bip(480, 0.14, 'sawtooth', 0.05, 0.12); },
    ouaf() { this.bip(240, 0.09, 'sawtooth', 0.06); this.bip(190, 0.12, 'sawtooth', 0.06, 0.16); },
    dring() { for (let i = 0; i < 6; i++) this.bip(i % 2 ? 1250 : 1500, 0.06, 'square', 0.03, i * 0.07); },
  };

  /* =========================================================
     ÉTAT DE LA PARTIE (+ sauvegarde locale)
     ========================================================= */
  const CLE_SAUVEGARDE = 'moustache-dor-v1';
  const CLE_SON = 'moustache-dor-son';
  const nouvelEtat = () => ({
    nom: 'Lafouine',
    lieu: 'salon',
    flags: {},
    indices: [],
    sac: [],
    vus: {},
    sujets: {},
    flair: 0,
    aides: 0,
    erreurs: 0,
    minutes: 2,
    fini: false,
  });
  let S = nouvelEtat();

  function sauver() {
    try { localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(S)); } catch (e) { /* stockage indisponible */ }
  }
  function charger() {
    try {
      const d = JSON.parse(localStorage.getItem(CLE_SAUVEGARDE));
      if (d && Array.isArray(d.indices) && !d.fini) return Object.assign(nouvelEtat(), d);
    } catch (e) { /* rien */ }
    return null;
  }
  function effacer() {
    try { localStorage.removeItem(CLE_SAUVEGARDE); } catch (e) { /* rien */ }
  }

  const a = id => S.indices.includes(id);        // a-t-on cet indice ?
  const f = id => !!S.flags[id];                 // ce drapeau est-il levé ?
  const lever = id => { S.flags[id] = true; };
  const dansSac = id => S.sac.includes(id);
  const D = () => `Détective ${S.nom}`;

  /* =========================================================
     DONNÉES : INDICES & OBJETS
     ========================================================= */
  const INDICES = {
    vitrine:   { ico: '🪟', titre: 'Vitrine non forcée', texte: 'Pas d’effraction : la vitrine n’est jamais fermée à clé. Le voleur est sûrement quelqu’un de la maison.' },
    photo1997: { ico: '🖼️', titre: 'La photo de 1997', texte: 'Championnat départemental de la moustache, 1997 : Janic 1ᵉʳ, Poupard 2ᵉ (et furieux). Année à retenir : 1997.' },
    age:       { ico: '🎂', titre: '60 bougies', texte: 'Tonton Janic fête ses 60 ans ce soir.' },
    paillettes:{ ico: '✨', titre: 'Paillettes dorées', texte: 'De la peinture dorée à paillettes, presque fraîche, sur le tapis du salon. Le trophée, lui, n’a jamais eu de paillettes.' },
    scrabble:  { ico: '🔤', titre: 'Le chevalet de Mamie', texte: 'Lettres T · C · O · I · R · T. Au dos : « Mot de passe du grenier. Mélangé, pour les curieux. »' },
    message:   { ico: '✉️', titre: 'Le message codé', texte: '« ON SE VOIT A MINUIT DERRIERE LA HAIE. J. » Trouvé dans la poubelle de la cuisine.' },
    jessica:   { ico: '💘', titre: 'Le secret de Kevin', texte: 'J. = Jessica, la nièce de M. Poupard. Kevin a un rencard, pas un casse.' },
    salsa:     { ico: '💃', titre: 'Le reçu du Club Caliente', texte: '« Cours de salsa en visio – samedi 22h00-22h30 – Mme Ginette – niveau Volcan ».' },
    lampe:     { ico: '🗄️', titre: 'La lampe disparue', texte: 'La lampe de poche du tiroir de la cuisine a disparu juste avant la coupure. Ginette, elle, dansait la salsa dans le noir (alibi confirmé par Ricardo, son prof).' },
    coupure:   { ico: '🔌', titre: 'Coupure volontaire', texte: 'Le disjoncteur général a été abaissé À LA MAIN à 22h00. Ce n’était pas une panne : c’était un plan.' },
    laine:     { ico: '🧶', titre: 'Fil de laine rose fluo', texte: 'Accroché au levier du disjoncteur. Quelqu’un, dans cette maison, tricote du rose fluo...' },
    video:     { ico: '📱', titre: 'La vidéo de Kevin (22h03)', texte: 'En arrière-plan : une silhouette en robe de chambre à fleurs et pantoufles à pompons file vers l’escalier, un objet brillant sous le bras.' },
    empreinte: { ico: '👣', titre: 'Empreintes boueuses', texte: 'Pointure ≈ 46, semelle crantée, boue fraîche et jus de tomate. De la haie au potager... pas vers la maison.' },
    bottes:    { ico: '🥾', titre: 'Les bottes de Poupard', texte: 'Les empreintes du jardin correspondent aux bottes de M. Poupard.' },
    tomates:   { ico: '🍅', titre: 'Le voleur de tomates', texte: 'Poupard avoue voler les tomates de Janic depuis 3 ans. Pendant la coupure, il a vu une lampe de poche monter au grenier.' },
    peinture:  { ico: '🎨', titre: 'Peinture à paillettes', texte: 'Au grenier : un pot de « Doré Paillettes Extra » encore frais. Les mêmes paillettes que sur le tapis du salon.' },
    patron:    { ico: '📐', titre: 'Le patron de tricot', texte: '« Petit pull pour trophée – taille S – laine rose fluo ». Avec un dessin de moustache.' },
    torche:    { ico: '🔦', titre: 'La lampe de poche tiède', texte: 'Au grenier : la lampe de poche disparue de la cuisine. Encore tiède.' },
    note:      { ico: '📝', titre: 'La note signée « O. »', texte: '« Peinture sèche → remettre dans le panier, sous la pelote. Personne ne fouille le panier d’une mamie. — O. »' },
    pistache:  { ico: '🐶', titre: 'Le flair de Pistache', texte: 'Après un biscuit, Pistache file s’asseoir devant le panier à tricot de Mamie Odette... et éternue des paillettes dorées.' },
  };
  const NB_INDICES = Object.keys(INDICES).length;

  const OBJETS = {
    loupe:   { ico: '🔍', nom: 'Loupe de Tonton Janic', desc: 'Grossit les petits détails. Et les pores de la peau, malheureusement.' },
    biscuit: { ico: '🦴', nom: 'Biscuit Croc’Royal', desc: 'Biscuit pour chien. Saveur « bœuf-carotte ». Vous n’y avez pas goûté. Officiellement.' },
  };

  const ENIGMES = ['enigme_devinette', 'enigme_cesar', 'enigme_disjoncteur', 'enigme_code', 'enigme_chaussures', 'enigme_cadenas'];

  /* ---------- Gains ---------- */
  function gagner(id) {
    if (a(id)) return;
    S.indices.push(id);
    S.flair += 10;
    const i = INDICES[id];
    toast(`🔎 <b>Nouvel indice :</b> ${i.ico} ${i.titre} <span style="float:right">+10</span>`);
    Son.indice();
    const b = $('#btn-carnet');
    b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
    bumpStat('#flair');
  }
  function prendre(id) {
    if (dansSac(id)) return;
    S.sac.push(id);
    toast(`🎒 <b>Objet obtenu :</b> ${OBJETS[id].ico} ${OBJETS[id].nom}`, 'or');
    Son.indice();
  }
  function reussite(flag) {
    if (f(flag)) return;
    lever(flag);
    S.flair += 20;
    toast('🧩 <b>Énigme résolue !</b> <span style="float:right">+20</span>', 'or');
    Son.enigme();
    bumpStat('#flair');
  }

  /* =========================================================
     LES LIEUX
     ========================================================= */
  const ORDRE_LIEUX = ['salon', 'cuisine', 'entree', 'jardin', 'garage', 'grenier'];

  const LIEUX = {
    /* ---------------- SALON ---------------- */
    salon: {
      nom: 'Le Salon', ico: '🛋️',
      desc: 'La scène du crime. Ça sent le fraisier, la cire à moustache et le drame. Une banderole « JOYEUX 60 ANS JANIC » pendouille tristement au-dessus d’une vitrine vide.',
      arrivee: 'Retour au salon. Tonton Janic se mouche bruyamment dans une serviette en papier « Joyeux anniversaire ». Mamie Odette tricote. Ou dort. Difficile à dire.',
      persos: () => f('pistacheSalon') ? ['janic', 'mamie', 'pistache'] : ['janic', 'mamie'],
      points: [
        {
          id: 'vitrine', ico: '🏆', nom: 'La vitrine',
          act: () => {
            if (a('vitrine')) return 'La vitrine est toujours vide. Vous la fixez intensément, au cas où le trophée réapparaîtrait par culpabilité. Rien. Les trophées n’ont aucune morale.';
            gagner('vitrine');
            return `La vitrine de la Moustache d’Or. <b>Vide.</b> Sur le velours rouge, il ne reste que la marque du socle et une étiquette : « Moustache d’Or – Champion départemental 1997 – Catégorie Morse ».

Pas de vitre brisée. Pas de serrure forcée. Tonton Janic, derrière vous, renifle : « Je ne la ferme jamais à clé. Qui volerait ça ? »

Eh bien, quelqu’un, Janic. <b>Quelqu’un.</b>`;
          },
        },
        {
          id: 'cheminee', ico: '🖼️', nom: 'La cheminée',
          act: () => {
            if (a('photo1997')) return 'Vous regardez à nouveau la photo. M. Poupard vous regarde à nouveau. Même en photo, cet homme a l’air rancunier.';
            gagner('photo1997');
            return `Sur la cheminée, une photo encadrée : <b>Championnat départemental de la moustache, 1997</b>.

Janic, 1ᵉʳ, rayonnant, brandit la Moustache d’Or. À côté, M. Poupard, 2ᵉ, a le regard d’un homme qui vient de jurer vengeance sur trois générations.

Vous notez l’année dans votre carnet : <b>1997</b>. On ne sait jamais.`;
          },
        },
        {
          id: 'gateau', ico: '🎂', nom: 'Le gâteau',
          act: () => {
            if (a('age')) return auHasard([
              'Vous vous servez une petite part. Pour l’enquête. Le fraisier est excellent. Ça, au moins, ce n’est pas un mystère.',
              'Une deuxième part ? Un bon détective doit rester alerte. Et le sucre, c’est de l’énergie. Vous prenez une troisième part.',
              'Il ne reste plus beaucoup de gâteau. Vous soupçonnez Pistache. Pistache vous soupçonne.',
            ]);
            gagner('age');
            return `Un fraisier géant planté de <b>60 bougies</b>. Le chiffre est confirmé : Tonton Janic a <b>60 ans</b> aujourd’hui. Le détecteur de fumée, au plafond, a l’air très stressé.

Quelqu’un a déjà croqué un coin du gâteau. Les traces de dents sont... canines. Pistache, encore lui.`;
          },
        },
        {
          id: 'tapis', ico: '🟫', nom: 'Le tapis',
          act: () => {
            if (!dansSac('loupe')) return `Un tapis « persan » (étiquette : Gifi, 2008). Quelque chose brille entre les poils, mais c’est minuscule. Il vous faudrait une <b>loupe</b>.

Un détective sans loupe, franchement. C’est comme une moustache sans cire.`;
            if (a('paillettes')) return 'Plus de paillettes à trouver. Par contre, vous avez découvert une cacahuète de 2019. Vous la laissez là, par respect pour l’histoire.';
            gagner('paillettes');
            return `Loupe à la main, à quatre pattes sur le tapis (Pistache, ravi, en profite pour vous lécher l’oreille), vous découvrez des <b>paillettes dorées</b>.

Elles collent aux doigts : c’est de la <b>peinture à paillettes</b>, presque fraîche.

Bizarre : le trophée n’a jamais eu de paillettes. Janic l’astique au produit à cuivre tous les dimanches, en chantant du Johnny.`;
          },
        },
        {
          id: 'scrabble', ico: '🔤', nom: 'Le Scrabble',
          act: () => {
            if (a('scrabble')) return 'Les six lettres sont toujours sur le chevalet : <b>T · C · O · I · R · T</b>. Elles ont l’air de vouloir dire quelque chose. Quelque chose que Mamie fait toute la journée...';
            gagner('scrabble');
            return `Sur la table basse, la partie de Scrabble de Mamie Odette. Sur le plateau : « MOUSTACHE » (mot compte triple), « RANCUNE », et « POUPARD » (refusé, nom propre, mais Mamie a insisté avec sa canne).

Sur son chevalet, six lettres : <b>T · C · O · I · R · T</b>.

Au dos du chevalet, au crayon tremblant : « <i>Mot de passe du grenier, pour quand ma mémoire flanche. Mélangé, pour les curieux.</i> »

Les curieux, c’est vous.`;
          },
        },
        {
          id: 'panier', ico: '🧺', nom: 'Le panier à tricot',
          act: () => {
            if (a('pistache')) return `Le panier à tricot de Mamie. Pistache n’arrête pas de le renifler. Mamie Odette a posé ses aiguilles dessus, comme une sentinelle avec deux épées.

Pour fouiller le panier d’une mamie, il vous faudra plus qu’une intuition : <b>une accusation en bonne et due forme</b>.`;
            return auHasard([
              `Vous tendez la main vers le panier à tricot de Mamie Odette. Sans même ouvrir les yeux, elle dit : « On ne touche pas au panier d’une dame, jeunesse. »

Votre main recule toute seule. Instinct de survie.`,
              'Vous vous approchez à nouveau du panier. Une aiguille à tricoter se plante dans l’accoudoir, à deux centimètres de vos doigts. Mamie Odette ronfle. Officiellement.',
            ]);
          },
        },
      ],
    },

    /* ---------------- CUISINE ---------------- */
    cuisine: {
      nom: 'La Cuisine', ico: '🍳',
      desc: 'Le domaine réservé de Tata Ginette. Il y a assez de nourriture pour nourrir un régiment. Ou trois cousins. Ça sent la blanquette et la quiche brûlée.',
      arrivee: 'Vous entrez dans la cuisine. Tata Ginette vous tend une assiette avant même que vous ayez dit bonjour. C’est un réflexe, chez elle.',
      persos: () => ['ginette'],
      points: [
        {
          id: 'poubelle', ico: '🗑️', nom: 'La poubelle',
          act: () => {
            if (f('enigme_cesar')) return 'La poubelle n’a plus de secrets pour vous. Vous lui avez tout pris. Même sa dignité.';
            enigmeCesar();
            return 'Vous fouillez la poubelle. Ce n’est pas glamour, mais c’est le métier. Entre deux épluchures de carottes : un papier plié, couvert de lettres absurdes...';
          },
        },
        {
          id: 'frigo', ico: '🧊', nom: 'Le frigo',
          act: () => {
            const n = S.vus.frigo;
            if (n === 1) return 'Un mot sur le frigo : « NE PAS TOUCHER À LA MOUSSE AU CHOCOLAT. — La Direction (Ginette). »\n\nVous refermez le frigo. Vous tenez à la vie.';
            if (n === 2) return 'Vous rouvrez le frigo. La mousse au chocolat vous regarde. Vous la regardez. Vous refermez. Le devoir d’abord.';
            if (n === 3) return 'Vous rouvrez le frigo. Tata Ginette, derrière vous : « JE VOUS VOIS. » Vous refermez. Vous ne l’aviez même pas entendue arriver. Cette femme est un ninja.';
            return 'Le frigo ronronne. Il ne dira rien. Les frigos ne parlent jamais à la police.';
          },
        },
        {
          id: 'livre', ico: '📕', nom: 'Le livre de recettes',
          act: () => {
            if (a('salsa')) return 'Le livre de recettes de Ginette. 412 pages, dont 37 de blanquette. Vous apprenez à faire la quiche « façon Ginette » : il faut l’oublier au four pendant une heure.';
            gagner('salsa');
            return `Le grand livre de recettes de Tata Ginette. Entre la page « Blanquette » et la page « Re-blanquette », un reçu glissé en marque-page :

« <b>Club Caliente – Cours de salsa en visio</b> – Samedi 22h00-22h30 – Mme Ginette – Niveau : <i>Volcan</i> 🌋 »

Samedi 22h00. C’est-à-dire... pile pendant la coupure. Tiens, tiens.`;
          },
        },
        {
          id: 'placard', ico: '🥫', nom: 'Le placard',
          act: () => {
            if (dansSac('biscuit') || a('pistache')) return 'Il reste des biscuits pour chien dans le placard. Vous résistez. De justesse.';
            prendre('biscuit');
            return 'Des conserves, des conserves, encore des conserves (Ginette prépare l’apocalypse), et un paquet de biscuits pour chien « <b>Croc’Royal</b> ».\n\nVous en prenez un. Pour l’enquête. Pas pour vous. Enfin, probablement.';
          },
        },
        {
          id: 'four', ico: '🔥', nom: 'Le four',
          act: () => 'Une quiche carbonisée. Victime collatérale de la coupure de courant ?\n\nGinette : « Non non, je la fais toujours comme ça. C’est la croûte qui donne du goût. » La quiche est entièrement croûte.',
        },
      ],
    },

    /* ---------------- ENTRÉE ---------------- */
    entree: {
      nom: 'L’Entrée', ico: '🚪',
      desc: 'Le hall des Glycines. Un panneau écrit à la main : « CHEZ GINETTE, ON SE DÉCHAUSSE ». Un escalier étroit grince vers le grenier.',
      arrivee: 'Vous voilà dans l’entrée. Il y règne une odeur subtile de chaussettes et de mystère.',
      persos: () => [],
      points: [
        {
          id: 'chaussures', ico: '👞', nom: 'Le meuble à chaussures',
          act: () => {
            if (f('enigme_chaussures')) return 'Les bottes de M. Poupard sont toujours là, boueuses et coupables. Coupables de tomates, en tout cas.';
            if (!a('empreinte')) return 'Un meuble à chaussures bien rempli : chez Ginette, on se déchausse. Baskets, bottes, mocassins, escarpins... Sans élément de comparaison, ce ne sont que des chaussures. Et elles sentent.';
            enigmeChaussures();
            return 'Vous sortez votre croquis des empreintes du jardin. Il est temps de jouer à Cendrillon, version boue.';
          },
        },
        {
          id: 'portemanteau', ico: '🧥', nom: 'Le portemanteau',
          act: () => auHasard([
            'Dans la poche du manteau de Janic : un ticket de PMU perdant, un bonbon à la menthe de 1998 et une photo de... Janic. Cet homme s’aime beaucoup.',
            'Le blouson de Kevin. Dans la poche : un flacon de parfum « Sauvage » à moitié vide. Il s’est parfumé pour quelqu’un. Ou pour tout le quartier.',
            'Le manteau de Poupard. Dans la poche : un sachet de graines de tomates, et une liste « Choses à faire : 1) Venger 1997. 2) Acheter du pain. »',
          ]),
        },
        {
          id: 'escalier', ico: '🪜', nom: 'L’escalier du grenier',
          act: () => {
            if (f('grenierOuvert')) { allerA('grenier'); return null; }
            if (!a('scrabble')) return `Un escalier étroit monte vers le grenier. La porte est fermée par un <b>cadenas à 6 lettres</b>.

Vous essayez « OUVRE ». Rien. « SESAME ». Rien. « SVPMERCI ». Trop long.

Quelqu’un dans cette maison connaît forcément ce mot...`;
            enigmeCadenas();
            return 'Le cadenas du grenier. Six lettres. Vous repensez au chevalet de Mamie...';
          },
        },
        {
          id: 'telephone', ico: '☎️', nom: 'Le téléphone fixe',
          act: () => {
            Son.dring();
            return 'Un téléphone à cadran, beige, magnifique. Vous composez le 17 par réflexe, puis vous raccrochez : la police, ce soir, c’est vous.\n\nKevin, au loin : « C’est quoi ce Wi-Fi avec un fil ? »';
          },
        },
      ],
    },

    /* ---------------- JARDIN ---------------- */
    jardin: {
      nom: 'Le Jardin', ico: '🌳',
      desc: 'Il fait nuit, il fait frais, et ça sent la tomate. Au fond, la haie. De l’autre côté de la haie : la maison de M. Poupard, l’ennemi juré.',
      arrivee: 'Vous sortez dans le jardin. La pluie s’est arrêtée, mais votre imperméable ne le sait pas encore.',
      persos: () => f('pistacheSalon') ? ['poupard'] : ['poupard', 'pistache'],
      points: [
        {
          id: 'empreintes', ico: '👣', nom: 'Les empreintes',
          act: () => {
            if (a('empreinte')) return 'Les empreintes sont toujours là : grosses, crantées, tomatées. Elles vont de la haie au potager. Jamais vers la maison.';
            gagner('empreinte');
            return `Dans la boue, près de la haie : de grandes empreintes de pas. Vous vous accroupissez.

<b>Pointure 46 environ. Semelle crantée.</b> Boue encore fraîche... et de petites taches rouges, avec des pépins.

Du sang ? Vous goûtez. C’est de la tomate. (Ne faites jamais ça à la maison.)

Les traces vont de la haie au potager... et pas du tout vers la maison. Il faudrait les comparer aux chaussures des invités.`;
          },
        },
        {
          id: 'potager', ico: '🍅', nom: 'Le potager',
          act: () => 'Le potager de Tonton Janic. Les plants de tomates sont étrangement... déplumés. Il manque au moins une douzaine de tomates.\n\nCe jardin cache un autre crime. Un crime à la sauce bolognaise.',
        },
        {
          id: 'trou', ico: '🕳️', nom: 'Le trou',
          act: () => 'Un trou fraîchement creusé. Au fond : un os, une chaussette orpheline, une télécommande (Janic la cherche depuis mars) et un gant de jardinage brodé « <b>R.P.</b> ».\n\nPistache a des goûts éclectiques.',
        },
        {
          id: 'haie', ico: '🌿', nom: 'La haie',
          act: () => a('jessica')
            ? 'La haie de l’amour interdit. Kevin a gravé « K + J » dans l’écorce d’un arbuste, avec un cœur. Et une moustache. On ne se refait pas.'
            : 'Une haie très épaisse sépare le jardin de celui de M. Poupard. Sur une branche, quelqu’un a accroché un petit cœur en papier. Bizarre, pour une frontière en guerre.',
        },
      ],
    },

    /* ---------------- GARAGE ---------------- */
    garage: {
      nom: 'Le Garage', ico: '🔧',
      desc: 'Ça sent l’huile de vidange et l’ambition. Le tableau électrique clignote. Kevin filme ses vidéos ici, « pour l’acoustique ».',
      arrivee: 'Vous entrez dans le garage. Kevin vous filme immédiatement. « Dis bonjour aux abonnés ! » Vous dites bonjour aux abonnés.',
      persos: () => ['kevin'],
      points: [
        {
          id: 'disjoncteur', ico: '⚡', nom: 'Le tableau électrique',
          act: () => {
            if (f('enigme_disjoncteur')) return 'Le tableau électrique ronronne. Tout est en ordre. Le fil de laine rose fluo, lui, est désormais dans votre carnet.';
            enigmeDisjoncteur();
            return 'Le tableau électrique est un champ de bataille : depuis la coupure, la moitié des fusibles sont tombés. Le Wi-Fi est mort. Kevin est en deuil.';
          },
        },
        {
          id: 'etabli', ico: '🧰', nom: 'L’établi',
          act: () => {
            if (dansSac('loupe')) return 'L’établi de Janic : une boîte de cire « Moustach’Or Extra-Fort », un peigne à moustache en corne, et le vide laissé par la loupe que vous avez empruntée.';
            prendre('loupe');
            return 'L’établi de Tonton Janic. Une boîte de cire « <b>Moustach’Or Extra-Fort</b> », un peigne à moustache en corne, un tournevis... et une <b>loupe</b>.\n\nVous l’empruntez. Avec une loupe, on voit tout. Même ce qu’on préférerait ne pas voir.';
          },
        },
        {
          id: 'telkevin', ico: '📱', nom: 'Le téléphone de Kevin',
          act: () => {
            if (f('enigme_code')) { montrerVideo(); return 'Vous revisionnez la vidéo de Kevin. Toujours aussi gênante. Toujours aussi révélatrice.'; }
            enigmeCode();
            return 'Le téléphone de Kevin, sur un trépied. Kevin : « Mets pas tes doigts sur l’écran, chef. »';
          },
        },
        {
          id: 'velo', ico: '🚲', nom: 'Le vélo',
          act: () => {
            Son.coincoin();
            return 'Le vélo de Kevin. Il a un klaxon en forme de canard. Vous klaxonnez.\n\n<b>COIN COIN.</b>\n\nÇa ne fait pas avancer l’enquête, mais ça fait du bien.';
          },
        },
      ],
    },

    /* ---------------- GRENIER ---------------- */
    grenier: {
      nom: 'Le Grenier', ico: '🕯️',
      desc: 'Poussière, toiles d’araignées grosses comme des hamacs, cartons de souvenirs... et une étrange odeur de peinture fraîche.',
      arrivee: 'Vous montez au grenier. Chaque marche grince comme un vieux chat qu’on aurait réveillé. Une odeur vous chatouille le nez : de la peinture fraîche.',
      persos: () => [],
      points: [
        {
          id: 'pot', ico: '🎨', nom: 'Le pot de peinture',
          act: () => {
            if (a('peinture')) return 'Le pot de « Doré Paillettes Extra ». Vous y trempez un doigt. Votre doigt est maintenant plus élégant que vous.';
            gagner('peinture');
            return 'Sur un vieux journal : un pot de peinture « <b>Doré Paillettes Extra</b> », ouvert, encore frais. Un pinceau trempe dedans.\n\nLes mêmes paillettes que sur le tapis du salon. Quelqu’un a fait de la décoration... en pleine nuit... pendant une coupure de courant.';
          },
        },
        {
          id: 'patron', ico: '📐', nom: 'Le patron de tricot',
          act: () => {
            if (a('patron')) return 'Le patron du « Petit pull pour trophée ». Vous vous surprenez à trouver ça mignon. Concentrez-vous.';
            gagner('patron');
            return 'Épinglé à une poutre, un patron de tricot : « <b>Petit pull pour trophée – taille S – laine rose fluo</b> ».\n\nAvec un dessin : une moustache dorée portant un pull à col roulé.\n\nC’est absurde. C’est adorable. C’est un indice.';
          },
        },
        {
          id: 'lampe', ico: '🔦', nom: 'La lampe de poche',
          act: () => {
            if (a('torche')) return 'La lampe de poche. Vous l’allumez sous votre menton et faites « Bouh ». Personne ne vous voit. C’est mieux comme ça.';
            gagner('torche');
            return 'Par terre, une lampe de poche. Sur le manche, une étiquette : « <b>Tiroir cuisine – NE PAS EMPRUNTER – Ginette</b> ».\n\nElle est encore tiède. Quelqu’un l’a utilisée il y a peu. Pendant une coupure de courant, par exemple.';
          },
        },
        {
          id: 'note', ico: '📝', nom: 'Le petit mot',
          act: () => {
            if (a('note')) return 'Vous relisez la note. « Personne ne fouille le panier d’une mamie. » Personne... sauf un détective avec un mandat.';
            gagner('note');
            return 'Sous le pot de peinture, un papier taché de doré. Une écriture ronde et tremblante :\n\n« <i>Peinture sèche → remettre dans le panier, sous la pelote. Personne ne fouille le panier d’une mamie.</i> »\n\nSigné : <b>— O.</b>\n\nVotre moustache intérieure frémit.';
          },
        },
        {
          id: 'malle', ico: '🧳', nom: 'La vieille malle',
          act: () => auHasard([
            'Une malle pleine de photos. Janic bébé, déjà avec une moustache ? Non : c’était de la mousse au chocolat.',
            'Un costume de Zorro taille enfant, un 45 tours de Claude François et un diplôme de « Meilleure Tricoteuse du Canton 1974 » au nom d’Odette.',
          ]),
        },
      ],
    },
  };

  /* =========================================================
     LES PERSONNAGES
     ========================================================= */
  const PERSOS = {
    /* ---------------- TONTON JANIC ---------------- */
    janic: {
      nom: 'Tonton Janic', ico: '🧔', role: 'Le client · 60 ans, dont 40 de moustache',
      salut: () => '« Ah, Détective ! Ma moustache... enfin, ma MOUSTACHE D’OR... a disparu ! Je suis anéanti ! » (Il se mouche dans sa serviette. Puis dans la vôtre.)',
      sujets: [
        { id: 'recit', q: 'Racontez-moi tout, depuis le début.', r: () => `« À 22h00 pile — PAF ! — coupure de courant. Dix minutes dans le noir complet. Quand la lumière est revenue... la vitrine était VIDE ! »

« Ma Moustache d’Or ! Championne départementale 1997 ! Vous savez combien il y avait de candidats, cette année-là ? QUATRE ! Mais c’étaient des costauds. »` },
        { id: 'invites', q: 'Qui était là ce soir ?', r: () => `« Il y avait ma Ginette, qui cuisine pour quarante même quand on est six. Mon neveu Kevin, qui filme tout, même ses céréales. Ma mère, Mamie Odette, 92 ans, sourde comme un pot — enfin, ça dépend des jours. Mon voisin Poupard, mon ennemi juré, que j’invite chaque année pour qu’il admire mon trophée. Et Pistache, mon basset. »

« Personne n’a quitté la maison. Le voleur est PARMI NOUS ! » (Il regarde Pistache. Pistache regarde le gâteau.)` },
        { id: 'valeur', q: 'Le trophée a-t-il de la valeur ?', r: () => '« Une valeur INESTIMABLE ! »\n\n« ... Bon. Sur Leboncoin, un modèle similaire part à douze euros. Mais en valeur sentimentale, au moins treize. »' },
        { id: 'ennemis', q: 'Avez-vous des ennemis ?', r: () => '« POUPARD ! Il ne m’a jamais pardonné 1997. Il raconte à tout le monde que ma moustache était « assistée par ordinateur ». En 1997 ! Je n’avais même pas d’ordinateur ! J’avais un Minitel ! »' },
        { id: 'trophee', q: 'Comment allait le trophée, ces temps-ci ?', r: () => '« Ah, il vieillissait un peu, le pauvre. Il devenait tout... verdâtre. Comme moi le lundi matin. Maman disait qu’il lui faudrait « un petit coup de jeune ». Je ne sais pas ce qu’elle voulait dire. »' },
        { id: 'tomates', q: 'M. Poupard vole vos tomates depuis trois ans.', si: () => a('tomates'), r: () => '« QUOI ?! C’est LUI ?! Depuis TROIS ANS ?! » Il devient violet, puis rouge, puis... tomate.\n\n« ... Bon. Ça explique la délicieuse sauce bolognaise qu’il m’offre à chaque Noël. Je ne sais pas si je dois être furieux ou flatté. »' },
        { id: 'salsa', q: 'Saviez-vous que Ginette prend des cours de salsa ?', si: () => a('lampe'), r: () => '« Ma Ginette ? De la SALSA ? En cachette ? » Il réfléchit longuement.\n\n« Ça explique pourquoi elle passe l’aspirateur en roulant des hanches. Et pourquoi elle appelle le chat « Ricardo ». »' },
        { id: 'grenier', q: 'Qui monte au grenier, d’habitude ?', si: () => f('grenierOuvert'), r: () => '« Le grenier ? Personne ! Il y a des araignées grosses comme des pamplemousses. Sauf Maman. Elle dit qu’elle y « range ses souvenirs ». À 92 ans, elle monte cet escalier plus vite que moi. Pourquoi ? »' },
      ],
    },

    /* ---------------- MAMIE ODETTE ---------------- */
    mamie: {
      nom: 'Mamie Odette', ico: '👵', role: '92 ans · Sourde quand ça l’arrange',
      salut: () => f('enigme_devinette')
        ? '(Mamie Odette ouvre un œil.) « Encore vous ? Faites vite, jeunesse. Mon feuilleton commence bientôt. »'
        : '(Mamie Odette ouvre un œil, puis le referme.) « Hmm ? »',
      sujets: [
        { id: 'enigme', q: 'Bonsoir, Mamie Odette. Je peux vous poser quelques questions ?', si: () => !f('enigme_devinette'), speciale: true, r: () => { enigmeDevinette(); return null; } },
        { id: 'alibi', q: 'Où étiez-vous pendant la coupure ?', si: () => f('enigme_devinette'), r: () => '« Dans mon fauteuil. Je dormais. Je dors toujours de 21h à 22h, de 22h à 23h, et de 23h à 7h. Entre deux, je tricote et je juge les gens. »' },
        { id: 'vu', q: 'Avez-vous vu quelque chose de suspect ?', si: () => f('enigme_devinette'), r: () => '« Hein ? Une CHOSE ? Un TROMBONE ? Non, je n’ai pas vu de trombone. Ni de trompette. Il n’y a pas d’orchestre, ici. »\n\n(Elle reprend son tricot. Ses aiguilles cliquettent un peu trop vite.)' },
        { id: 'tricot', q: 'Que tricotez-vous ?', si: () => f('enigme_devinette'), r: () => '« Un petit pull. Pour quelqu’un de petit... et de brillant. »\n\nElle cache son ouvrage sous sa pelote. « Occupez-vous de vos oignons, jeunesse. Moi, je m’occupe de mes mailles. »' },
        { id: 'laine', q: 'Ce fil rose fluo sur le disjoncteur, c’est votre laine ?', si: () => f('enigme_devinette') && a('laine'), r: () => '« Le rose fluo ? C’est très tendance chez les jeunes. Demandez à Kevin. »\n\nVous regardez Kevin : il est en noir des pieds à la tête. Vous regardez la pelote rose fluo sur les genoux de Mamie. Elle la cache sous un coussin.' },
        { id: 'video', q: 'Une silhouette en robe de chambre à fleurs est passée à 22h03...', si: () => f('enigme_devinette') && a('video'), r: () => '« Une robe de chambre à fleurs ? Des pantoufles à pompons ? Mon lapin, TOUTES les dames de plus de 80 ans s’habillent comme ça. C’est un uniforme. Vous allez arrêter toute la maison de retraite ? »' },
        { id: 'torche', q: 'Quelqu’un est monté au grenier avec une lampe de poche...', si: () => f('enigme_devinette') && (a('tomates') || a('torche')), r: () => '« Une lampe de poche ? Au grenier ? À mon âge ? Avec mes genoux ? »\n\nElle croise les jambes d’un geste remarquablement souple. « Je suis une pauvre vieille dame fragile. »\n\nElle casse une noix à mains nues.' },
        { id: 'note', q: 'J’ai trouvé une note signée « O. » au grenier.', si: () => f('enigme_devinette') && a('note'), r: () => { lever('mamieCoincee'); return 'Mamie Odette tricote soudain très, très vite. « « O. », ça peut être n’importe qui. Oscar. Olaf. Obélix. »\n\n« Si vous avez des preuves, accusez-moi. Sinon, passez-moi la télécommande. »\n\n(Vous sentez que le moment de vérité approche. ⚖️)'; } },
      ],
    },

    /* ---------------- TATA GINETTE ---------------- */
    ginette: {
      nom: 'Tata Ginette', ico: '👩‍🍳', role: 'Épouse de Janic · Cuisine pour 40, même à 6',
      salut: () => '« Vous avez faim ? Vous avez faim. Je le vois. Asseyez-vous. Non : posez vos questions d’abord, et APRÈS vous mangez. »',
      sujets: [
        { id: 'alibi', q: 'Où étiez-vous à 22h, pendant la coupure ?', r: () => { lever('ginetteMent'); return '« Moi ? Euh... aux toilettes. Pendant... trente minutes. Oui. Ce sont des toilettes très... intéressantes. Il y a des magazines. »\n\n(Elle tortille son tablier. Elle ment aussi mal qu’elle cuit les quiches.)'; } },
        { id: 'trophee', q: 'Que pensez-vous de la Moustache d’Or ?', r: () => { lever('ginetteMobile'); return '« Un NID À POUSSIÈRE ! Vingt-neuf ans que je l’époussette ! Si quelqu’un l’a volé, je lui fais un gâteau. Un gros. Avec de la crème. »\n\n(Vous notez : mobile possible. Et gâteau possible.)'; } },
        { id: 'manger', q: 'Ça sent drôlement bon, ici...', r: () => '« ENFIN quelqu’un qui comprend ! Tenez : blanquette, quiche, gratin, re-blanquette. »\n\n« Mais pas la mousse au chocolat. La mousse, c’est pour demain. Ou pour jamais. Ça dépend de qui la touche. »' },
        { id: 'salsa', q: 'Club Caliente, cours de salsa, samedi 22h... ça vous parle ?', si: () => a('salsa'), r: () => {
          gagner('lampe');
          return `Ginette blêmit, puis vous tire dans un coin. « CHUT ! Janic ne doit pas savoir ! »

« Oui, j’étais dans le cellier, sur ma tablette, en plein cours de salsa niveau Volcan. Quand le courant a coupé, j’ai voulu prendre la lampe de poche du tiroir... <b>elle avait disparu !</b> Quelqu’un l’avait prise juste avant ! »

« Alors j’ai dansé dans le noir. C’était magnifique. Ricardo, mon prof, peut confirmer. »

(Vous notez : alibi solide. Et Ricardo.)`;
        } },
        { id: 'laine', q: 'Qui tricote de la laine rose fluo, ici ?', si: () => a('laine'), r: () => '« Mamie Odette, pardi. Elle tricote tout ce qui bouge. L’an dernier : un pull pour Pistache, un pour le chat des voisins, et un pour le voisin. Poupard l’a porté à la messe. Il était très beau. »' },
        { id: 'grenier', q: 'Qui monte au grenier ?', si: () => a('tomates') || a('scrabble'), r: () => '« Personne ! Sauf Mamie. Elle dit qu’elle y « range ses souvenirs ». Depuis trois semaines, elle y monte tous les jours. Ses souvenirs doivent être très en désordre. »' },
      ],
    },

    /* ---------------- COUSIN KEVIN ---------------- */
    kevin: {
      nom: 'Cousin Kevin', ico: '🤳', role: '17 ans · Influenceur (312 abonnés, dont sa mère)',
      salut: () => '« Yo chef ! Attends, je te filme, ça va faire des vues. « UN VRAI DÉTECTIVE CHEZ MOI (PAS CLICKBAIT) ». Non, reste naturel. Plus naturel que ça. »',
      sujets: [
        { id: 'alibi', q: 'Où étais-tu à 22h ?', r: () => '« Ici, chef. Je tournais un tuto : « Danse dans le noir ». Concept de ouf. Quand le courant a coupé, j’ai cru que c’était un signe de l’univers. J’ai filmé à la lampe du téléphone. »' },
        { id: 'trophee', q: 'Que penses-tu du trophée de ton oncle ?', r: () => { lever('kevinTrophee'); return '« Le truc doré en forme de moustache ? Franchement, je voulais faire un unboxing avec. Genre « J’OUVRE LE TROPHÉE DE MON ONCLE (ÉMOTION) ». Mais j’y ai pas touché, je le jure sur mes abonnés. Les 312. »'; } },
        { id: 'tel', q: 'Je peux voir les vidéos de ton téléphone ?', r: () => '« Ok, mais faut trouver le code. L’indice est sur le post-it. Moi j’ai mis trois jours à le retenir, alors que c’est moi qui l’ai choisi. »\n\nLe téléphone est posé sur un trépied, au fond du garage.' },
        { id: 'message', q: '« On se voit à minuit derrière la haie. J. » — ça te dit quelque chose ?', si: () => a('message'), r: () => {
          gagner('jessica');
          return `« Ah. Euh. Ça. » Kevin rougit jusqu’aux oreilles.

« C’est Jessica. La nièce de M. Poupard. On se voit en cachette, parce que nos familles sont en guerre depuis 1997. C’est comme Roméo et Juliette, mais avec des moustaches. »

« Le code César, c’est elle qui l’a inventé. Elle est trop forte. Dis rien à personne, stp. »`;
        } },
        { id: 'video', q: 'Qui est la silhouette au fond de ta vidéo ?', si: () => a('video'), r: () => '« Attends, zoome... Robe de chambre à fleurs, pantoufles à pompons, un truc qui brille sous le bras... »\n\nIl pâlit. « Chef. Y a qu’une personne qui s’habille comme ça ici. Et c’est pas Pistache. »' },
        { id: 'wifi', q: 'Au fait, le Wi-Fi est revenu.', si: () => f('enigme_disjoncteur'), r: () => '« T’es une LÉGENDE. Je vais te mentionner dans ma prochaine vidéo. 312 personnes vont savoir qui tu es. 313 avec Mamie, mais elle a pas Internet. »' },
      ],
    },

    /* ---------------- M. POUPARD ---------------- */
    poupard: {
      nom: 'M. Raymond Poupard', ico: '👨‍🦳', role: 'Le voisin · Éternel 2ᵉ du concours de 1997',
      salut: () => '(M. Poupard sursaute et cache quelque chose de rouge derrière son dos.) « Bonsoir ! Belle soirée ! Rien à signaler ! Rien du tout ! »',
      sujets: [
        { id: 'presence', q: 'Que faites-vous ici, M. Poupard ?', r: () => '« Je suis invité ! Janic m’invite chaque année pour me narguer avec son trophée. Et chaque année, je viens. Pour la quiche. »\n\nIl frissonne. « Non. Personne ne vient pour la quiche. »' },
        { id: 'alibi', q: 'Où étiez-vous pendant la coupure ?', r: () => { lever('poupardMent'); return '« Au salon ! Toute la soirée ! Je n’ai pas mis UN ORTEIL dans ce jardin ! »\n\nIl vous dit ça debout au milieu du jardin, en chaussettes. Ses chaussettes sont pleines de boue.'; } },
        { id: 'concours', q: 'Parlez-moi du concours de 1997.', r: () => '« TRUQUÉ ! Un des juges était le cousin de Janic. L’autre était son chien. Le troisième, c’était moi, et j’ai voté pour moi, donc ça ne compte pas. »\n\nIl serre les poings. « Vingt-neuf ans que j’y pense. Tous les jours. Même à Noël. Surtout à Noël. »' },
        { id: 'gant', q: 'Votre gant « R.P. » était dans le trou de Pistache.', si: () => !!S.vus.trou, r: () => '« Ce chien me vole un gant par semaine ! Il ne me reste que des gants gauches ! Je jardine comme un manchot ! »' },
        { id: 'bottes', q: 'Vos bottes correspondent aux empreintes du jardin.', si: () => a('bottes'), r: () => {
          gagner('tomates');
          return `M. Poupard s’effondre sur un nain de jardin. « Bon, BON, d’accord ! Pendant la coupure, je suis sorti... cueillir quelques tomates. Douze. Seulement douze ! Ses tomates sont les meilleures du canton, c’est INJUSTE ! »

« Mais je n’ai PAS touché à ce trophée ridicule ! D’ailleurs... pendant la coupure, j’ai vu quelque chose. <b>Une petite lumière qui montait l’escalier, puis qui s’est allumée au grenier.</b> Une lampe de poche ! Quelqu’un était là-haut ! »`;
        } },
        { id: 'jessica', q: 'Votre nièce Jessica et Kevin se fréquentent.', si: () => a('jessica'), r: () => '« QUOI ?! Ma Jessica ?! Avec le neveu de JANIC ?! »\n\nIl réfléchit. « ... Il a une moustache, au moins ? Non ? Alors c’est non. Revenez dans dix ans. »' },
      ],
    },

    /* ---------------- PISTACHE ---------------- */
    pistache: {
      nom: 'Pistache', ico: '🐶', role: 'Basset, 7 ans · Témoin clé ? Suspect n°1 du gâteau.',
      salut: () => '(Pistache vous regarde avec ses yeux de basset, qui sont les yeux les plus tristes de l’univers, même quand il est heureux.)',
      sujets: [
        { id: 'ou', q: 'Où étais-tu à 22h, Pistache ?', r: () => { Son.ouaf(); return '« Ouaf. »\n\n(Il se lèche une patte. Vous notez dans votre carnet : « refuse de coopérer ».)'; } },
        { id: 'coupable', q: 'Qui est le coupable ?', r: () => { Son.ouaf(); return '« Ouaf ouaf. Ouaf. »\n\n(Vous ne parlez pas couramment le basset. Vous regrettez de ne pas avoir pris l’option à l’école de détective.)'; } },
        { id: 'gratouille', q: 'Gratouiller derrière les oreilles.', r: () => 'Pistache s’effondre de bonheur sur le dos. Une patte arrière gigote toute seule. C’est le témoin le plus heureux du monde. Et le moins utile.' },
        { id: 'biscuit', q: '🦴 Donner le biscuit Croc’Royal', speciale: true, si: () => dansSac('biscuit') && !a('pistache'), r: () => {
          Son.ouaf();
          S.sac = S.sac.filter(o => o !== 'biscuit');
          lever('pistacheSalon');
          gagner('pistache');
          return `Pistache engloutit le biscuit en 0,3 seconde. Puis, comme possédé par l’esprit de Sherlock Holmes, il trottine jusqu’au salon... et s’assoit pile devant le <b>panier à tricot de Mamie Odette</b>, en remuant la queue comme un métronome.

Il renifle. Il éternue. Un petit nuage de <b>paillettes dorées</b> s’envole de sa truffe.

Mamie Odette : « Va-t’en, sale bête. » Pistache ne bouge pas. Pistache sait.`;
        } },
      ],
    },
  };

  const SUSPECTS = ['ginette', 'kevin', 'poupard', 'mamie', 'pistache', 'janic'];
  function notesSuspect(id) {
    const n = [];
    switch (id) {
      case 'ginette':
        if (f('ginetteMobile')) n.push('Déteste le trophée (« nid à poussière »). Mobile ?');
        if (f('ginetteMent')) n.push('Prétend avoir passé 30 minutes aux toilettes. Hmm.');
        if (a('lampe')) n.push('✅ Alibi : cours de salsa en visio dans le cellier.');
        break;
      case 'kevin':
        if (f('kevinTrophee')) n.push('Voulait faire un « unboxing » du trophée.');
        if (a('message') && !a('jessica')) n.push('Le message codé « J. » le concerne-t-il ?');
        if (a('jessica')) n.push('✅ Le message codé : un rendez-vous avec Jessica.');
        if (a('video')) n.push('✅ Alibi : filmait une danse au garage à 22h03.');
        break;
      case 'poupard':
        if (a('photo1997')) n.push('Rival de 1997. Rancune tenace.');
        if (f('poupardMent')) n.push('Jure ne pas être sorti au jardin. En chaussettes boueuses.');
        if (a('bottes')) n.push('Ses bottes correspondent aux empreintes du jardin !');
        if (a('tomates')) n.push('✅ Voleur de tomates, pas de trophée. A vu une lumière monter au grenier.');
        break;
      case 'mamie':
        if (f('enigme_devinette')) n.push('Parle par énigmes. Entend très bien quand ça l’arrange.');
        if (a('laine')) n.push('Tricote de la laine rose fluo.');
        if (a('video')) n.push('Porte une robe de chambre à fleurs et des pantoufles à pompons.');
        if (a('pistache')) n.push('Pistache n’arrête pas de renifler son panier à tricot.');
        if (a('note')) n.push('⚠️ Une note signée « O. » au grenier...');
        break;
      case 'pistache':
        n.push('A mangé un coin du gâteau. Coupable de ça, au moins.');
        if (a('pistache')) n.push('Le biscuit l’a mené tout droit au panier de Mamie.');
        break;
      case 'janic':
        n.push('Le client. Probablement pas le coupable. Probablement.');
        if (S.sujets['janic.trophee']) n.push('Le trophée devenait « verdâtre ». Mamie voulait lui donner « un coup de jeune ».');
        break;
    }
    return n.length ? n : ['Rien de notable pour l’instant.'];
  }

  /* =========================================================
     AFFICHAGE
     ========================================================= */
  function taper(cible, html, fini) {
    if (!cible) return;
    clearInterval(cible._t);
    html = String(html).replace(/\n/g, '<br>');
    const morceaux = html.match(/<[^>]+>|&[a-z#0-9]+;|[\s\S]/gi) || [];
    let i = 0;
    let sortie = '';
    cible.classList.add('typing');
    const terminer = () => {
      clearInterval(cible._t);
      cible._t = null;
      cible.innerHTML = html;
      cible.classList.remove('typing');
      cible.onclick = null;
      if (fini) fini();
    };
    cible.onclick = terminer;
    cible._t = setInterval(() => {
      if (!cible.isConnected) { clearInterval(cible._t); return; }
      for (let k = 0; k < 2 && i < morceaux.length; k++) {
        const m = morceaux[i++];
        sortie += m;
        if (m.length === 1 && m !== ' ' && i % 3 === 0) Son.touche();
      }
      cible.innerHTML = sortie;
      if (i >= morceaux.length) terminer();
    }, 18);
  }

  function narrer(html) {
    if (!html) return;
    const n = $('#narration-texte');
    taper(n, html);
    n.parentElement.scrollTop = 0;
  }

  function toast(html, type = '') {
    const t = el('div', 'toast ' + type, html);
    const box = $('#toasts');
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 3400);
    setTimeout(() => t.remove(), 4000);
  }

  function bumpStat(sel) {
    const b = $(sel);
    if (!b) return;
    b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  }

  function heure() {
    const total = 23 * 60 + S.minutes;
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function majUI() {
    $('#horloge').textContent = heure();
    $('#flair').textContent = S.flair;
    $('#nb-indices').textContent = S.indices.length;
    $('#narr-nom').textContent = D();
    $('#btn-son').textContent = Son.muet ? '🔇' : '🔊';
    rendreLieux();
    rendreScene();
    if (S.minutes >= 60 && !f('minuit')) {
      lever('minuit');
      toast(a('jessica')
        ? '🕛 Minuit sonne. Derrière la haie, Kevin et Jessica se tiennent la main. M. Poupard, lui, tient une tomate.'
        : '🕛 Minuit sonne. Quelque part derrière la haie, quelqu’un a rendez-vous...', 'or');
    }
    sauver();
  }

  function rendreLieux() {
    const nav = $('#lieux');
    nav.innerHTML = '';
    ORDRE_LIEUX.forEach(id => {
      const L = LIEUX[id];
      const ferme = id === 'grenier' && !f('grenierOuvert');
      const b = el('button', 'lieu' + (S.lieu === id ? ' actif' : '') + (ferme ? ' ferme' : ''), `${ferme ? '🔒' : L.ico} ${L.nom}`);
      b.onclick = () => {
        if (ferme) {
          Son.rate();
          narrer('Le grenier est fermé par un cadenas. L’escalier qui y mène part de <b>l’entrée</b>.');
          return;
        }
        if (S.lieu !== id) allerA(id);
      };
      nav.appendChild(b);
    });
  }

  function aDesQuestions(pid) {
    return PERSOS[pid].sujets.some(s => (!s.si || s.si()) && !S.sujets[pid + '.' + s.id]);
  }

  function rendreScene() {
    const L = LIEUX[S.lieu];
    const sc = $('#scene');
    sc.innerHTML = `
      <div class="scene-tete">
        <div class="scene-ico">${L.ico}</div>
        <div><h2>${L.nom}</h2><p class="scene-desc">${L.desc}</p></div>
      </div>
      <h3>🔎 À examiner</h3>
      <div class="points"></div>
      <h3>🗣️ Personnes présentes</h3>
      <div class="persos"></div>`;
    const pts = $('.points', sc);
    L.points.forEach(p => {
      const vu = !!S.vus[p.id];
      const b = el('button', 'point' + (vu ? ' vu' : ' neuf'), `<span class="emo">${p.ico}</span>${p.nom}`);
      b.onclick = () => examiner(p);
      pts.appendChild(b);
    });
    const ps = $('.persos', sc);
    const liste = L.persos();
    if (!liste.length) ps.outerHTML = '<p class="vide">Personne. Juste vous, et un léger courant d’air.</p>';
    liste.forEach(pid => {
      const P = PERSOS[pid];
      const b = el('button', 'perso', `<span class="emo">${P.ico}</span><span>${P.nom}<small>${P.role}</small></span>`);
      if (aDesQuestions(pid)) b.appendChild(el('span', 'bulle-new', '!'));
      b.onclick = () => { Son.clic(); ouvrirDialogue(pid); };
      ps.appendChild(b);
    });
  }

  function allerA(id) {
    Son.clic();
    S.lieu = id;
    S.minutes += 1;
    const L = LIEUX[id];
    if (id === 'grenier' && !f('grenierVisite')) lever('grenierVisite');
    majUI();
    narrer(L.arrivee);
    if (window.innerWidth <= 860) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function examiner(p) {
    Son.clic();
    S.minutes += 2;
    S.vus[p.id] = (S.vus[p.id] || 0) + 1;
    const txt = p.act();
    if (txt) narrer(txt);
    majUI();
  }

  /* =========================================================
     FENÊTRE MODALE
     ========================================================= */
  let modalFermable = true;
  let modalApresFermeture = null;
  function ouvrirModal(contenu, { large = false, fermable = true, apres = null } = {}) {
    const m = $('#modal');
    const c = $('#modal-contenu');
    $$('.tape', c).forEach(t => clearInterval(t._t));
    c.innerHTML = '';
    if (typeof contenu === 'string') c.innerHTML = contenu; else c.appendChild(contenu);
    $('.modal-boite', m).classList.toggle('large', large);
    $('.modal-fermer', m).hidden = !fermable;
    modalFermable = fermable;
    modalApresFermeture = apres;
    m.hidden = false;
    const boite = $('.modal-boite', m);
    boite.style.animation = 'none'; void boite.offsetWidth; boite.style.animation = '';
    boite.scrollTop = 0;
  }
  function fermerModal() {
    const m = $('#modal');
    if (m.hidden) return;
    $$('.tape', m).forEach(t => clearInterval(t._t));
    m.hidden = true;
    $('#modal-contenu').innerHTML = '';
    const apres = modalApresFermeture;
    modalApresFermeture = null;
    majUI();
    if (apres) apres();
  }
  function secouer(n) {
    n.classList.remove('secoue'); void n.offsetWidth; n.classList.add('secoue');
  }

  /* ---------- Dialogue ---------- */
  function ouvrirDialogue(pid, texte) {
    const P = PERSOS[pid];
    const c = el('div', 'dialogue');
    c.innerHTML = `
      <div class="dial-tete">
        <div class="portrait">${P.ico}</div>
        <div><h2>${P.nom}</h2><p class="role">${P.role}</p></div>
      </div>
      <div class="bulle tape" id="dial-texte"></div>
      <div class="questions" id="dial-questions"></div>`;
    ouvrirModal(c);
    taper($('#dial-texte'), texte || P.salut());
    majQuestions(pid);
  }
  function majQuestions(pid) {
    const box = $('#dial-questions');
    if (!box) return;
    box.innerHTML = '';
    PERSOS[pid].sujets.filter(s => !s.si || s.si()).forEach(s => {
      const k = pid + '.' + s.id;
      const pose = !!S.sujets[k];
      const b = el('button', 'question' + (pose ? ' posee' : '') + (s.speciale ? ' speciale' : ''), (pose ? '✓ ' : '❓ ') + s.q);
      b.onclick = () => {
        Son.clic();
        S.sujets[k] = true;
        S.minutes += 2;
        const r = s.r();
        if (r) taper($('#dial-texte'), r);
        majQuestions(pid);
        $('#horloge').textContent = heure();
        $('#flair').textContent = S.flair;
        $('#nb-indices').textContent = S.indices.length;
        sauver();
      };
      box.appendChild(b);
    });
    box.appendChild(el('button', 'btn-lien', '← Terminer la conversation')).onclick = fermerModal;
  }

  /* =========================================================
     ÉNIGMES
     ========================================================= */
  function boutonCoupDePouce(conteneur, indices) {
    let n = 0;
    const b = el('button', 'btn-lien', '💡 Coup de pouce (−5 flair)');
    const p = el('p', 'consigne');
    b.onclick = () => {
      if (n >= indices.length) return;
      S.flair -= 5;
      S.aides++;
      bumpStat('#flair');
      $('#flair').textContent = S.flair;
      p.innerHTML += (n ? '<br>' : '') + '💡 ' + indices[n++];
      if (n >= indices.length) b.disabled = true;
      sauver();
    };
    conteneur.appendChild(p);
    conteneur.appendChild(b);
  }

  /* ---------- 1. La devinette de Mamie ---------- */
  function enigmeDevinette() {
    const c = el('div', 'enigme');
    c.innerHTML = `
      <h2>👵 L’énigme de Mamie Odette</h2>
      <p class="consigne">« Des questions ? À mon âge, on ne répond qu’aux gens qui ont de la jugeote. » Mamie Odette pose son tricot, plisse les yeux et récite d’une voix de sphinx :</p>
      <blockquote class="citation">« Plus j’ai de gardiens,<br>moins je suis gardé.<br>Qui suis-je ? »</blockquote>
      <form class="ligne-reponse">
        <input id="rep" autocomplete="off" placeholder="Votre réponse..." aria-label="Votre réponse">
        <button class="btn btn-rouge">Répondre</button>
      </form>
      <p class="retour" id="retour"></p>`;
    boutonCoupDePouce(c, [
      'Ça se chuchote à l’oreille.',
      'Si vous le répétez à tout le monde, ce n’en est plus un.',
      'Ça commence par S... et ça rime avec « regret ».',
    ]);
    ouvrirModal(c);
    const inp = $('#rep', c);
    const retour = $('#retour', c);
    setTimeout(() => inp.focus(), 50);
    const rates = [
      '« Non. » (Elle reprend son tricot.)',
      '« Raté. Mon perroquet avait trouvé plus vite. Et il était empaillé. »',
      '« Toujours pas. Votre diplôme de détective, il vient d’une pochette-surprise ? »',
      '« Non, non et non. Réfléchissez avec la tête, pas avec l’imperméable. »',
    ];
    let essais = 0;
    $('form', c).onsubmit = e => {
      e.preventDefault();
      const r = norm(inp.value);
      if (!r) return;
      if (/\bsecrets?\b/.test(r)) {
        reussite('enigme_devinette');
        S.sujets['mamie.enigme'] = true;
        ouvrirDialogue('mamie', 'Mamie Odette ouvre les deux yeux. « <b>Un secret.</b> Bien. Vous êtes moins bête que votre imperméable. »\n\n« Posez vos questions, jeunesse. Mais vite : mon feuilleton commence dans vingt minutes. »');
        return;
      }
      Son.rate();
      secouer(c);
      if (r.includes('trombone')) retour.textContent = '« Un trombone ?! Vous avez les oreilles encore plus bouchées que moi ! »';
      else if (r.includes('tresor') || r.includes('prison')) retour.textContent = '« Pas mal, mais non. Un trésor bien gardé reste un trésor. Moi, je parle de quelque chose qui s’évapore quand on le partage. »';
      else retour.textContent = rates[essais++ % rates.length];
      inp.select();
    };
  }

  /* ---------- 2. Le message codé (César) ---------- */
  function enigmeCesar() {
    const CLAIR = 'ON SE VOIT A MINUIT DERRIERE LA HAIE. J.';
    const decale = (txt, n) => txt.replace(/[A-Z]/g, ch => String.fromCharCode((ch.charCodeAt(0) - 65 + n + 26) % 26 + 65));
    const CODE = decale(CLAIR, 3);
    const c = el('div', 'enigme');
    c.innerHTML = `
      <h2>✉️ Le papier de la poubelle</h2>
      <p class="consigne">Un papier froissé, taché de sauce blanquette. Des lettres qui ne veulent rien dire... En bas, griffonné au stylo à paillettes : <i>« Veni, vidi, vici. » — César</i></p>
      <div class="code-papier">${CODE}</div>
      <div class="roue">
        <button class="btn" id="moins" aria-label="Décaler à gauche">◀</button>
        <div class="roue-val">Décalage<br><b id="val">0</b></div>
        <button class="btn" id="plus" aria-label="Décaler à droite">▶</button>
      </div>
      <input type="range" min="0" max="25" value="0" id="curseur" aria-label="Décalage">
      <div class="alphabet" id="alphabet"></div>
      <div class="code-clair" id="clair"></div>
      <p class="retour" id="retour"></p>
      <button class="btn btn-rouge" id="valider">🔍 Lire ce message à voix haute</button>`;
    boutonCoupDePouce(c, [
      'Jules César décalait chaque lettre de quelques crans dans l’alphabet.',
      'Combien de mots dans « Veni, vidi, vici » ?',
      'Décalage de 3. Vous pouvez remercier Jules.',
    ]);
    ouvrirModal(c);
    let n = 0;
    const maj = () => {
      $('#val', c).textContent = n;
      $('#curseur', c).value = n;
      $('#clair', c).textContent = decale(CODE, -n);
      $('#alphabet', c).textContent = `Chaque lettre recule de ${n} : D → ${decale('D', -n)}, H → ${decale('H', -n)}, R → ${decale('R', -n)}`;
    };
    $('#moins', c).onclick = () => { n = (n + 25) % 26; Son.clic(); maj(); };
    $('#plus', c).onclick = () => { n = (n + 1) % 26; Son.clic(); maj(); };
    $('#curseur', c).oninput = e => { n = +e.target.value; Son.touche(); maj(); };
    $('#valider', c).onclick = () => {
      if (n === 3) {
        reussite('enigme_cesar');
        gagner('message');
        fermerModal();
        narrer(`Vous lisez à voix haute : « <b>ON SE VOIT À MINUIT DERRIÈRE LA HAIE. J.</b> »

Un rendez-vous secret ! Signé « J. ». Qui, dans cette maison, a des rendez-vous à minuit derrière les haies ? Et qui utilise un code secret de l’Antiquité pour ça ?

Quelqu’un de jeune. Quelqu’un de romantique. Quelqu’un qui a trop regardé de films.`);
        return;
      }
      Son.rate();
      secouer(c);
      $('#retour', c).textContent = `Vous lisez : « ${decale(CODE, -n).slice(0, 18)}... » Pistache penche la tête. Ce n’est ni du français, ni du basset.`;
    };
    maj();
  }

  /* ---------- 3. Le tableau électrique (lights out) ---------- */
  function enigmeDisjoncteur() {
    const NOMS = ['Frigo', 'Guirlande « 60 ans »', 'Four (quiche)', 'Wi-Fi de Kevin', 'Salon', 'Aquarium (vide)', 'Cave', 'Jacuzzi (inexistant)', 'Grenier'];
    const basculer = (g, i) => {
      const l = Math.floor(i / 3), col = i % 3;
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dl, dc]) => {
        const ll = l + dl, cc = col + dc;
        if (ll >= 0 && ll < 3 && cc >= 0 && cc < 3) g[ll * 3 + cc] = !g[ll * 3 + cc];
      });
    };
    let grille;
    do {
      grille = Array(9).fill(true);
      melange([...Array(9).keys()]).slice(0, 3).forEach(i => basculer(grille, i));
    } while (grille.every(Boolean));
    const depart = [...grille];
    let coups = 0;

    const c = el('div', 'enigme');
    c.innerHTML = `
      <h2>⚡ Le tableau électrique</h2>
      <p class="consigne">Depuis la coupure, le tableau fait n’importe quoi. Remettez <b>tous les fusibles en marche</b> (verts).<br><small>Attention : ce tableau a été installé par le beau-frère de Janic. Chaque levier fait aussi basculer ses voisins directs (haut, bas, gauche, droite).</small></p>
      <div class="tableau" id="tableau"></div>
      <p class="compteur" id="compteur">Manipulations : 0</p>
      <p class="retour" id="retour"></p>
      <button class="btn-lien" id="reset">↺ Remettre comme au début</button>`;
    boutonCoupDePouce(c, [
      'Commencez par la rangée du haut, puis réglez chaque rangée en appuyant sur le levier juste en dessous des fusibles éteints.',
      'Il suffit de 3 manipulations bien choisies (ou moins). Chaque levier appuyé deux fois revient à ne rien faire.',
    ]);
    ouvrirModal(c);
    const tab = $('#tableau', c);
    const rendre = () => {
      tab.innerHTML = '';
      grille.forEach((on, i) => {
        const b = el('button', 'fusible' + (on ? ' on' : ''), `<span class="levier"></span>${NOMS[i]}`);
        b.setAttribute('aria-label', `${NOMS[i]} : ${on ? 'allumé' : 'éteint'}`);
        b.onclick = () => {
          basculer(grille, i);
          coups++;
          Son.bip(on ? 300 : 500, 0.05, 'square', 0.04);
          $('#compteur', c).textContent = `Manipulations : ${coups}`;
          rendre();
          if (grille.every(Boolean)) gagne();
        };
        tab.appendChild(b);
      });
    };
    const gagne = () => {
      $$('.fusible', tab).forEach(b => { b.disabled = true; });
      reussite('enigme_disjoncteur');
      gagner('coupure');
      gagner('laine');
      setTimeout(() => {
        fermerModal();
        narrer(`<b>Clac !</b> Tout se rallume. Le frigo ronronne, la guirlande « 60 ans » clignote, et du fond du garage monte un cri : « LE WI-FI EST REVENUUU ! » (Kevin pleure de joie.)

Mais en refermant le tableau, vous remarquez deux choses :

1. Le <b>disjoncteur général</b> n’a pas sauté tout seul : il a été <b>abaissé à la main</b>. La coupure de 22h00 était volontaire.

2. Accroché au levier, un <b>fil de laine rose fluo</b>.

Qui, dans cette maison, tricote du rose fluo ?`);
      }, 700);
    };
    $('#reset', c).onclick = () => { grille = [...depart]; coups = 0; $('#compteur', c).textContent = 'Manipulations : 0'; rendre(); };
    rendre();
  }

  /* ---------- 4. Le code du téléphone ---------- */
  function enigmeCode() {
    const BON = '2057';
    const c = el('div', 'enigme');
    c.innerHTML = `
      <h2>📱 Le téléphone de Kevin</h2>
      <p class="consigne">Verrouillé. Un post-it est collé sur la coque :</p>
      <div class="postit">Code = l’année de la Moustache d’Or + l’âge de Tonton.<br>(C’est tout ce dont il parle, impossible d’oublier.)</div>
      <div class="telephone">
        <div class="code-aff" id="aff">____</div>
        <div class="clavier" id="clavier"></div>
      </div>
      <p class="retour" id="retour"></p>`;
    boutonCoupDePouce(c, [
      'L’année est sur la photo de la cheminée, au salon. L’âge est sur le gâteau.',
      '1997 + 60 = ... sortez vos doigts, il en faudra beaucoup.',
    ]);
    ouvrirModal(c);
    let saisie = '';
    const aff = $('#aff', c);
    const retour = $('#retour', c);
    const rates = [
      'Code incorrect. Kevin, sans lever les yeux : « Mdr non. »',
      'Faux. Le téléphone vibre d’un air méprisant.',
      'Raté. Plus que 9 997 combinaisons. Courage.',
      'Non. Kevin : « Sérieux, chef ? C’est juste une addition. »',
    ];
    let essais = 0;
    const maj = () => { aff.textContent = saisie.padEnd(4, '_'); };
    const valider = () => {
      if (saisie.length < 4) { Son.rate(); retour.textContent = 'Il faut 4 chiffres. Même Pistache le sait.'; return; }
      if (saisie === BON) {
        reussite('enigme_code');
        gagner('video');
        montrerVideo();
        return;
      }
      Son.rate();
      secouer($('.telephone', c));
      retour.textContent = rates[essais++ % rates.length];
      saisie = '';
      maj();
    };
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].forEach(t => {
      const b = el('button', 'touche' + (t === 'OK' ? ' ok' : '') + (t === '⌫' ? ' efface' : ''), t);
      b.onclick = () => {
        if (t === 'OK') return valider();
        Son.bip(700 + Math.random() * 200, 0.05, 'sine', 0.05);
        if (t === '⌫') saisie = saisie.slice(0, -1);
        else if (saisie.length < 4) saisie += t;
        retour.textContent = '';
        maj();
      };
      $('#clavier', c).appendChild(b);
    });
    maj();
  }

  function montrerVideo() {
    const c = el('div', 'enigme');
    c.innerHTML = `
      <h2>🎬 « TUTO DANSE DANS LE NOIR (CONCEPT DE OUF) »</h2>
      <p class="consigne">Le téléphone se déverrouille. Dernière vidéo, filmée ce soir à la lampe du téléphone. 3 vues (dont 2 de Kevin).</p>
      <div class="video">
        <div class="video-lumiere"></div>
        <div class="rec">● REC</div>
        <div class="heure">22:03</div>
        <div class="danseur">🕺</div>
        <div class="silhouette">👘✨<small>🥿🥿</small></div>
        <div class="legende">♪ musique libre de droits ♪ · arrière-plan : couloir vers l’escalier</div>
      </div>
      <p>Kevin se trémousse au premier plan. Mais vous, vous regardez <b>l’arrière-plan</b> : une silhouette en <b>robe de chambre à fleurs</b> et <b>pantoufles à pompons</b> traverse le couloir à pas de loup... avec un <b>objet brillant</b> sous le bras. Direction : l’escalier.</p>
      <p><i>Vous mettez sur pause. Vous zoomez. C’est flou. Mais c’est flou d’une manière très, très suspecte.</i></p>
      <button class="btn btn-rouge" id="ok">📒 Noter dans le carnet</button>`;
    ouvrirModal(c, { large: true });
    $('#ok', c).onclick = fermerModal;
  }

  /* ---------- 5. Les chaussures ---------- */
  function enigmeChaussures() {
    const OPTIONS = [
      { id: 'kevin', ico: '👟', desc: 'Baskets fluo, pointure 43, semelle lisse « Air », immaculées.', non: 'Pointure 43, semelle lisse, propres comme un sou neuf. Kevin ne marche jamais dans la boue : « ça abîme le contenu ».' },
      { id: 'ginette', ico: '👠', desc: 'Escarpins rouges de salsa, pointure 38, talons aiguilles.', non: 'Des talons aiguilles laisseraient des petits trous, pas des crans. Et en 38, il faudrait des pieds très, très compressés.' },
      { id: 'peche', ico: '🥾', desc: 'Bottes de pêche, pointure 46, semelle crantée, sèches et pleines de poussière.', non: 'Bonne pointure, bons crans... mais elles sont sèches et poussiéreuses. Personne ne les a portées depuis la pêche de 2011 (zéro poisson).' },
      { id: 'janic', ico: '👞', desc: 'Mocassins vernis, pointure 42, semelle lisse, une trace de fraisier.', non: 'Les mocassins de Janic. Semelle lisse, et il n’a pas quitté le salon : il ne quitte jamais son gâteau des yeux.' },
      { id: 'poupard', ico: '🥾', desc: 'Bottes en caoutchouc, pointure 46, semelle crantée, boue fraîche, pépins de tomate.' },
    ];
    const c = el('div', 'enigme');
    c.innerHTML = `
      <h2>👞 Cendrillon, version boue</h2>
      <div class="fiche"><b>👣 Empreinte relevée au jardin</b><br>Pointure ≈ 46 · Semelle crantée · Boue fraîche · Jus rouge et pépins</div>
      <p class="consigne">Quelle paire a laissé ces traces ?</p>
      <div class="choix-grille" id="choix"></div>
      <p class="retour" id="retour"></p>`;
    ouvrirModal(c, { large: true });
    melange(OPTIONS).forEach(o => {
      const b = el('button', 'choix', `<span class="emo">${o.ico}</span><span>${o.desc}</span>`);
      b.onclick = () => {
        if (o.id === 'poupard') {
          reussite('enigme_chaussures');
          gagner('bottes');
          fermerModal();
          narrer(`Bingo. Pointure 46, crans identiques, boue fraîche et pépins de tomate. Vous retournez la botte : une étiquette cousue à l’intérieur.

« <b>PROPRIÉTÉ DE R. POUPARD — PAS TOUCHE, JANIC</b> »

M. Poupard, qui jurait n’avoir « pas mis un orteil dans ce jardin »... Il va falloir avoir une petite conversation.`);
          return;
        }
        Son.rate();
        b.classList.add('faux');
        b.disabled = true;
        $('#retour', c).textContent = o.non;
      };
      $('#choix', c).appendChild(b);
    });
  }

  /* ---------- 6. Le cadenas du grenier (anagramme) ---------- */
  function enigmeCadenas() {
    const LETTRES = ['T', 'C', 'O', 'I', 'R', 'T'];
    const PTS = { T: 1, C: 3, O: 1, I: 1, R: 1 };
    const c = el('div', 'enigme');
    c.innerHTML = `
      <h2>🔒 Le cadenas du grenier</h2>
      <div class="cadenas-ico">🔐</div>
      <p class="consigne">Un cadenas à 6 lettres. Vous repensez au chevalet de Mamie Odette : <b>T · C · O · I · R · T</b>. « Mélangé, pour les curieux »... Remettez les lettres dans l’ordre. <small>(Cliquez sur une lettre pour la placer, sur une case pour la retirer.)</small></p>
      <div class="cases" id="cases"></div>
      <div class="tuiles" id="tuiles"></div>
      <p class="retour" id="retour"></p>`;
    boutonCoupDePouce(c, [
      'C’est ce que Mamie Odette fait toute la journée, quand elle ne dort pas et ne juge pas les gens.',
      'Avec des aiguilles et de la laine. Ça commence par T.',
    ]);
    ouvrirModal(c);
    const places = Array(6).fill(null);           // index de tuile dans chaque case
    const rendre = () => {
      const cases = $('#cases', c);
      const tuiles = $('#tuiles', c);
      cases.innerHTML = '';
      tuiles.innerHTML = '';
      places.forEach((t, i) => {
        const b = el('button', 'case' + (t != null ? ' remplie' : ''), t != null ? LETTRES[t] : '');
        b.setAttribute('aria-label', t != null ? `Retirer ${LETTRES[t]}` : 'Case vide');
        b.onclick = () => { if (t != null) { places[i] = null; Son.clic(); rendre(); } };
        cases.appendChild(b);
      });
      LETTRES.forEach((L, t) => {
        const b = el('button', 'tuile' + (places.includes(t) ? ' utilisee' : ''), L);
        b.dataset.pts = PTS[L];
        b.onclick = () => {
          const libre = places.indexOf(null);
          if (libre < 0) return;
          places[libre] = t;
          Son.clic();
          rendre();
          if (!places.includes(null)) verifier();
        };
        tuiles.appendChild(b);
      });
    };
    const verifier = () => {
      const mot = places.map(t => LETTRES[t]).join('');
      if (mot === 'TRICOT') {
        reussite('enigme_cadenas');
        lever('grenierOuvert');
        Son.bip(1800, 0.05, 'square', 0.05, 0.3);
        setTimeout(() => {
          fermerModal();
          narrer('<b>Clic !</b> Le cadenas s’ouvre. « TRICOT ». Évidemment. Le mot de passe d’une dame qui tricote depuis 1938.\n\nL’escalier du grenier vous tend les bras. Enfin, ses marches. Qui grincent.');
          allerA('grenier');
        }, 600);
        return;
      }
      Son.rate();
      secouer(c);
      $('#retour', c).textContent = `« ${mot} » ? Le cadenas reste fermé. Ce mot n’existe pas, sauf peut-être au Scrabble de Mamie, où elle invente des mots depuis 1962.`;
      setTimeout(() => { places.fill(null); rendre(); }, 900);
    };
    rendre();
  }

  /* =========================================================
     AIDE (indice global)
     ========================================================= */
  const AIDES = [
    [() => !S.sujets['janic.recit'], 'Commencez par écouter votre client, Tonton Janic, au salon. Il adore parler. Surtout de lui.'],
    [() => !a('vitrine') || !a('photo1997') || !a('age'), 'Fouillez le salon de fond en comble : la vitrine, la cheminée, le gâteau...'],
    [() => !f('enigme_devinette'), 'Mamie Odette refuse de parler tant que vous n’avez pas résolu son énigme. Pensez à quelque chose qui se chuchote... et qui ne se répète pas.'],
    [() => !dansSac('loupe'), 'Un détective sans loupe, c’est comme une moustache sans cire. Il y en a une sur l’établi du garage.'],
    [() => !a('paillettes'), 'Avec la loupe, le tapis du salon a peut-être quelque chose à dire.'],
    [() => !a('message'), 'Les poubelles en disent long sur les gens. Celle de la cuisine, par exemple. (Jules César aimait le chiffre 3.)'],
    [() => !a('jessica'), 'Ce message signé « J. »... Montrez-le au plus jeune de la maison, au garage.'],
    [() => !a('salsa'), 'Tata Ginette cache quelque chose. Jetez un œil à son livre de recettes.'],
    [() => !a('lampe'), 'Confrontez Tata Ginette au reçu du Club Caliente.'],
    [() => !f('enigme_disjoncteur'), 'Cette coupure de courant était-elle vraiment un accident ? Le tableau électrique est au garage. Chaque levier fait aussi basculer ses voisins.'],
    [() => !f('enigme_code'), 'Le téléphone de Kevin, au garage : l’année de la photo de la cheminée + l’âge indiqué par le gâteau.'],
    [() => !a('empreinte'), 'Il a plu. Le jardin doit être plein de traces.'],
    [() => !a('bottes'), 'Comparez les empreintes du jardin avec le meuble à chaussures de l’entrée.'],
    [() => !a('tomates'), 'Confrontez M. Poupard, au jardin : ses bottes l’ont trahi.'],
    [() => !dansSac('biscuit') && !a('pistache'), 'Pistache sait des choses. Mais il ne parle que le biscuit. Regardez dans le placard de la cuisine.'],
    [() => !a('pistache'), 'Donnez votre biscuit à Pistache, au jardin. Puis regardez où il va.'],
    [() => !a('scrabble'), 'Le grenier est fermé par un mot de passe. Le Scrabble de Mamie, au salon, en sait quelque chose.'],
    [() => !f('grenierOuvert'), 'Le cadenas de l’escalier (dans l’entrée) : six lettres, T·C·O·I·R·T. Ce que Mamie fait toute la journée.'],
    [() => !a('note') || !a('peinture') || !a('patron') || !a('torche'), 'Fouillez bien le grenier. Tout le grenier.'],
    [() => true, 'Vous avez tout ce qu’il faut. Qui tricote du rose fluo, porte une robe de chambre à fleurs et monte au grenier en douce ? Pourquoi repeindre un trophée devenu verdâtre, le jour d’un anniversaire ? Et où le cacher ? À vous : <b>J’ACCUSE !</b>'],
  ];
  function demanderAide() {
    const aide = AIDES.find(([cond]) => cond())[1];
    S.flair -= 5;
    S.aides++;
    Son.clic();
    narrer(`💡 <i>Votre petite voix intérieure (qui a la voix de l’inspecteur Columbo) murmure :</i>\n\n« ${aide} »\n\n<small>(−5 flair)</small>`);
    majUI();
    bumpStat('#flair');
  }

  /* =========================================================
     CARNET & SAC
     ========================================================= */
  function ouvrirCarnet(onglet = 'indices') {
    const c = el('div', 'carnet');
    c.innerHTML = `
      <h2>📒 Carnet d’enquête de ${D()}</h2>
      <div class="onglets">
        <button class="onglet ${onglet === 'indices' ? 'actif' : ''}" data-o="indices">🔎 Indices (${S.indices.length}/${NB_INDICES})</button>
        <button class="onglet ${onglet === 'suspects' ? 'actif' : ''}" data-o="suspects">🕵️ Suspects</button>
        <button class="onglet ${onglet === 'enigmes' ? 'actif' : ''}" data-o="enigmes">🧩 Énigmes (${ENIGMES.filter(f).length}/${ENIGMES.length})</button>
      </div>
      <div class="liste-indices" id="liste"></div>`;
    ouvrirModal(c, { large: true });
    $$('.onglet', c).forEach(b => { b.onclick = () => { Son.clic(); ouvrirCarnet(b.dataset.o); }; });
    const liste = $('#liste', c);
    if (onglet === 'indices') {
      S.indices.forEach(id => {
        const i = INDICES[id];
        liste.appendChild(el('div', 'fiche-indice', `<span class="emo">${i.ico}</span><div><h4>${i.titre}</h4><p>${i.texte}</p></div>`));
      });
      const reste = NB_INDICES - S.indices.length;
      if (reste > 0) liste.appendChild(el('div', 'fiche-indice cache', `<span class="emo">❔</span><div><h4>${reste} indice${reste > 1 ? 's' : ''} encore caché${reste > 1 ? 's' : ''}</h4><p>Fouillez, interrogez, résolvez les énigmes.</p></div>`));
    } else if (onglet === 'suspects') {
      SUSPECTS.forEach(id => {
        const P = PERSOS[id];
        liste.appendChild(el('div', 'fiche-indice fiche-suspect', `<span class="emo">${P.ico}</span><div><h4>${P.nom}</h4><p><small>${P.role}</small></p><ul>${notesSuspect(id).map(n => `<li>${n}</li>`).join('')}</ul></div>`));
      });
    } else {
      const NOMS = {
        enigme_devinette: ['👵', 'La devinette de Mamie', 'Salon'],
        enigme_cesar: ['✉️', 'Le message codé', 'Cuisine'],
        enigme_disjoncteur: ['⚡', 'Le tableau électrique', 'Garage'],
        enigme_code: ['📱', 'Le téléphone de Kevin', 'Garage'],
        enigme_chaussures: ['👞', 'Cendrillon, version boue', 'Entrée'],
        enigme_cadenas: ['🔒', 'Le cadenas du grenier', 'Entrée'],
      };
      ENIGMES.forEach(e => {
        const [ico, nom, ou] = NOMS[e];
        liste.appendChild(el('div', 'fiche-indice' + (f(e) ? '' : ' cache'), `<span class="emo">${f(e) ? ico : '❔'}</span><div><h4>${f(e) ? '✅ ' : ''}${nom}</h4><p>${f(e) ? 'Résolue. Bravo.' : `Quelque part du côté : ${ou}.`}</p></div>`));
      });
    }
  }

  function ouvrirSac() {
    const c = el('div', 'sac');
    c.innerHTML = '<h2>🎒 Votre sac</h2><div class="liste-indices" id="liste"></div>';
    ouvrirModal(c);
    const liste = $('#liste', c);
    liste.appendChild(el('div', 'fiche-indice', '<span class="emo">🎩</span><div><h4>Chapeau de détective</h4><p>Indispensable. Il ne sert à rien, mais il vous donne l’air de savoir ce que vous faites.</p></div>'));
    S.sac.forEach(id => {
      const o = OBJETS[id];
      liste.appendChild(el('div', 'fiche-indice', `<span class="emo">${o.ico}</span><div><h4>${o.nom}</h4><p>${o.desc}</p></div>`));
    });
    if (!S.sac.length) liste.appendChild(el('p', 'vide', 'À part ça : rien. Même pas un mouchoir. Fouillez les lieux !'));
  }

  /* =========================================================
     ACCUSATION
     ========================================================= */
  const MOBILES = [
    { id: 'jalousie', t: '😤 La jalousie (vengeance de 1997)' },
    { id: 'argent', t: '💶 L’argent (revendre le trophée)' },
    { id: 'menage', t: '🧹 Le ménage (marre d’épousseter)' },
    { id: 'buzz', t: '📈 Le buzz (une vidéo virale)' },
    { id: 'surprise', t: '🎁 Une surprise (le remettre à neuf pour l’anniversaire)' },
  ];
  const CACHETTES = [
    { id: 'poupard', t: '🏡 Chez M. Poupard' },
    { id: 'trou', t: '🕳️ Dans le trou de Pistache' },
    { id: 'congel', t: '🧊 Dans le congélateur de Ginette' },
    { id: 'grenier', t: '🕯️ Au grenier' },
    { id: 'panier', t: '🧺 Dans le panier à tricot de Mamie' },
  ];

  function ouvrirAccusation() {
    Son.clic();
    const choix = { coupable: null, mobile: null, cachette: null };
    const c = el('div', 'accusation');
    const peu = S.indices.length < 12;
    c.innerHTML = `
      <h2>⚖️ J’accuse !</h2>
      <p class="consigne">Toute la famille se rassemble au salon. Kevin filme. Pistache retient son souffle. C’est le moment de vérité.</p>
      ${peu ? `<p class="avertissement">⚠️ Vous n’avez que ${S.indices.length} indices sur ${NB_INDICES}. Un vrai détective accuse avec des preuves... Mais c’est vous qui voyez. Une fausse accusation coûte 30 de flair.</p>` : ''}
      <div class="groupe-accusation"><h3>1. Qui a volé la Moustache d’Or ?</h3><div class="options" data-g="coupable"></div></div>
      <div class="groupe-accusation"><h3>2. Pourquoi ?</h3><div class="options" data-g="mobile"></div></div>
      <div class="groupe-accusation"><h3>3. Où est caché le trophée ?</h3><div class="options" data-g="cachette"></div></div>
      <button class="btn btn-rouge" id="accuser" disabled>⚖️ Je désigne le coupable !</button>`;
    ouvrirModal(c, { large: true });
    const groupes = {
      coupable: SUSPECTS.map(id => ({ id, t: `${PERSOS[id].ico} ${PERSOS[id].nom}` })),
      mobile: MOBILES,
      cachette: CACHETTES,
    };
    Object.entries(groupes).forEach(([g, opts]) => {
      const box = $(`[data-g="${g}"]`, c);
      opts.forEach(o => {
        const b = el('button', 'option', o.t);
        b.onclick = () => {
          Son.clic();
          choix[g] = o.id;
          $$('.option', box).forEach(x => x.classList.remove('choisie'));
          b.classList.add('choisie');
          $('#accuser', c).disabled = !(choix.coupable && choix.mobile && choix.cachette);
        };
        box.appendChild(b);
      });
    });
    $('#accuser', c).onclick = () => verdict(choix);
  }

  const FAUSSES = {
    ginette: 'Vous pointez Tata Ginette du doigt. Elle éclate de rire, enfile ses escarpins rouges et vous inflige une démonstration de salsa de quarante-cinq minutes pour prouver son alibi.\n\nVous ne vous en remettez jamais tout à fait. Le trophée, lui, reste introuvable.',
    kevin: 'Vous accusez Kevin. Il publie aussitôt une vidéo : « UN DÉTECTIVE M’ACCUSE À TORT (JE CRAQUE) ». Deux millions de vues.\n\nVotre tête devient un mème international. Le trophée, lui, reste introuvable.',
    poupard: 'Vous accusez M. Poupard. Il fond en larmes et avoue tout... le vol de douze tomates.\n\nLe juge est perplexe. Janic est furieux pour les tomates. Mais le trophée, lui, reste introuvable.',
    pistache: 'Vous accusez un basset.\n\nPistache vous regarde avec ses grands yeux tristes. Toute la famille vous regarde avec ses grands yeux tristes. Même Poupard.\n\nVous n’avez jamais eu aussi honte.',
    janic: 'Vous accusez votre propre client. Tonton Janic, outré, refuse de payer vos honoraires.\n\nEt franchement, il a raison. Il a pleuré dans sa serviette toute la soirée.',
  };

  function verdict(ch) {
    if (ch.coupable !== 'mamie') {
      S.erreurs++;
      S.flair -= 30;
      Son.rate();
      const c = el('div', 'fin');
      c.innerHTML = `<h2>💥 Fausse piste !</h2><p>${FAUSSES[ch.coupable].replace(/\n/g, '<br>')}</p>
        <p><i>Votre réputation en prend un coup (−30 flair). Mais un bon détective ne lâche jamais l’affaire.</i></p>
        <button class="btn btn-rouge" id="reprendre">🔎 Reprendre l’enquête</button>`;
      ouvrirModal(c, { fermable: false });
      $('#reprendre', c).onclick = fermerModal;
      sauver();
      return;
    }
    if (ch.mobile !== 'surprise' || ch.cachette !== 'panier') {
      S.erreurs++;
      S.flair -= 15;
      Son.rate();
      const pb = [];
      if (ch.mobile !== 'surprise') pb.push('le <b>mobile</b> ne colle pas');
      if (ch.cachette !== 'panier') pb.push('la <b>cachette</b> n’est pas la bonne');
      const c = el('div', 'fin');
      c.innerHTML = `<h2>🧶 Presque !</h2>
        <p>Mamie Odette lève un sourcil. « Bien vu pour moi, mon lapin. Mais pour le reste, vous brodez. Et la broderie, c’est <i>mon</i> domaine. »</p>
        <p>Elle reprend son tricot, imperturbable. Visiblement, ${pb.join(' et ')}. Relisez votre carnet.</p>
        <p><i>(−15 flair)</i></p>
        <button class="btn btn-rouge" id="reprendre">🔎 Reprendre l’enquête</button>`;
      ouvrirModal(c, { fermable: false });
      $('#reprendre', c).onclick = fermerModal;
      sauver();
      return;
    }
    S.flair += 100;
    S.fini = true;
    sauver();
    finHeureuse();
  }

  const RANGS = [
    [360, '🏆 Légende vivante', 'Hercule Poirot vous demande un autographe.'],
    [280, '🥇 Fin limier', 'Votre moustache (réelle ou imaginaire) pousse d’un centimètre de fierté.'],
    [200, '🥈 Bon flair', 'Pistache vous respecte. C’est déjà beaucoup.'],
    [120, '🥉 Limier en herbe', 'Il y a du potentiel. Et des miettes de fraisier sur votre imperméable.'],
    [-Infinity, '🧦 Inspecteur Gadget du dimanche', 'Vous avez résolu l’affaire... un peu par hasard. Mais résolu quand même !'],
  ];

  function finHeureuse() {
    Son.victoire();
    confettis();
    const [, rang, phrase] = RANGS.find(([min]) => S.flair >= min);
    const duree = S.minutes;
    const paras = [
      'Vous vous levez, solennellement. Vous pointez un doigt (légèrement tremblant) vers le fauteuil.',
      '« <b>Mamie Odette. C’est vous.</b> »',
      'Silence. Pistache retient son souffle. Kevin zoome.',
      '« À 22h00, vous avez abaissé le disjoncteur — un fil de votre laine rose fluo est resté accroché au levier. Dans le noir, en robe de chambre à fleurs, avec la lampe de poche de la cuisine, vous avez pris le trophée et vous êtes montée au grenier. M. Poupard a vu la lumière, la caméra de Kevin vous a vue passer. Là-haut, vous l’avez repeint à la peinture à paillettes. Puis vous l’avez redescendu... et caché dans le seul endroit où personne n’ose regarder : <b>votre panier à tricot</b>. »',
      'Mamie Odette pose ses aiguilles. Soupire. Puis sourit.',
      '« Il était tout vert, ce trophée. Vert-de-gris. Soixante ans, ça se fête : je voulais lui rendre son éclat... et lui tricoter un petit pull. C’était une <b>surprise</b>, espèce de fouine. »',
      'Elle soulève sa pelote : la <b>Moustache d’Or</b> apparaît, étincelante, dorée à paillettes, vêtue d’un minuscule pull rose fluo à col roulé.',
      'Tonton Janic fond en larmes. Ginette aussi. M. Poupard aussi, mais il dit que c’est le pollen.',
      '<b>Bilan de la soirée :</b><br>💃 Ginette avoue la salsa et fait une démonstration. Janic la rejoint. C’est un désastre magnifique.<br>🍅 Poupard rend les douze tomates. Enfin, la sauce.<br>💘 Kevin et Jessica s’embrassent derrière la haie. Poupard tolère. Pour l’instant.<br>🐶 Pistache mange le reste du fraisier. Personne ne l’arrête.',
      '<b>Affaire classée.</b> Mamie Odette est condamnée à tricoter un pull pour chaque membre de la famille. Elle a l’air ravie.',
    ];
    const c = el('div', 'fin');
    c.innerHTML = `
      <div class="trophee-final">🏆</div>
      <h2 style="text-align:center">Affaire résolue, ${D()} !</h2>
      ${paras.map((p, i) => `<p style="animation-delay:${i * 0.35}s">${p}</p>`).join('')}
      <div class="stats" style="animation: apparait .6s ${paras.length * 0.35}s both">
        <div><b>${S.flair}</b>flair</div>
        <div><b>${S.indices.length}/${NB_INDICES}</b>indices</div>
        <div><b>${ENIGMES.filter(f).length}/${ENIGMES.length}</b>énigmes</div>
        <div><b>${S.aides}</b>aides demandées</div>
        <div><b>${S.erreurs}</b>fausses accusations</div>
        <div><b>${Math.floor(duree / 60)}h${String(duree % 60).padStart(2, '0')}</b>d’enquête</div>
      </div>
      <div class="rang" style="animation: apparait .6s ${paras.length * 0.35 + 0.3}s both">Votre rang<strong>${rang}</strong>${phrase}</div>
      <p style="text-align:center; margin-top:18px; animation-delay:${paras.length * 0.35 + 0.6}s"><button class="btn btn-or" id="rejouer">🔄 Nouvelle enquête</button></p>`;
    ouvrirModal(c, { large: true, fermable: false });
    $('#rejouer', c).onclick = () => { effacer(); location.reload(); };
  }

  function confettis() {
    const emo = ['🥸', '✨', '🏆', '🎉', '🧶', '🍅', '🎂'];
    for (let i = 0; i < 40; i++) {
      const s = el('span', 'confetti', auHasard(emo));
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDuration = 2.5 + Math.random() * 3 + 's';
      s.style.animationDelay = Math.random() * 2 + 's';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 8000);
    }
  }

  /* =========================================================
     INTRODUCTION & DÉMARRAGE
     ========================================================= */
  const INTRO = [
    () => `<b>Saint-Glinglin-sur-Mer. Samedi soir. 22h47.</b>

La pluie tombait comme une facture d’électricité : sans prévenir, et en grande quantité.

Dans mon bureau, je finissais mon troisième café de la soirée. Ou mon quatrième. J’avais arrêté de compter en même temps que j’avais arrêté de dormir.`,
    () => { Son.dring(); return `Puis le téléphone a sonné. ☎️

« Allô ? ${D()} ? C’est Janic. <b>TONTON</b> Janic. On m’a volé ma <b>MOUSTACHE D’OR</b> ! Mon trophée ! Championnat départemental 1997 ! Pendant mon anniversaire ! »

« Venez vite ! Il y a du gâteau ! »`; },
    () => `Une moustache en or. Un anniversaire. Du gâteau.

J’ai enfilé mon imperméable, attrapé mon chapeau, et oublié mon parapluie. Comme toujours.

Quinze minutes plus tard, je sonnais à la porte de la maison des Glycines. Il était 23h00. La nuit allait être longue.`,
    () => `🎯 <b>VOTRE MISSION</b>

Démasquer le voleur, comprendre son <b>mobile</b>, et retrouver la <b>cachette</b> du trophée.

🔎 Fouillez chaque pièce
🗣️ Interrogez les suspects (les nouvelles questions apparaissent quand vous trouvez des indices)
🧩 Résolvez les énigmes
⚖️ Accusez quand vous avez des preuves

Chaque indice augmente votre <b>flair</b> 👃. Les aides en coûtent un peu. Bonne chance !`,
  ];

  let pageIntro = 0;
  function afficherIntro() {
    $('#ecran-titre').hidden = true;
    $('#ecran-intro').hidden = false;
    pageIntro = 0;
    pageSuivante();
  }
  function pageSuivante() {
    if (pageIntro >= INTRO.length) return lancerJeu(true);
    const btn = $('#intro-suite');
    btn.textContent = pageIntro === INTRO.length - 1 ? '🔎 Commencer l’enquête' : 'Suite ▸';
    taper($('#intro-texte'), INTRO[pageIntro++]());
  }

  function lancerJeu(nouvelle) {
    $('#ecran-titre').hidden = true;
    $('#ecran-intro').hidden = true;
    $('#jeu').hidden = false;
    majUI();
    if (nouvelle) {
      narrer(`Le salon des Glycines. Une banderole « JOYEUX 60 ANS », des ballons qui se dégonflent, un fraisier entamé.

Tonton Janic se jette sur vous : « ${D()} ! Enfin ! »

Vous sortez votre carnet. L’enquête commence. <b>Cliquez sur les objets à examiner et sur les personnes à interroger.</b>`);
    } else {
      narrer(`Vous reprenez l’enquête là où vous l’aviez laissée. Il est ${heure()}. Le café est froid, mais votre flair est intact.`);
    }
  }

  function demarrer() {
    try { Son.muet = localStorage.getItem(CLE_SON) === '1'; } catch (e) { /* rien */ }

    const sauvegarde = charger();
    if (sauvegarde) {
      $('#btn-reprendre').hidden = false;
      $('#nom').value = sauvegarde.nom;
    }

    $('#btn-nouvelle').onclick = () => {
      Son.init();
      Son.clic();
      S = nouvelEtat();
      S.nom = ($('#nom').value || '').replace(/[<>&"]/g, '').trim().slice(0, 20) || 'Lafouine';
      effacer();
      afficherIntro();
    };
    $('#btn-reprendre').onclick = () => {
      Son.init();
      Son.clic();
      S = sauvegarde;
      lancerJeu(false);
    };
    $('#nom').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-nouvelle').click(); });

    $('#intro-suite').onclick = () => {
      const t = $('#intro-texte');
      if (t._t) { t.click(); return; }   // termine d’abord la page en cours
      Son.clic();
      pageSuivante();
    };
    $('#intro-passer').onclick = () => lancerJeu(true);

    $('#btn-carnet').onclick = () => { Son.clic(); ouvrirCarnet(); };
    $('#btn-sac').onclick = () => { Son.clic(); ouvrirSac(); };
    $('#btn-aide').onclick = demanderAide;
    $('#btn-accuser').onclick = ouvrirAccusation;
    $('#btn-son').onclick = () => {
      Son.muet = !Son.muet;
      try { localStorage.setItem(CLE_SON, Son.muet ? '1' : '0'); } catch (e) { /* rien */ }
      $('#btn-son').textContent = Son.muet ? '🔇' : '🔊';
      Son.clic();
    };

    $('.modal-fermer').onclick = fermerModal;
    $('.modal-fond').onclick = () => { if (modalFermable) fermerModal(); };
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('#modal').hidden && modalFermable) fermerModal();
    });
  }

  demarrer();
})();
