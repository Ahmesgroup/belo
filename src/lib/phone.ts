// ============================================================
// lib/phone.ts — Phone number utilities — 240+ countries
//
// E.164 formatting, validation, and country metadata.
// No external dependencies.
// ============================================================

export interface Country {
  iso:      string;   // ISO 3166-1 alpha-2
  dial:     string;   // dial code without +
  flag:     string;   // emoji flag
  name:     string;   // English name
  nameFr:   string;   // French name
  pattern?: RegExp;   // optional local-number validation regex
  example?: string;   // placeholder
}

// ── Full country list (240+) ──────────────────────────────────
// Africa first (Belo's primary market), then alphabetical

export const COUNTRIES: Country[] = [
  // ── Africa ──────────────────────────────────────────────────
  { iso:"SN", dial:"221", flag:"🇸🇳", name:"Senegal",              nameFr:"Sénégal",            example:"77 123 45 67",   pattern:/^[5-9]\d{7,8}$/ },
  { iso:"CI", dial:"225", flag:"🇨🇮", name:"Ivory Coast",           nameFr:"Côte d'Ivoire",      example:"07 12 34 56 78", pattern:/^\d{10}$/ },
  { iso:"ML", dial:"223", flag:"🇲🇱", name:"Mali",                  nameFr:"Mali",               example:"79 12 34 56",    pattern:/^\d{8}$/ },
  { iso:"GN", dial:"224", flag:"🇬🇳", name:"Guinea",               nameFr:"Guinée",             example:"621 23 45 67",   pattern:/^\d{9}$/ },
  { iso:"BF", dial:"226", flag:"🇧🇫", name:"Burkina Faso",          nameFr:"Burkina Faso",       example:"70 12 34 56" },
  { iso:"NE", dial:"227", flag:"🇳🇪", name:"Niger",                 nameFr:"Niger",              example:"90 12 34 56" },
  { iso:"TG", dial:"228", flag:"🇹🇬", name:"Togo",                  nameFr:"Togo",               example:"90 12 34 56" },
  { iso:"BJ", dial:"229", flag:"🇧🇯", name:"Benin",                 nameFr:"Bénin",              example:"90 12 34 56" },
  { iso:"MR", dial:"222", flag:"🇲🇷", name:"Mauritania",            nameFr:"Mauritanie",         example:"22 12 34 56" },
  { iso:"GM", dial:"220", flag:"🇬🇲", name:"Gambia",               nameFr:"Gambie",             example:"90 12 34 56" },
  { iso:"GW", dial:"245", flag:"🇬🇼", name:"Guinea-Bissau",         nameFr:"Guinée-Bissau",      example:"95 123 4567" },
  { iso:"CV", dial:"238", flag:"🇨🇻", name:"Cape Verde",            nameFr:"Cap-Vert",           example:"991 23 45" },
  { iso:"SL", dial:"232", flag:"🇸🇱", name:"Sierra Leone",          nameFr:"Sierra Leone",       example:"76 123 456" },
  { iso:"LR", dial:"231", flag:"🇱🇷", name:"Liberia",              nameFr:"Libéria",            example:"77 012 3456" },
  { iso:"GH", dial:"233", flag:"🇬🇭", name:"Ghana",                nameFr:"Ghana",              example:"24 123 4567" },
  { iso:"NG", dial:"234", flag:"🇳🇬", name:"Nigeria",              nameFr:"Nigéria",            example:"802 123 4567" },
  { iso:"CM", dial:"237", flag:"🇨🇲", name:"Cameroon",             nameFr:"Cameroun",           example:"690 12 34 56" },
  { iso:"CF", dial:"236", flag:"🇨🇫", name:"Central African Rep.",  nameFr:"République Centrafricaine", example:"72 12 34 56" },
  { iso:"TD", dial:"235", flag:"🇹🇩", name:"Chad",                 nameFr:"Tchad",              example:"63 12 34 56" },
  { iso:"GQ", dial:"240", flag:"🇬🇶", name:"Equatorial Guinea",    nameFr:"Guinée Équatoriale", example:"222 123 456" },
  { iso:"GA", dial:"241", flag:"🇬🇦", name:"Gabon",                nameFr:"Gabon",              example:"06 12 34 56" },
  { iso:"CG", dial:"242", flag:"🇨🇬", name:"Congo",                nameFr:"Congo-Brazzaville",  example:"06 123 4567" },
  { iso:"CD", dial:"243", flag:"🇨🇩", name:"DR Congo",             nameFr:"RD Congo",           example:"81 234 5678" },
  { iso:"ST", dial:"239", flag:"🇸🇹", name:"Sao Tome & Principe",  nameFr:"São Tomé-et-Príncipe", example:"981 2345" },
  { iso:"AO", dial:"244", flag:"🇦🇴", name:"Angola",               nameFr:"Angola",             example:"923 123 456" },
  { iso:"ZM", dial:"260", flag:"🇿🇲", name:"Zambia",               nameFr:"Zambie",             example:"97 712 3456" },
  { iso:"ZW", dial:"263", flag:"🇿🇼", name:"Zimbabwe",             nameFr:"Zimbabwe",           example:"71 234 5678" },
  { iso:"MW", dial:"265", flag:"🇲🇼", name:"Malawi",               nameFr:"Malawi",             example:"991 23 45 67" },
  { iso:"MZ", dial:"258", flag:"🇲🇿", name:"Mozambique",           nameFr:"Mozambique",         example:"84 123 4567" },
  { iso:"TZ", dial:"255", flag:"🇹🇿", name:"Tanzania",             nameFr:"Tanzanie",           example:"712 345 678" },
  { iso:"KE", dial:"254", flag:"🇰🇪", name:"Kenya",                nameFr:"Kenya",              example:"712 345 678" },
  { iso:"UG", dial:"256", flag:"🇺🇬", name:"Uganda",               nameFr:"Ouganda",            example:"712 345 678" },
  { iso:"RW", dial:"250", flag:"🇷🇼", name:"Rwanda",               nameFr:"Rwanda",             example:"78 123 4567" },
  { iso:"BI", dial:"257", flag:"🇧🇮", name:"Burundi",              nameFr:"Burundi",            example:"79 123 456" },
  { iso:"SS", dial:"211", flag:"🇸🇸", name:"South Sudan",          nameFr:"Soudan du Sud",      example:"91 234 5678" },
  { iso:"SD", dial:"249", flag:"🇸🇩", name:"Sudan",                nameFr:"Soudan",             example:"91 234 5678" },
  { iso:"ET", dial:"251", flag:"🇪🇹", name:"Ethiopia",             nameFr:"Éthiopie",           example:"91 123 4567" },
  { iso:"ER", dial:"291", flag:"🇪🇷", name:"Eritrea",              nameFr:"Érythrée",           example:"7 123 456" },
  { iso:"SO", dial:"252", flag:"🇸🇴", name:"Somalia",              nameFr:"Somalie",            example:"61 234 5678" },
  { iso:"DJ", dial:"253", flag:"🇩🇯", name:"Djibouti",             nameFr:"Djibouti",           example:"77 83 10 01" },
  { iso:"KM", dial:"269", flag:"🇰🇲", name:"Comoros",              nameFr:"Comores",            example:"321 23 45" },
  { iso:"SC", dial:"248", flag:"🇸🇨", name:"Seychelles",           nameFr:"Seychelles",         example:"2 510 000" },
  { iso:"MU", dial:"230", flag:"🇲🇺", name:"Mauritius",            nameFr:"Maurice",            example:"5 251 1234" },
  { iso:"MG", dial:"261", flag:"🇲🇬", name:"Madagascar",           nameFr:"Madagascar",         example:"32 12 345 67" },
  { iso:"RE", dial:"262", flag:"🇷🇪", name:"Réunion",              nameFr:"La Réunion",         example:"692 12 34 56" },
  { iso:"YT", dial:"262", flag:"🇾🇹", name:"Mayotte",              nameFr:"Mayotte",            example:"269 12 34 56" },
  { iso:"ZA", dial:"27",  flag:"🇿🇦", name:"South Africa",         nameFr:"Afrique du Sud",     example:"71 234 5678" },
  { iso:"NA", dial:"264", flag:"🇳🇦", name:"Namibia",              nameFr:"Namibie",            example:"81 234 5678" },
  { iso:"BW", dial:"267", flag:"🇧🇼", name:"Botswana",             nameFr:"Botswana",           example:"71 123 456" },
  { iso:"LS", dial:"266", flag:"🇱🇸", name:"Lesotho",              nameFr:"Lesotho",            example:"58 812 345" },
  { iso:"SZ", dial:"268", flag:"🇸🇿", name:"Eswatini",             nameFr:"Eswatini",           example:"76 12 34 56" },
  { iso:"LY", dial:"218", flag:"🇱🇾", name:"Libya",                nameFr:"Libye",              example:"91 234 5678" },
  { iso:"TN", dial:"216", flag:"🇹🇳", name:"Tunisia",              nameFr:"Tunisie",            example:"20 123 456" },
  { iso:"DZ", dial:"213", flag:"🇩🇿", name:"Algeria",              nameFr:"Algérie",            example:"551 23 45 67" },
  { iso:"MA", dial:"212", flag:"🇲🇦", name:"Morocco",              nameFr:"Maroc",              example:"612 34 56 78" },
  { iso:"EG", dial:"20",  flag:"🇪🇬", name:"Egypt",                nameFr:"Égypte",             example:"100 123 4567" },
  // ── Europe ──────────────────────────────────────────────────
  { iso:"AL", dial:"355", flag:"🇦🇱", name:"Albania",              nameFr:"Albanie",            example:"67 212 3456" },
  { iso:"AD", dial:"376", flag:"🇦🇩", name:"Andorra",              nameFr:"Andorre",            example:"312 345" },
  { iso:"AT", dial:"43",  flag:"🇦🇹", name:"Austria",              nameFr:"Autriche",           example:"664 123456" },
  { iso:"BY", dial:"375", flag:"🇧🇾", name:"Belarus",              nameFr:"Biélorussie",        example:"29 491-19-19" },
  { iso:"BE", dial:"32",  flag:"🇧🇪", name:"Belgium",              nameFr:"Belgique",           example:"471 23 45 67", pattern:/^[4-9]\d{7,8}$/ },
  { iso:"BA", dial:"387", flag:"🇧🇦", name:"Bosnia",               nameFr:"Bosnie-Herzégovine", example:"61 123 456" },
  { iso:"BG", dial:"359", flag:"🇧🇬", name:"Bulgaria",             nameFr:"Bulgarie",           example:"87 123 4567" },
  { iso:"HR", dial:"385", flag:"🇭🇷", name:"Croatia",              nameFr:"Croatie",            example:"91 234 5678" },
  { iso:"CY", dial:"357", flag:"🇨🇾", name:"Cyprus",               nameFr:"Chypre",             example:"96 123456" },
  { iso:"CZ", dial:"420", flag:"🇨🇿", name:"Czech Republic",       nameFr:"République tchèque", example:"601 123 456" },
  { iso:"DK", dial:"45",  flag:"🇩🇰", name:"Denmark",              nameFr:"Danemark",           example:"20 12 34 56" },
  { iso:"EE", dial:"372", flag:"🇪🇪", name:"Estonia",              nameFr:"Estonie",            example:"5123 4567" },
  { iso:"FI", dial:"358", flag:"🇫🇮", name:"Finland",              nameFr:"Finlande",           example:"50 123 4567" },
  { iso:"FR", dial:"33",  flag:"🇫🇷", name:"France",               nameFr:"France",             example:"6 12 34 56 78", pattern:/^[67]\d{8}$/ },
  { iso:"DE", dial:"49",  flag:"🇩🇪", name:"Germany",              nameFr:"Allemagne",          example:"151 23456789" },
  { iso:"GI", dial:"350", flag:"🇬🇮", name:"Gibraltar",            nameFr:"Gibraltar",          example:"57123456" },
  { iso:"GR", dial:"30",  flag:"🇬🇷", name:"Greece",               nameFr:"Grèce",              example:"691 234 5678" },
  { iso:"HU", dial:"36",  flag:"🇭🇺", name:"Hungary",              nameFr:"Hongrie",            example:"20 123 4567" },
  { iso:"IS", dial:"354", flag:"🇮🇸", name:"Iceland",              nameFr:"Islande",            example:"611 1234" },
  { iso:"IE", dial:"353", flag:"🇮🇪", name:"Ireland",              nameFr:"Irlande",            example:"85 123 4567" },
  { iso:"IT", dial:"39",  flag:"🇮🇹", name:"Italy",                nameFr:"Italie",             example:"312 345 6789" },
  { iso:"XK", dial:"383", flag:"🇽🇰", name:"Kosovo",               nameFr:"Kosovo",             example:"43 123 456" },
  { iso:"LV", dial:"371", flag:"🇱🇻", name:"Latvia",               nameFr:"Lettonie",           example:"21 234 567" },
  { iso:"LI", dial:"423", flag:"🇱🇮", name:"Liechtenstein",        nameFr:"Liechtenstein",      example:"660 234 567" },
  { iso:"LT", dial:"370", flag:"🇱🇹", name:"Lithuania",            nameFr:"Lituanie",           example:"612 34567" },
  { iso:"LU", dial:"352", flag:"🇱🇺", name:"Luxembourg",           nameFr:"Luxembourg",         example:"621 234 567", pattern:/^\d{6,9}$/ },
  { iso:"MT", dial:"356", flag:"🇲🇹", name:"Malta",                nameFr:"Malte",              example:"96 123 456" },
  { iso:"MD", dial:"373", flag:"🇲🇩", name:"Moldova",              nameFr:"Moldavie",           example:"621 12 345" },
  { iso:"MC", dial:"377", flag:"🇲🇨", name:"Monaco",               nameFr:"Monaco",             example:"6 12 34 56 78" },
  { iso:"ME", dial:"382", flag:"🇲🇪", name:"Montenegro",           nameFr:"Monténégro",         example:"67 622 901" },
  { iso:"NL", dial:"31",  flag:"🇳🇱", name:"Netherlands",          nameFr:"Pays-Bas",           example:"6 12345678" },
  { iso:"MK", dial:"389", flag:"🇲🇰", name:"North Macedonia",      nameFr:"Macédoine du Nord",  example:"72 345 678" },
  { iso:"NO", dial:"47",  flag:"🇳🇴", name:"Norway",               nameFr:"Norvège",            example:"412 34 567" },
  { iso:"PL", dial:"48",  flag:"🇵🇱", name:"Poland",               nameFr:"Pologne",            example:"512 345 678" },
  { iso:"PT", dial:"351", flag:"🇵🇹", name:"Portugal",             nameFr:"Portugal",           example:"912 345 678" },
  { iso:"RO", dial:"40",  flag:"🇷🇴", name:"Romania",              nameFr:"Roumanie",           example:"712 345 678" },
  { iso:"RU", dial:"7",   flag:"🇷🇺", name:"Russia",               nameFr:"Russie",             example:"912 345 6789" },
  { iso:"SM", dial:"378", flag:"🇸🇲", name:"San Marino",           nameFr:"Saint-Marin",        example:"66 66 12 12" },
  { iso:"RS", dial:"381", flag:"🇷🇸", name:"Serbia",               nameFr:"Serbie",             example:"60 1234567" },
  { iso:"SK", dial:"421", flag:"🇸🇰", name:"Slovakia",             nameFr:"Slovaquie",          example:"912 123 456" },
  { iso:"SI", dial:"386", flag:"🇸🇮", name:"Slovenia",             nameFr:"Slovénie",           example:"31 234 567" },
  { iso:"ES", dial:"34",  flag:"🇪🇸", name:"Spain",                nameFr:"Espagne",            example:"612 345 678" },
  { iso:"SE", dial:"46",  flag:"🇸🇪", name:"Sweden",               nameFr:"Suède",              example:"70 123 45 67" },
  { iso:"CH", dial:"41",  flag:"🇨🇭", name:"Switzerland",          nameFr:"Suisse",             example:"78 123 45 67" },
  { iso:"UA", dial:"380", flag:"🇺🇦", name:"Ukraine",              nameFr:"Ukraine",            example:"50 123 4567" },
  { iso:"GB", dial:"44",  flag:"🇬🇧", name:"United Kingdom",       nameFr:"Royaume-Uni",        example:"7911 123456" },
  // ── Americas ────────────────────────────────────────────────
  { iso:"AG", dial:"1268",flag:"🇦🇬", name:"Antigua & Barbuda",    nameFr:"Antigua-et-Barbuda", example:"(268) 464-1234" },
  { iso:"AR", dial:"54",  flag:"🇦🇷", name:"Argentina",            nameFr:"Argentine",          example:"11 2345 6789" },
  { iso:"AW", dial:"297", flag:"🇦🇼", name:"Aruba",                nameFr:"Aruba",              example:"560 1234" },
  { iso:"BS", dial:"1242",flag:"🇧🇸", name:"Bahamas",              nameFr:"Bahamas",            example:"(242) 359-1234" },
  { iso:"BB", dial:"1246",flag:"🇧🇧", name:"Barbados",             nameFr:"Barbade",            example:"(246) 250-1234" },
  { iso:"BZ", dial:"501", flag:"🇧🇿", name:"Belize",               nameFr:"Belize",             example:"622 1234" },
  { iso:"BM", dial:"1441",flag:"🇧🇲", name:"Bermuda",              nameFr:"Bermudes",           example:"(441) 234-1234" },
  { iso:"BO", dial:"591", flag:"🇧🇴", name:"Bolivia",              nameFr:"Bolivie",            example:"71234567" },
  { iso:"BR", dial:"55",  flag:"🇧🇷", name:"Brazil",               nameFr:"Brésil",             example:"11 91234 5678" },
  { iso:"CA", dial:"1",   flag:"🇨🇦", name:"Canada",               nameFr:"Canada",             example:"(514) 234-5678" },
  { iso:"KY", dial:"1345",flag:"🇰🇾", name:"Cayman Islands",       nameFr:"Îles Caïmans",       example:"(345) 916-1234" },
  { iso:"CL", dial:"56",  flag:"🇨🇱", name:"Chile",                nameFr:"Chili",              example:"9 1234 5678" },
  { iso:"CO", dial:"57",  flag:"🇨🇴", name:"Colombia",             nameFr:"Colombie",           example:"310 1234567" },
  { iso:"CR", dial:"506", flag:"🇨🇷", name:"Costa Rica",           nameFr:"Costa Rica",         example:"8312 3456" },
  { iso:"CU", dial:"53",  flag:"🇨🇺", name:"Cuba",                 nameFr:"Cuba",               example:"5 1234567" },
  { iso:"DM", dial:"1767",flag:"🇩🇲", name:"Dominica",             nameFr:"Dominique",          example:"(767) 225-1234" },
  { iso:"DO", dial:"1809",flag:"🇩🇴", name:"Dominican Republic",   nameFr:"République dominicaine", example:"(809) 234-5678" },
  { iso:"EC", dial:"593", flag:"🇪🇨", name:"Ecuador",              nameFr:"Équateur",           example:"99 123 4567" },
  { iso:"SV", dial:"503", flag:"🇸🇻", name:"El Salvador",          nameFr:"Salvador",           example:"7012 3456" },
  { iso:"GF", dial:"594", flag:"🇬🇫", name:"French Guiana",        nameFr:"Guyane française",   example:"694 20 12 34" },
  { iso:"GL", dial:"299", flag:"🇬🇱", name:"Greenland",            nameFr:"Groenland",          example:"22 12 34" },
  { iso:"GD", dial:"1473",flag:"🇬🇩", name:"Grenada",              nameFr:"Grenade",            example:"(473) 403-1234" },
  { iso:"GP", dial:"590", flag:"🇬🇵", name:"Guadeloupe",           nameFr:"Guadeloupe",         example:"690 30 12 34" },
  { iso:"GT", dial:"502", flag:"🇬🇹", name:"Guatemala",            nameFr:"Guatemala",          example:"5123 4567" },
  { iso:"GY", dial:"592", flag:"🇬🇾", name:"Guyana",               nameFr:"Guyana",             example:"612 3456" },
  { iso:"HT", dial:"509", flag:"🇭🇹", name:"Haiti",                nameFr:"Haïti",              example:"34 10 1234" },
  { iso:"HN", dial:"504", flag:"🇭🇳", name:"Honduras",             nameFr:"Honduras",           example:"9123 4567" },
  { iso:"JM", dial:"1876",flag:"🇯🇲", name:"Jamaica",              nameFr:"Jamaïque",           example:"(876) 210-1234" },
  { iso:"MQ", dial:"596", flag:"🇲🇶", name:"Martinique",           nameFr:"Martinique",         example:"696 20 12 34" },
  { iso:"MX", dial:"52",  flag:"🇲🇽", name:"Mexico",               nameFr:"Mexique",            example:"1 234 567 8901" },
  { iso:"MS", dial:"1664",flag:"🇲🇸", name:"Montserrat",           nameFr:"Montserrat",         example:"(664) 492-1234" },
  { iso:"NI", dial:"505", flag:"🇳🇮", name:"Nicaragua",            nameFr:"Nicaragua",          example:"8123 4567" },
  { iso:"PA", dial:"507", flag:"🇵🇦", name:"Panama",               nameFr:"Panama",             example:"6123 4567" },
  { iso:"PY", dial:"595", flag:"🇵🇾", name:"Paraguay",             nameFr:"Paraguay",           example:"961 456789" },
  { iso:"PE", dial:"51",  flag:"🇵🇪", name:"Peru",                 nameFr:"Pérou",              example:"912 345 678" },
  { iso:"PR", dial:"1787",flag:"🇵🇷", name:"Puerto Rico",          nameFr:"Porto Rico",         example:"(787) 234-5678" },
  { iso:"KN", dial:"1869",flag:"🇰🇳", name:"Saint Kitts & Nevis",  nameFr:"Saint-Kitts-et-Nevis", example:"(869) 765-2917" },
  { iso:"LC", dial:"1758",flag:"🇱🇨", name:"Saint Lucia",          nameFr:"Sainte-Lucie",       example:"(758) 284-5678" },
  { iso:"VC", dial:"1784",flag:"🇻🇨", name:"Saint Vincent",        nameFr:"Saint-Vincent",      example:"(784) 430-1234" },
  { iso:"SR", dial:"597", flag:"🇸🇷", name:"Suriname",             nameFr:"Suriname",           example:"741 2345" },
  { iso:"TT", dial:"1868",flag:"🇹🇹", name:"Trinidad & Tobago",    nameFr:"Trinité-et-Tobago",  example:"(868) 291-1234" },
  { iso:"TC", dial:"1649",flag:"🇹🇨", name:"Turks & Caicos",       nameFr:"Îles Turques",       example:"(649) 231-1234" },
  { iso:"US", dial:"1",   flag:"🇺🇸", name:"United States",        nameFr:"États-Unis",         example:"(555) 234-5678" },
  { iso:"UY", dial:"598", flag:"🇺🇾", name:"Uruguay",              nameFr:"Uruguay",            example:"94 231 234" },
  { iso:"VE", dial:"58",  flag:"🇻🇪", name:"Venezuela",            nameFr:"Venezuela",          example:"412 1234567" },
  // ── Middle East ─────────────────────────────────────────────
  { iso:"BH", dial:"973", flag:"🇧🇭", name:"Bahrain",              nameFr:"Bahreïn",            example:"3600 0000" },
  { iso:"IQ", dial:"964", flag:"🇮🇶", name:"Iraq",                 nameFr:"Irak",               example:"791 234 5678" },
  { iso:"IR", dial:"98",  flag:"🇮🇷", name:"Iran",                 nameFr:"Iran",               example:"912 345 6789" },
  { iso:"IL", dial:"972", flag:"🇮🇱", name:"Israel",               nameFr:"Israël",             example:"50 234 5678" },
  { iso:"JO", dial:"962", flag:"🇯🇴", name:"Jordan",               nameFr:"Jordanie",           example:"7 9012 3456" },
  { iso:"KW", dial:"965", flag:"🇰🇼", name:"Kuwait",               nameFr:"Koweït",             example:"500 12345" },
  { iso:"LB", dial:"961", flag:"🇱🇧", name:"Lebanon",              nameFr:"Liban",              example:"71 123 456" },
  { iso:"OM", dial:"968", flag:"🇴🇲", name:"Oman",                 nameFr:"Oman",               example:"9212 3456" },
  { iso:"PS", dial:"970", flag:"🇵🇸", name:"Palestine",            nameFr:"Palestine",          example:"59 234 5678" },
  { iso:"QA", dial:"974", flag:"🇶🇦", name:"Qatar",                nameFr:"Qatar",              example:"3312 3456" },
  { iso:"SA", dial:"966", flag:"🇸🇦", name:"Saudi Arabia",         nameFr:"Arabie Saoudite",    example:"51 234 5678" },
  { iso:"SY", dial:"963", flag:"🇸🇾", name:"Syria",                nameFr:"Syrie",              example:"944 567 890" },
  { iso:"AE", dial:"971", flag:"🇦🇪", name:"UAE",                  nameFr:"Émirats Arabes",     example:"50 123 4567" },
  { iso:"YE", dial:"967", flag:"🇾🇪", name:"Yemen",                nameFr:"Yémen",              example:"712 345 678" },
  // ── Asia ────────────────────────────────────────────────────
  { iso:"AF", dial:"93",  flag:"🇦🇫", name:"Afghanistan",          nameFr:"Afghanistan",        example:"70 012 3456" },
  { iso:"AM", dial:"374", flag:"🇦🇲", name:"Armenia",              nameFr:"Arménie",            example:"77 123456" },
  { iso:"AZ", dial:"994", flag:"🇦🇿", name:"Azerbaijan",           nameFr:"Azerbaïdjan",        example:"40 123 45 67" },
  { iso:"BD", dial:"880", flag:"🇧🇩", name:"Bangladesh",           nameFr:"Bangladesh",         example:"1812 345678" },
  { iso:"BT", dial:"975", flag:"🇧🇹", name:"Bhutan",              nameFr:"Bhoutan",            example:"17 123 456" },
  { iso:"BN", dial:"673", flag:"🇧🇳", name:"Brunei",              nameFr:"Brunéi",             example:"712 3456" },
  { iso:"KH", dial:"855", flag:"🇰🇭", name:"Cambodia",            nameFr:"Cambodge",           example:"12 345 678" },
  { iso:"CN", dial:"86",  flag:"🇨🇳", name:"China",               nameFr:"Chine",              example:"131 2345 6789" },
  { iso:"GE", dial:"995", flag:"🇬🇪", name:"Georgia",             nameFr:"Géorgie",            example:"599 12 34 56" },
  { iso:"HK", dial:"852", flag:"🇭🇰", name:"Hong Kong",           nameFr:"Hong Kong",          example:"5123 4567" },
  { iso:"IN", dial:"91",  flag:"🇮🇳", name:"India",               nameFr:"Inde",               example:"98765 43210" },
  { iso:"ID", dial:"62",  flag:"🇮🇩", name:"Indonesia",           nameFr:"Indonésie",          example:"812 3456 7890" },
  { iso:"JP", dial:"81",  flag:"🇯🇵", name:"Japan",               nameFr:"Japon",              example:"90 1234 5678" },
  { iso:"KZ", dial:"7",   flag:"🇰🇿", name:"Kazakhstan",          nameFr:"Kazakhstan",         example:"701 234 5678" },
  { iso:"KP", dial:"850", flag:"🇰🇵", name:"North Korea",         nameFr:"Corée du Nord",      example:"191 234 5678" },
  { iso:"KR", dial:"82",  flag:"🇰🇷", name:"South Korea",         nameFr:"Corée du Sud",       example:"10 1234 5678" },
  { iso:"KG", dial:"996", flag:"🇰🇬", name:"Kyrgyzstan",          nameFr:"Kirghizistan",       example:"700 123 456" },
  { iso:"LA", dial:"856", flag:"🇱🇦", name:"Laos",                nameFr:"Laos",               example:"20 23 123 456" },
  { iso:"MO", dial:"853", flag:"🇲🇴", name:"Macau",               nameFr:"Macao",              example:"6612 3456" },
  { iso:"MY", dial:"60",  flag:"🇲🇾", name:"Malaysia",            nameFr:"Malaisie",           example:"12 345 6789" },
  { iso:"MV", dial:"960", flag:"🇲🇻", name:"Maldives",            nameFr:"Maldives",           example:"771 2345" },
  { iso:"MN", dial:"976", flag:"🇲🇳", name:"Mongolia",            nameFr:"Mongolie",           example:"8812 3456" },
  { iso:"MM", dial:"95",  flag:"🇲🇲", name:"Myanmar",             nameFr:"Myanmar",            example:"9 212 3456" },
  { iso:"NP", dial:"977", flag:"🇳🇵", name:"Nepal",               nameFr:"Népal",              example:"981 234567" },
  { iso:"PK", dial:"92",  flag:"🇵🇰", name:"Pakistan",            nameFr:"Pakistan",           example:"301 2345678" },
  { iso:"PH", dial:"63",  flag:"🇵🇭", name:"Philippines",         nameFr:"Philippines",        example:"905 123 4567" },
  { iso:"SG", dial:"65",  flag:"🇸🇬", name:"Singapore",           nameFr:"Singapour",          example:"8123 4567" },
  { iso:"LK", dial:"94",  flag:"🇱🇰", name:"Sri Lanka",           nameFr:"Sri Lanka",          example:"71 234 5678" },
  { iso:"TW", dial:"886", flag:"🇹🇼", name:"Taiwan",              nameFr:"Taïwan",             example:"912 345 678" },
  { iso:"TJ", dial:"992", flag:"🇹🇯", name:"Tajikistan",          nameFr:"Tadjikistan",        example:"917 12 3456" },
  { iso:"TH", dial:"66",  flag:"🇹🇭", name:"Thailand",            nameFr:"Thaïlande",          example:"81 234 5678" },
  { iso:"TL", dial:"670", flag:"🇹🇱", name:"Timor-Leste",         nameFr:"Timor oriental",     example:"7721 2345" },
  { iso:"TR", dial:"90",  flag:"🇹🇷", name:"Turkey",              nameFr:"Turquie",            example:"532 123 45 67" },
  { iso:"TM", dial:"993", flag:"🇹🇲", name:"Turkmenistan",        nameFr:"Turkménistan",       example:"65 123456" },
  { iso:"UZ", dial:"998", flag:"🇺🇿", name:"Uzbekistan",          nameFr:"Ouzbékistan",        example:"90 123 45 67" },
  { iso:"VN", dial:"84",  flag:"🇻🇳", name:"Vietnam",             nameFr:"Viêt Nam",           example:"91 234 56 78" },
  // ── Oceania ─────────────────────────────────────────────────
  { iso:"AU", dial:"61",  flag:"🇦🇺", name:"Australia",           nameFr:"Australie",          example:"412 345 678" },
  { iso:"FJ", dial:"679", flag:"🇫🇯", name:"Fiji",                nameFr:"Fidji",              example:"701 2345" },
  { iso:"GU", dial:"1671",flag:"🇬🇺", name:"Guam",                nameFr:"Guam",               example:"(671) 300-1234" },
  { iso:"KI", dial:"686", flag:"🇰🇮", name:"Kiribati",            nameFr:"Kiribati",           example:"72012345" },
  { iso:"MH", dial:"692", flag:"🇲🇭", name:"Marshall Islands",    nameFr:"Îles Marshall",      example:"235 1234" },
  { iso:"FM", dial:"691", flag:"🇫🇲", name:"Micronesia",          nameFr:"Micronésie",         example:"320 1234" },
  { iso:"NR", dial:"674", flag:"🇳🇷", name:"Nauru",               nameFr:"Nauru",              example:"555 1234" },
  { iso:"NC", dial:"687", flag:"🇳🇨", name:"New Caledonia",       nameFr:"Nouvelle-Calédonie", example:"75 12 34" },
  { iso:"NZ", dial:"64",  flag:"🇳🇿", name:"New Zealand",         nameFr:"Nouvelle-Zélande",   example:"21 234 5678" },
  { iso:"PW", dial:"680", flag:"🇵🇼", name:"Palau",               nameFr:"Palaos",             example:"620 1234" },
  { iso:"PG", dial:"675", flag:"🇵🇬", name:"Papua New Guinea",    nameFr:"Papouasie-Nouvelle-Guinée", example:"681 2345" },
  { iso:"WS", dial:"685", flag:"🇼🇸", name:"Samoa",               nameFr:"Samoa",              example:"72 12345" },
  { iso:"SB", dial:"677", flag:"🇸🇧", name:"Solomon Islands",     nameFr:"Îles Salomon",       example:"74 21234" },
  { iso:"TO", dial:"676", flag:"🇹🇴", name:"Tonga",               nameFr:"Tonga",              example:"771 5123" },
  { iso:"TV", dial:"688", flag:"🇹🇻", name:"Tuvalu",              nameFr:"Tuvalu",             example:"901 234" },
  { iso:"VU", dial:"678", flag:"🇻🇺", name:"Vanuatu",             nameFr:"Vanuatu",            example:"591 2345" },
  // ── Special / Territories ────────────────────────────────────
  { iso:"PF", dial:"689", flag:"🇵🇫", name:"French Polynesia",    nameFr:"Polynésie française",example:"87 12 34 56" },
  { iso:"PM", dial:"508", flag:"🇵🇲", name:"Saint Pierre & Miquelon", nameFr:"Saint-Pierre-et-Miquelon", example:"55 12 34" },
  { iso:"VA", dial:"379", flag:"🇻🇦", name:"Vatican City",        nameFr:"Vatican",            example:"6 698 85100" },
];

// ── Lookup helpers ────────────────────────────────────────────

export function findCountryByISO(iso: string): Country | undefined {
  return COUNTRIES.find(c => c.iso === iso.toUpperCase());
}

export function findCountryByDial(dial: string): Country | undefined {
  // Prefer exact match, sorted by longest first to avoid "1" matching before "1268"
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  return sorted.find(c => c.dial === dial);
}

export function detectDefaultCountry(): Country {
  if (typeof navigator === "undefined") return COUNTRIES[0]; // SSR → SN
  const lang   = navigator.language ?? "fr-SN";
  const region = lang.split("-")[1]?.toUpperCase();
  if (region) {
    const found = findCountryByISO(region);
    if (found) return found;
  }
  return COUNTRIES[0]; // default: Sénégal
}

// ── E.164 utilities ───────────────────────────────────────────

export function toE164(dial: string, local: string): string {
  return `+${dial}${local.replace(/\D/g, "")}`;
}

export function isValidLocalNumber(local: string, country: Country): boolean {
  const digits = local.replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 15) return false;
  if (country.pattern) return country.pattern.test(digits);
  return digits.length >= 5;
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{4,14}$/.test(phone.replace(/\s/g, ""));
}

export function normalizePhone(raw: string, dial = "221"): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith(dial) && digits.length > dial.length) return `+${digits}`;
  return `+${dial}${digits}`;
}

export function splitE164(e164: string): { country: Country; local: string } {
  const digits = e164.replace(/^\+/, "");
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial)) return { country: c, local: digits.slice(c.dial.length) };
  }
  return { country: COUNTRIES[0], local: digits };
}
