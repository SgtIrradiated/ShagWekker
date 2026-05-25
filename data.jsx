/* global window */
// Static content data — kept verbatim from the source repo.

const NAV_ITEMS = [
  { id: 'home', label: 'Shag', section: 'hero' },
  { id: 'home', label: 'Nicotineteller', section: 'planner' },
  { id: 'home', label: 'Inlassen', section: 'customize' },
  { id: 'home', label: 'Insights', section: 'insights' },
  { id: 'shagmeter', label: 'ShagMeter' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'library', label: 'ShagFiles' },
  { id: 'archief', label: 'Hèt Archief' },
];

const DEFAULT_CUES = [
  { id: 'd1', time: '09:15', label: 'Ochtend-shag', recurrence: 'Daily', color: '#ff3344', notes: 'De starter. Onmisbaar.', isDefault: true },
  { id: 'd2', time: '11:00', label: 'Koffie-pauze', recurrence: 'Weekdays', color: '#ffaa44', notes: 'Met een gerookte krak.', isDefault: true },
  { id: 'd3', time: '13:00', label: 'Lunch-shaggie', recurrence: 'Daily', color: '#44ddaa', notes: '', isDefault: true },
  { id: 'd4', time: '15:30', label: 'Middag-blokje', recurrence: 'Weekdays', color: '#44aaff', notes: 'Even het hoofd legen.', isDefault: true },
  { id: 'd5', time: '17:00', label: 'Vrijmibo-rolletje', recurrence: 'Weekdays', color: '#cc88ff', notes: '', isDefault: true },
  { id: 'd6', time: '21:00', label: 'Avond-blowze', recurrence: 'Daily', color: '#ff66aa', notes: 'De afsluiter.', isDefault: true },
];

const RECURRENCE_LABELS = {
  Daily: 'Dagelijks',
  Weekdays: 'Doordeweeks',
  Weekends: 'Weekenden',
  SpecificWeekdays: 'Specifieke dagen',
};

const WEEKDAY_NAMES = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

const SOUNDBOARD_PADS = [
  { id: 'blyat', label: 'Blyat', src: 'audio/blyat.mp3' },
  { id: 'banka', label: 'Banka', src: 'audio/bankametaal.mp3' },
  { id: 'trump', label: 'Trump', src: 'audio/nicotinerzshy.mp3' },
  { id: 'blije', label: 'Blije Man', src: 'audio/audio.mp3' },
];

const AUDIO_TRACKS = [
  { id: 't1', title: 'Shag Archives Mix', meta: 'Vaste playlist · 12 tracks', duration: '34:18' },
  { id: 't2', title: 'Ochtend-rituelen', meta: 'Curated · 7 tracks', duration: '21:04' },
  { id: 't3', title: 'Avond-blokje deep', meta: 'Slow burn · 9 tracks', duration: '41:55' },
  { id: 't4', title: 'Vrijmibo selectie', meta: 'High energy · 11 tracks', duration: '38:12' },
];

const GALLERY_ITEMS = [
  {
    title: 'Investeerders van ShagWekker.nl',
    description: 'Trouwe investeerders (Pieter Hein (links) & Donaldy Trumpowich (Rechts)',
    src: 'gallery/jottrump.png',
    alt: 'bitchesss',
  },
  {
    title: 'Night City Kunstwerk',
    description: 'Mooi Schilderij.',
    src: null,
    placeholder: 'ricardobaba.png',
    alt: '',
  },
  {
    title: 'Le Baap',
    description: 'Khyarat Fyldrz Smoket een baap.',
    src: 'gallery/groep.png',
    alt: '',
  },
  {
    title: 'Arthur Morgan jat bomen',
    description: 'Arthur Morgan die zojuist een lading hout heeft ontnomen.',
    src: null,
    placeholder: 'kebab.png',
    alt: '',
  },
  {
    title: "Donaldy caught blazin'",
    description: 'Donaldy Trumpowich draait wel een verdacht dik shaggie...',
    src: 'gallery/trumpj.png',
    alt: '',
  },
  {
    title: 'Dikke Deal',
    description: 'Pieter Hein die een 69-billion Euro deal aan het maken is met Geert voor ShagWekker.nl',
    src: 'gallery/dikkedeal.png',
    alt: '',
  },
  {
    title: 'Peerson',
    description: 'Meneer Peerson die als een oostblokker hurkt in de lucht.',
    src: null,
    placeholder: 'peerson.png',
    alt: '',
  },
];

const RESOURCE_ITEMS = [
  { badge: 'JPG', title: 'Geert Wilders Picca', meta: 'Start je dag met een rookplan dat werkt.', href: 'files/1200px-Geert_Wilders-187607807.jpg', cta: 'Open bestand' },
  { badge: '.ZIP', title: 'Wilders Zip', meta: 'Wilders.zip', href: 'files/rotbek.zip', cta: 'Downieload' },
  { badge: 'PNG', title: 'ShagWekker Logo', meta: 'Het Logo van ShagWekker.', href: 'assets/shag.png', cta: 'Download' },
  { badge: '', title: 'Leeg', meta: '-', href: '', cta: 'Open bestand' },
  { badge: '', title: 'Leeg', meta: '-', href: '', cta: 'Open bestand' },
  { badge: '', title: 'Leeg', meta: '-', href: 'files/wakeup-jingle.mp3', cta: 'Open bestand' },
];

const RESOURCE_NOTES = [
  { title: '1. Toegankelijkheid', body: 'Bij ShagWekker hebben we een hekel aan derde partijen die questionable bestanden moeten behandelen van ShagWekker. Wij doen het gráág lekker zelf.' },
  { title: '2. ShagSpeed', body: 'ShagSpeed Heeft GÉÉN uitleg nodig.' },
  { title: '3. Makkelijk te delen.', body: 'Geen gedoe meer met discord/dropbox/gdrive, wat een gelul kan dat zijn...' },
];

const ARCHIVE_VIDEOS = [
  { title: 'Stel prutsers denken een Gans te vangen', description: 'Stel prutsers denken een Gans te vangen en het daarna op te vreten...', src: 'HetArchief/goosetoeat.mp4' },
  { title: '<b>Puntig</b> & <i>Scherp</i> avontuur', description: 'Twee knullen hebben een vriendelijke stoeipartij met kinderspeelgoed.', src: 'HetArchief/brixton.mp4' },
  { title: 'EnzoKnol in Brussel', description: 'Lekker een dagje vloggen in Brussel! Wie wil dat nou niet? Misschien deze knurftjes? (<b>@Kurt Caz</b> <code>YouTube</code>)', src: 'HetArchief/brusselscaz.mp4' },
  { title: 'Doe de stoelendans', description: 'Productieve leden van de maatschappij komen zichzelf tegen in een gezellige stoelendans.', src: 'HetArchief/stoelendans.mp4' },
  { title: 'Mortal Kombat 1vs10 Modded', description: 'Fantasiefiguren denken dat ze de realiteit kunnen manipuleren. Echte man laat zien hoe het zit.', src: 'HetArchief/antifag.mp4' },
  { title: 'Rijst-liefhebbers betoogbureau', description: 'Laat heel mooi zien dat sommige zooi op het internet gewoon niet legit is.', src: 'HetArchief/botfarm.mp4' },
  { title: 'Kippenfeest (NSFW)', description: 'Heeft er iemand ook zo zin in kip?.', src: 'HetArchief/veyfc.mp4' },
];

Object.assign(window, {
  NAV_ITEMS,
  DEFAULT_CUES,
  RECURRENCE_LABELS,
  WEEKDAY_NAMES,
  SOUNDBOARD_PADS,
  AUDIO_TRACKS,
  GALLERY_ITEMS,
  RESOURCE_ITEMS,
  RESOURCE_NOTES,
  ARCHIVE_VIDEOS,
});
