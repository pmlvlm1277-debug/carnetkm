/* ============================================================
   CONFIG – forfaits et produits (MISSION-CARNETKM-002)
   ============================================================
   Forfaits : Gratuit 12 trajets/mois, Plus 60 trajets/mois (4,99 $ CA/mois), Pro illimité (9,99 $ CA/mois).
   Les limites portent sur le MOIS CALENDAIRE DE LA DATE DU TRAJET (date locale saisie, sans conversion de fuseau).
   Produits Gumroad : seul le produit d'origine existe. Les produits Plus et Pro restent vides tant que le
   propriétaire ne les a pas créés (aucune création ni modification Gumroad dans cette mission) : ils s'affichent
   « Bientôt » et ne sont pas achetables dans l'application. */
const CONFIG = {
  plans: {
    free: { trips: 12 },
    plus: { trips: 60, price: { fr: "4,99 $", en: "$4.99" } },
    pro:  { trips: Infinity, price: { fr: "9,99 $", en: "$9.99" } }
  },
  products: [
    // Abonnement d'origine (« Pro » 4,99 $/mois, trajets illimités). Les abonnés existants gardent tous leurs droits :
    // droits du forfait Pro, au même prix, sans modification de leur contrat. Plus vendu dans l'application.
    { slot: "legacy", plan: "pro", id: "DHMf78a9yPLxm2vB_mFe_w==", url: "" },
    { slot: "plus",   plan: "plus", id: "", url: "" },   // à remplir après création du produit Plus par le propriétaire
    { slot: "pro",    plan: "pro",  id: "", url: "" }    // à remplir après création du produit Pro par le propriétaire
  ],
  // Offre bundle SharpLaughs : 3 mois calendaires de Plus, sans carte ni renouvellement.
  // mode "off" (défaut publié) | "simulation" (tests et démonstration avec codes fictifs DEMO-…, aucun appel réseau).
  // Le mode réel exige une validation des droits hors client (voir docs/CARNETKM-002-architecture.md).
  bundle: { mode: "off", plan: "plus", months: 3 },
  // Service de droits (MISSION-CARNETKM-002-B). Vide = inactif. À remplir seulement après déploiement autorisé :
  // endpoint "https://…" (à ajouter aussi dans connect-src de la CSP) et clés PUBLIQUES {kid: JWK P-256}. Aucun secret ici.
  // Avec un endpoint, bundle.mode "server" active la réclamation par commande Fourthwall, et les licences passent par le service.
  entitlements: { endpoint: "", keys: {} },
  // Accès de lancement (tout ouvert si aucun produit configuré) : désactivé. Ne s'active que par ce drapeau explicite.
  launchAccess: false
};
// Hôtes de développement : seuls endroits où le mode simulation peut fonctionner (jamais en production).
const DEV_HOST = h => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(h);

/* ---------- i18n ---------- */
const T = {
fr:{
 hero_h:"Ton registre de kilométrage, prêt pour l'impôt",
 hero_p:"Note tes trajets et tes dépenses d'auto en dix secondes. CarnetKM calcule ta portion affaires et te sort un registre propre pour ta déclaration ou ton comptable.",
 odo_cap:"Kilomètres d'affaires en {y}", odo_sub_none:"Ajoute un premier trajet pour partir le compteur.", odo_sub:"{n} trajets, portion affaires {p}",
 tab_trips:"Trajets", tab_exp:"Dépenses", tab_sum:"Sommaire", tab_pro:"Forfaits",
 trips_h:"Ajouter un trajet", f_date:"Date", f_type:"Type", type_b:"Affaires", type_p:"Perso",
 f_purpose:"But du déplacement", f_from:"Départ", f_to:"Destination", f_km:"Kilomètres",
 odo_more:"Calculer avec l'odomètre", f_o1:"Odomètre au départ", f_o2:"Odomètre à l'arrivée",
 f_fav:"Garder comme trajet fréquent", add_trip:"Ajouter le trajet",
 purposes:["Livraison Uber Eats","Livraison DoorDash","Livraison Skip","Livraison de colis","Route de livraison","Transport de passagers","Rencontre client","Achat de fournitures","Banque ou comptable"],
 err_date:"Choisis une date.", err_km:"Entre les kilomètres, ou l'odomètre au départ et à l'arrivée.", err_odo:"L'odomètre à l'arrivée doit être plus grand qu'au départ.", err_dest:"Entre la destination : c'est exigé dans un registre de déplacements d'affaires.", err_purpose:"Entre le but du déplacement : c'est exigé dans un registre de déplacements d'affaires.",
 trip_added:"Trajet ajouté.", limit:"Tu as atteint {n} trajets en {m}, la limite du forfait {plan}. Tes trajets restent tous consultables. Change de forfait dans l'onglet Forfaits pour en ajouter d'autres ce mois-là.",
 quota:"Forfait {plan} : {n} sur {max} trajets en {m}.", quota_inf:"Forfait {plan} : {n} trajets en {m}, sans limite.", quota_over:"Ce mois compte plus de trajets que ton forfait actuel n'en permet ({n} sur {max}). Ils restent tous consultables et inclus dans ton sommaire et ta sauvegarde.",
 no_trips:"Aucun trajet pour l'instant. Ajoute celui d'aujourd'hui pour commencer ton registre.", del:"Supprimer", del_sure:"Confirmer la suppression",
 biz:"affaires", perso:"Perso", km:"km",
 exp_h:"Ajouter une dépense", f_cat:"Catégorie", f_amt:"Montant payé ($)", f_note:"Note (facultatif)", f_tax:"Le montant inclut les taxes de vente", add_exp:"Ajouter la dépense",
 hint_pro:"Comptée selon ta portion affaires.", hint_full:"Comptée à 100 % : dépense d'affaires seulement.",
 err_amt:"Entre un montant plus grand que zéro.", exp_added:"Dépense ajoutée.", no_exp:"Aucune dépense pour l'instant. Garde aussi tes reçus : il faut les conserver six ans.",
 cats:{fuel:"Essence ou recharge",maint:"Entretien et réparations",ins:"Assurance",plate:"Immatriculation et permis",lease:"Location du véhicule",interest:"Intérêts sur le prêt auto",wash:"Lavage",othv:"Autre frais du véhicule",park:"Stationnement et péages (affaires)",phone:"Cellulaire (part affaires)",gear:"Équipement de livraison",fees:"Frais de plateforme",othb:"Autre dépense d'affaires"},
 sum_h:"Sommaire de l'année", f_year:"Année", f_yo1:"Odomètre au 1er janvier", f_yo2:"Odomètre au 31 décembre", f_name:"Ton nom (pour le registre)", f_veh:"Véhicule", f_prov:"Province", f_reg:"Je suis inscrit aux taxes de vente",
 s_biz:"Kilomètres d'affaires", s_tot:"Kilomètres totaux de l'année", s_tot_est:"Kilomètres totaux (trajets notés)", s_pct:"Portion affaires", s_veh:"Frais du véhicule", s_vehd:"Frais du véhicule déductibles", s_full:"Autres dépenses d'affaires", s_tax:"Taxes de vente récupérables (estimation)", s_gst:"dont TPS", s_qst:"dont TVQ", s_ded:"Dépenses déductibles estimées",
 warn_odo:"Entre ton odomètre au début et à la fin de l'année pour une portion affaires exacte. En attendant, le calcul utilise seulement les trajets notés.", warn_odo_bad:"L'odomètre de fin d'année est plus petit que celui du début. Vérifie les deux chiffres.", warn_over:"Tes kilomètres d'affaires dépassent le total de l'odomètre. Vérifie tes entrées.",
 sum_note:"Estimation pour t'aider à préparer ta déclaration. L'amortissement du véhicule (DPA) et les plafonds sur la location et les intérêts ne sont pas calculés ici. Valide les montants avec ton comptable.",
 b_print:"Imprimer le registre (PDF)", b_csvt:"Exporter les trajets (CSV)", b_csve:"Exporter les dépenses (CSV)", pro_only:"Le registre PDF et les exports CSV font partie des forfaits Plus et Pro. Ta sauvegarde reste gratuite dans l'onglet Forfaits.",
 pro_h:"Forfaits", free_t:"Gratuit", per_month:"CA par mois", plan_free:"Gratuit", plan_plus:"Plus", plan_pro:"Pro", plan_legacy:"Pro (abonnement d'origine)",
 free_list:["{n} trajets par mois","Dépenses illimitées","Sommaire de l'année à l'écran","Sauvegarde et restauration de tes données"],
 plus_list:["{n} trajets par mois","Tout le forfait Gratuit","Registre imprimable en PDF","Export CSV pour ton comptable","Trajets fréquents en un clic","Taxes récupérables détaillées"],
 pro_list:["Trajets illimités","Tout le forfait Plus"],
 buy_plus:"S'abonner à Plus", buy_pro:"S'abonner à Pro", soon:"Bientôt", current:"Ton forfait",
 launch:"Accès de lancement : toutes les fonctions sont ouvertes pendant que les abonnements se mettent en place.", plan_on:"Forfait actif : {plan}.", pro_on:"Ton abonnement est actif sur cet appareil. Merci!", pro_off:"Tu utilises le forfait Gratuit.",
 legacy_on:"Abonnement d'origine : tu gardes les trajets illimités et toutes les fonctions, au même prix, tant que ton abonnement reste actif.",
 trial_on:"Offre bundle SharpLaughs : forfait {plan} jusqu'au {d} inclusivement. Aucun renouvellement automatique.",
 trial_end:"Ton offre bundle SharpLaughs a pris fin le {d}. Tu reviens au forfait Gratuit; toutes tes données restent là. Tu peux t'abonner quand tu veux.",
 bun_h:"Acheteur du bundle SharpLaughs?", bun_p:"Trois mois de CarnetKM Plus offerts, à compter de l'activation. Sans carte de crédit, sans renouvellement automatique : à la fin, tu reviens au forfait Gratuit, sauf si tu choisis de t'abonner.",
 bun_soon:"L'activation de l'offre arrive bientôt.", bun_sim:"Mode simulation : codes fictifs seulement (DEMO-…), aucune vérification réelle.", bun_l:"Code d'activation du bundle", bun_b:"Activer mes 3 mois Plus",
 bun_srv:"Entre le numéro de ta commande Fourthwall et le courriel utilisé pour l'achat. Seuls ces deux renseignements sont envoyés pour vérifier ton achat : tes trajets, tes dépenses et tes renseignements fiscaux restent sur ton appareil.",
 bun_order:"Numéro de commande Fourthwall", bun_email:"Courriel utilisé pour la commande", bun_claim:"Activer mes 3 mois Plus", bun_rec_l:"Code de récupération (nouvel appareil)", bun_rec_b:"Récupérer mon offre",
 bun_rec_show:"Ton code de récupération : {c}. Garde-le en lieu sûr : il réactive ton offre sur un autre appareil, sans la redémarrer.",
 bun_notfound:"Aucune commande admissible ne correspond à ce numéro et à ce courriel.", bun_revoked:"Cette commande a été annulée ou remboursée : l'offre n'est plus disponible.", bun_expired:"Cette offre est terminée.", bun_devices:"Cette offre a atteint le nombre maximal d'appareils.", bun_rate:"Trop d'essais. Réessaie dans une heure.", bun_net:"Impossible de joindre le service. Vérifie ta connexion et réessaie.",
 bun_ok:"Offre activée : forfait {plan} jusqu'au {d} inclusivement.", bun_bad:"Ce code n'est pas valide.", bun_used:"Ce code a déjà été utilisé.", bun_once:"Une offre bundle a déjà été activée sur cet appareil.", bun_empty:"Entre ton code d'activation.",
 lic_devices:"Cette clé est déjà utilisée sur le nombre maximal d'appareils.",
 lic_h:"Tu es déjà abonné?", lic_l:"Clé de licence reçue par courriel", lic_b:"Activer mon abonnement", lic_checking:"Vérification…", lic_ok:"Abonnement activé.", lic_bad:"Cette clé n'est pas valide pour CarnetKM.", lic_ended:"Cet abonnement est terminé. Réabonne-toi pour le réactiver.", lic_net:"Impossible de joindre le serveur de licences. Vérifie ta connexion et réessaie.", lic_empty:"Colle ta clé de licence.", lic_remove:"Retirer la clé de cet appareil",
 bk_h:"Tes données", bk_p:"Tout reste dans le navigateur de cet appareil. Fais une sauvegarde de temps en temps, surtout avant de changer de téléphone. La sauvegarde ne contient ni ta clé de licence ni ton offre bundle : garde le courriel de Gumroad pour réactiver ton abonnement.", bk_save:"Sauvegarder mes données", bk_load:"Restaurer une sauvegarde", bk_ok:"Sauvegarde restaurée.", bk_bad:"Ce fichier n'est pas une sauvegarde CarnetKM.", bk_confirm:"Remplacer les données de cet appareil par celles de la sauvegarde?", bk_yes:"Remplacer", bk_no:"Annuler",
 faq_h:"Questions fréquentes",
 faq:[
  ["Qu'est-ce qu'un registre de kilométrage doit contenir?","Pour chaque déplacement d'affaires : la date, la destination, le but du déplacement et le nombre de kilomètres parcourus. Note aussi l'odomètre de ton véhicule au début et à la fin de l'année, pour connaître ton kilométrage total. CarnetKM te demande exactement ces renseignements."],
  ["Je suis travailleur autonome. Est-ce que je peux déduire 0,73 $ du kilomètre?","Non. Ce taux (0,73 $ pour les 5 000 premiers kilomètres en 2026, puis 0,67 $) sert aux allocations qu'un employeur verse à ses employés. Un travailleur autonome déduit ses dépenses réelles de véhicule, multipliées par sa portion affaires : kilomètres d'affaires divisés par kilomètres totaux de l'année."],
  ["Est-ce que le trajet entre la maison et le travail compte?","En général, non : aller de chez toi à ton lieu de travail habituel est un déplacement personnel. Si ton domicile est ton lieu d'affaires principal, les déplacements vers tes clients ou tes livraisons sont des déplacements d'affaires. En cas de doute, demande à ton comptable."],
  ["Pourquoi il n'y a pas de suivi GPS?","Parce que tu n'en as pas besoin pour avoir un registre valable, et qu'un GPS qui roule en arrière-plan vide ta batterie et te suit partout. Ici, tu notes ta route à la fin de ta journée : odomètre au départ, odomètre à l'arrivée, c'est réglé."],
  ["Où sont gardées mes données?","Dans le navigateur de ton appareil, nulle part ailleurs. Il n'y a pas de compte à créer. Seule exception : si tu actives un abonnement, ta clé de licence est vérifiée auprès de Gumroad, notre service de paiement; tes trajets et tes dépenses ne quittent jamais ton appareil. Utilise le bouton de sauvegarde dans l'onglet Forfaits pour garder une copie."],
  ["Combien de temps dois-je garder mon registre et mes reçus?","Six ans après la fin de l'année d'imposition visée. Exporte ton registre en PDF à la fin de chaque année et range-le avec tes reçus."]
 ],
 foot_1:"CarnetKM est un outil d'aide à la tenue de registre. Il ne remplace pas les conseils d'un comptable ou d'un fiscaliste, et il n'est affilié ni à Revenu Québec ni à l'Agence du revenu du Canada.",
 foot_2:"Limites 2026 fixées par le ministère des Finances du Canada : coût en capital de 39 000 $ pour un véhicule de tourisme, location déductible de 1 100 $ par mois, intérêts déductibles de 350 $ par mois.",
 foot_3:"Un produit SharpLaughs.",
 p_title:"Registre de kilométrage", p_name:"Nom", p_veh:"Véhicule", p_year:"Année", p_o1:"Odomètre au début", p_o2:"Odomètre à la fin", p_gen:"Produit avec CarnetKM le {d}. Conserver six ans avec les reçus.",
 c_date:"Date", c_type:"Type", c_from:"Départ", c_to:"Destination", c_purpose:"But", c_km:"Km", c_o1:"Odo départ", c_o2:"Odo arrivée", c_cat:"Catégorie", c_amt:"Montant", c_taxi:"Taxes incluses", c_note:"Note", yes:"oui", no:"non",
 provs:{QC:"Québec",ON:"Ontario",BC:"Colombie-Britannique",AB:"Alberta",MB:"Manitoba",SK:"Saskatchewan",NS:"Nouvelle-Écosse",NB:"Nouveau-Brunswick",NL:"Terre-Neuve-et-Labrador",PE:"Île-du-Prince-Édouard",TR:"Territoires"}
},
en:{
 hero_h:"Your mileage logbook, ready for tax time",
 hero_p:"Log trips and car expenses in ten seconds. CarnetKM works out your business-use share and gives you a clean logbook for your return or your accountant.",
 odo_cap:"Business kilometres in {y}", odo_sub_none:"Add a first trip to start the counter.", odo_sub:"{n} trips, business use {p}",
 tab_trips:"Trips", tab_exp:"Expenses", tab_sum:"Summary", tab_pro:"Plans",
 trips_h:"Add a trip", f_date:"Date", f_type:"Type", type_b:"Business", type_p:"Personal",
 f_purpose:"Purpose of the trip", f_from:"From", f_to:"Destination", f_km:"Kilometres",
 odo_more:"Work it out from the odometer", f_o1:"Odometer at start", f_o2:"Odometer at end",
 f_fav:"Keep as a frequent trip", add_trip:"Add trip",
 purposes:["Uber Eats delivery","DoorDash delivery","Skip delivery","Parcel delivery","Delivery route","Passenger rides","Client meeting","Supplies run","Bank or accountant"],
 err_date:"Pick a date.", err_km:"Enter the kilometres, or the odometer at start and end.", err_odo:"The end odometer must be higher than the start.", err_dest:"Enter the destination: a business logbook requires it.", err_purpose:"Enter the purpose of the trip: a business logbook requires it.",
 trip_added:"Trip added.", limit:"You've reached {n} trips in {m}, the limit of the {plan} plan. All your trips stay viewable. Change plans in the Plans tab to add more for that month.",
 quota:"{plan} plan: {n} of {max} trips in {m}.", quota_inf:"{plan} plan: {n} trips in {m}, no limit.", quota_over:"This month has more trips than your current plan allows ({n} of {max}). They all stay viewable and included in your summary and backup.",
 no_trips:"No trips yet. Add today's to start your logbook.", del:"Delete", del_sure:"Confirm delete",
 biz:"business", perso:"Personal", km:"km",
 exp_h:"Add an expense", f_cat:"Category", f_amt:"Amount paid ($)", f_note:"Note (optional)", f_tax:"The amount includes sales tax", add_exp:"Add expense",
 hint_pro:"Counted at your business-use share.", hint_full:"Counted at 100%: business-only expense.",
 err_amt:"Enter an amount greater than zero.", exp_added:"Expense added.", no_exp:"No expenses yet. Keep your receipts too: you need to hold on to them for six years.",
 cats:{fuel:"Fuel or charging",maint:"Maintenance and repairs",ins:"Insurance",plate:"Licence and registration",lease:"Vehicle lease",interest:"Car loan interest",wash:"Car wash",othv:"Other vehicle cost",park:"Parking and tolls (business)",phone:"Cell phone (business share)",gear:"Delivery gear",fees:"Platform fees",othb:"Other business expense"},
 sum_h:"Year summary", f_year:"Year", f_yo1:"Odometer on January 1", f_yo2:"Odometer on December 31", f_name:"Your name (for the logbook)", f_veh:"Vehicle", f_prov:"Province", f_reg:"I'm registered for sales tax",
 s_biz:"Business kilometres", s_tot:"Total kilometres for the year", s_tot_est:"Total kilometres (logged trips)", s_pct:"Business use", s_veh:"Vehicle costs", s_vehd:"Deductible vehicle costs", s_full:"Other business expenses", s_tax:"Recoverable sales tax (estimate)", s_gst:"of which GST", s_qst:"of which QST", s_ded:"Estimated deductible expenses",
 warn_odo:"Enter your odometer at the start and end of the year for an exact business-use share. Until then, the math uses logged trips only.", warn_odo_bad:"The year-end odometer is lower than the start. Check both numbers.", warn_over:"Your business kilometres are higher than the odometer total. Check your entries.",
 sum_note:"An estimate to help you prepare your return. Capital cost allowance (CCA) and the caps on lease and interest costs are not calculated here. Confirm the amounts with your accountant.",
 b_print:"Print the logbook (PDF)", b_csvt:"Export trips (CSV)", b_csve:"Export expenses (CSV)", pro_only:"The PDF logbook and CSV exports are part of the Plus and Pro plans. Your backup stays free in the Plans tab.",
 pro_h:"Plans", free_t:"Free", per_month:"CAD per month", plan_free:"Free", plan_plus:"Plus", plan_pro:"Pro", plan_legacy:"Pro (original subscription)",
 free_list:["{n} trips per month","Unlimited expenses","Year summary on screen","Backup and restore of your data"],
 plus_list:["{n} trips per month","Everything in Free","Printable PDF logbook","CSV export for your accountant","One-tap frequent trips","Detailed recoverable tax"],
 pro_list:["Unlimited trips","Everything in Plus"],
 buy_plus:"Subscribe to Plus", buy_pro:"Subscribe to Pro", soon:"Coming soon", current:"Your plan",
 launch:"Launch access: every feature is open while subscriptions are being set up.", plan_on:"Active plan: {plan}.", pro_on:"Your subscription is active on this device. Thank you!", pro_off:"You're on the Free plan.",
 legacy_on:"Original subscription: you keep unlimited trips and every feature, at the same price, for as long as your subscription stays active.",
 trial_on:"SharpLaughs bundle offer: {plan} plan through {d}. No automatic renewal.",
 trial_end:"Your SharpLaughs bundle offer ended on {d}. You're back on the Free plan; all your data is still here. You can subscribe whenever you like.",
 bun_h:"Bought the SharpLaughs bundle?", bun_p:"Three months of CarnetKM Plus on us, starting when you activate. No credit card, no automatic renewal: at the end you go back to Free, unless you choose to subscribe.",
 bun_soon:"Offer activation is coming soon.", bun_sim:"Simulation mode: test codes only (DEMO-…), no real check.", bun_l:"Bundle activation code", bun_b:"Activate my 3 months of Plus",
 bun_srv:"Enter your Fourthwall order number and the email used for the purchase. Only these two details are sent to check your purchase: your trips, expenses and tax details stay on your device.",
 bun_order:"Fourthwall order number", bun_email:"Email used for the order", bun_claim:"Activate my 3 months of Plus", bun_rec_l:"Recovery code (new device)", bun_rec_b:"Recover my offer",
 bun_rec_show:"Your recovery code: {c}. Keep it somewhere safe: it reactivates your offer on another device without restarting it.",
 bun_notfound:"No eligible order matches this number and email.", bun_revoked:"This order was cancelled or refunded: the offer is no longer available.", bun_expired:"This offer has ended.", bun_devices:"This offer has reached the maximum number of devices.", bun_rate:"Too many attempts. Try again in an hour.", bun_net:"Can't reach the service. Check your connection and try again.",
 bun_ok:"Offer activated: {plan} plan through {d}.", bun_bad:"This code isn't valid.", bun_used:"This code has already been used.", bun_once:"A bundle offer has already been activated on this device.", bun_empty:"Enter your activation code.",
 lic_devices:"This key is already in use on the maximum number of devices.",
 lic_h:"Already subscribed?", lic_l:"Licence key from your email receipt", lic_b:"Activate my subscription", lic_checking:"Checking…", lic_ok:"Subscription activated.", lic_bad:"This key isn't valid for CarnetKM.", lic_ended:"This subscription has ended. Subscribe again to reactivate it.", lic_net:"Can't reach the licence server. Check your connection and try again.", lic_empty:"Paste your licence key.", lic_remove:"Remove the key from this device",
 bk_h:"Your data", bk_p:"Everything stays in this device's browser. Save a backup now and then, especially before switching phones. The backup doesn't include your licence key or your bundle offer: keep the Gumroad email to reactivate your subscription.", bk_save:"Back up my data", bk_load:"Restore a backup", bk_ok:"Backup restored.", bk_bad:"This file isn't a CarnetKM backup.", bk_confirm:"Replace this device's data with the backup?", bk_yes:"Replace", bk_no:"Cancel",
 faq_h:"Common questions",
 faq:[
  ["What does a mileage logbook need to contain?","For each business trip: the date, the destination, the purpose and the number of kilometres driven. Also record your vehicle's odometer at the start and end of the year so you know your total kilometres. CarnetKM asks for exactly these details."],
  ["I'm self-employed. Can I deduct $0.73 per kilometre?","No. That rate ($0.73 for the first 5,000 kilometres in 2026, then $0.67) is for allowances an employer pays to employees. A self-employed person deducts actual vehicle expenses multiplied by the business-use share: business kilometres divided by total kilometres for the year."],
  ["Does driving from home to work count?","Usually not: going from home to your regular place of work is personal driving. If your home is your main place of business, trips to clients or deliveries are business trips. When in doubt, ask your accountant."],
  ["Why is there no GPS tracking?","Because you don't need it for a valid logbook, and a GPS running in the background drains your battery and follows you everywhere. Here you log your route at the end of the day: odometer at start, odometer at end, done."],
  ["Where is my data kept?","In your device's browser and nowhere else. There's no account to create. The one exception: if you activate a subscription, your licence key is checked with Gumroad, our payment provider; your trips and expenses never leave your device. Use the backup button in the Plans tab to keep a copy."],
  ["How long do I keep my logbook and receipts?","Six years after the end of the tax year they relate to. Export your logbook to PDF at the end of each year and file it with your receipts."]
 ],
 foot_1:"CarnetKM is a record-keeping aid. It does not replace advice from an accountant or tax professional, and it is not affiliated with Revenu Québec or the Canada Revenue Agency.",
 foot_2:"2026 limits set by the Department of Finance Canada: $39,000 capital cost for a passenger vehicle, $1,100 per month deductible lease cost, $350 per month deductible interest.",
 foot_3:"A SharpLaughs product.",
 p_title:"Mileage logbook", p_name:"Name", p_veh:"Vehicle", p_year:"Year", p_o1:"Odometer at start", p_o2:"Odometer at end", p_gen:"Produced with CarnetKM on {d}. Keep for six years with your receipts.",
 c_date:"Date", c_type:"Type", c_from:"From", c_to:"Destination", c_purpose:"Purpose", c_km:"Km", c_o1:"Odo start", c_o2:"Odo end", c_cat:"Category", c_amt:"Amount", c_taxi:"Tax included", c_note:"Note", yes:"yes", no:"no",
 provs:{QC:"Quebec",ON:"Ontario",BC:"British Columbia",AB:"Alberta",MB:"Manitoba",SK:"Saskatchewan",NS:"Nova Scotia",NB:"New Brunswick",NL:"Newfoundland and Labrador",PE:"Prince Edward Island",TR:"Territories"}
}};

/* ---------- tax tables ----------
   tot = taxes de vente totales sur le prix; rec = partie récupérable par un inscrit (TPS/TVH, + TVQ au Québec) */
const PROV = {
  QC:{tot:14.975,rec:14.975,gst:5,qst:9.975}, ON:{tot:13,rec:13}, NS:{tot:14,rec:14}, NB:{tot:15,rec:15},
  NL:{tot:15,rec:15}, PE:{tot:15,rec:15}, BC:{tot:12,rec:5}, MB:{tot:12,rec:5}, SK:{tot:11,rec:5}, AB:{tot:5,rec:5}, TR:{tot:5,rec:5}
};
/* mode p = au prorata de la portion affaires; f = 100 % affaires. tax = taxes de vente habituellement incluses */
const CATS = {
  fuel:{m:"p",tax:1}, maint:{m:"p",tax:1}, ins:{m:"p",tax:0}, plate:{m:"p",tax:0}, lease:{m:"p",tax:1}, interest:{m:"p",tax:0},
  wash:{m:"p",tax:1}, othv:{m:"p",tax:1}, park:{m:"f",tax:1}, phone:{m:"f",tax:1}, gear:{m:"f",tax:1}, fees:{m:"f",tax:0}, othb:{m:"f",tax:1}
};

/* ---------- state ---------- */
const KEY = "carnetkm.v1";
// Format de sauvegarde inchangé (v:1). « license » et « trial » sont des droits propres à l'appareil : jamais exportés ni importés.
const blank = () => ({app:"carnetkm",v:1,lang:null,settings:{name:"",vehicle:"",prov:"QC",registered:false},odo:{},trips:[],expenses:[],favs:[],license:null,trial:null,redeemed:[],device:null,ent:{lic:null,bun:null}});
let S = blank();
function load(){
  try{ const raw = localStorage.getItem(KEY); if(raw){ const o = JSON.parse(raw); if(o && o.app==="carnetkm"){
    // Les données locales passent par le même nettoyage qu'une sauvegarde importée (une ancienne importation piégée y est neutralisée).
    S = sanitizeState(o, true); S.license = sanitizeLicense(o.license); S.trial = sanitizeTrial(o.trial); S.redeemed = sanitizeRedeemed(o.redeemed);
    S.device = typeof o.device==="string" && /^[a-z0-9]{16,64}$/.test(o.device) ? o.device : null;
    const tok = v => typeof v==="string" && v.length < 4096 && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(v) ? v : null;
    S.ent = {lic: tok(o.ent && o.ent.lic), bun: tok(o.ent && o.ent.bun)};
  } } }catch(e){ S = blank(); }
  if(!S.device) S.device = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,"0")).join("");
  if(!S.lang) S.lang = (navigator.language||"fr").toLowerCase().startsWith("en") ? "en" : "fr";
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }

/* ---------- nettoyage des données (localStorage et sauvegardes importées) ---------- */
// Identifiant accepté : celui que produit uid() (base 36). Tout autre identifiant est régénéré, ainsi que les doublons.
const ID_RE = /^[a-z0-9]{1,24}$/;
function idFixer(){ const seen = new Set(); return v => { let id = typeof v==="string" && ID_RE.test(v) && !seen.has(v) ? v : uid(); while(seen.has(id)) id = uid(); seen.add(id); return id; }; }
const okDate = d => typeof d==="string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const optNum = v => (v===null || v===undefined || v==="" || !isFinite(+v)) ? null : +v;
const str = (v, n) => String(v==null ? "" : v).slice(0, n);
function sanitizeState(o, keepNullLang){
  const clean = blank(); const s = (o && typeof o.settings==="object" && o.settings) || {};
  clean.lang = o.lang==="en" ? "en" : (o.lang==="fr" ? "fr" : (keepNullLang ? null : "fr"));
  clean.settings = {name:str(s.name,60), vehicle:str(s.vehicle,60), prov:Object.prototype.hasOwnProperty.call(PROV, s.prov)?s.prov:"QC", registered:!!s.registered};
  const tid = idFixer(), eid = idFixer(), fid = idFixer();
  clean.trips = (Array.isArray(o.trips)?o.trips:[]).filter(x=>x && okDate(x.date) && isFinite(+x.km) && +x.km>0).map(x=>({id:tid(x.id),date:x.date,type:x.type==="p"?"p":"b",from:str(x.from,80),to:str(x.to,80),purpose:str(x.purpose,80),km:round1(+x.km),o1:optNum(x.o1),o2:optNum(x.o2)}));
  clean.expenses = (Array.isArray(o.expenses)?o.expenses:[]).filter(x=>x && okDate(x.date) && isFinite(+x.amount) && +x.amount>0).map(x=>({id:eid(x.id),date:x.date,cat:Object.prototype.hasOwnProperty.call(CATS, x.cat)?x.cat:"othb",amount:Math.round(+x.amount*100)/100,taxIncl:!!x.taxIncl,note:str(x.note,80)}));
  clean.favs = (Array.isArray(o.favs)?o.favs:[]).filter(x=>x && isFinite(+x.km) && +x.km>0).slice(0,30).map(x=>({id:fid(x.id),from:str(x.from,80),to:str(x.to,80),purpose:str(x.purpose,80),km:round1(+x.km),type:x.type==="p"?"p":"b"}));
  if(o.odo && typeof o.odo==="object") for(const y in o.odo){ if(/^\d{4}$/.test(y)){ const v=o.odo[y]||{}; clean.odo[y]={start:optNum(v.start),end:optNum(v.end)}; } }
  return clean;
}
function sanitizeLicense(L){
  if(!L || typeof L!=="object" || typeof L.key!=="string" || !L.key.trim()) return null;
  // Une licence enregistrée avant les nouveaux forfaits n'a pas de « slot » : c'est forcément l'abonnement d'origine.
  const slot = CONFIG.products.some(p=>p.slot===L.slot) ? L.slot : "legacy";
  return {key:L.key.trim().slice(0,100), ok:L.ok===true, verifiedAt:(typeof L.verifiedAt==="number" && isFinite(L.verifiedAt)) ? L.verifiedAt : 0, slot};
}
// Offre bundle : {plan, start, end (exclusive), source, ref}. Durée bornée à 3 mois calendaires depuis le début.
// Rappel : ce nettoyage empêche les valeurs absurdes, pas la falsification par un utilisateur technique (contrôle local).
function sanitizeTrial(x){
  if(!x || typeof x!=="object" || !okDate(x.start) || !okDate(x.end) || !PLAN_RANK[x.plan] || x.plan==="pro") return null;
  if(x.end !== addMonths(x.start, CONFIG.bundle.months)) return null;
  return {plan:x.plan, start:x.start, end:x.end, source:x.source==="bundle"?"bundle":"bundle-sim", ref:str(x.ref,64)};
}
function sanitizeRedeemed(a){ return (Array.isArray(a)?a:[]).filter(x=>typeof x==="string").slice(0,20).map(x=>x.slice(0,64)); }
// Sauvegarde exportée : tout sauf les droits (licence, offre bundle), qui restent sur cet appareil.
function exportState(){ const o = JSON.parse(JSON.stringify(S)); delete o.license; delete o.trial; delete o.redeemed; delete o.device; delete o.ent; return o; }

/* ---------- dates calendaires (chaînes AAAA-MM-JJ, heure locale de l'appareil) ---------- */
const fmtYmd = (y,m,d) => y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
// Ajoute n mois calendaires. Fin exclusive : même quantième n mois plus tard; s'il n'existe pas (31 → 30, 30 → février),
// la fin est le 1er du mois suivant, de sorte que le dernier jour du mois cible reste inclus.
function addMonths(ymdStr, n){
  const [y,m,d] = ymdStr.split("-").map(Number);
  const idx = (m-1)+n, ty = y+Math.floor(idx/12), tm = ((idx%12)+12)%12 + 1;
  const dim = new Date(ty, tm, 0).getDate();
  if(d <= dim) return fmtYmd(ty, tm, d);
  return tm===12 ? fmtYmd(ty+1, 1, 1) : fmtYmd(ty, tm+1, 1);
}
function prevDay(ymdStr){ const [y,m,d] = ymdStr.split("-").map(Number); const x = new Date(y, m-1, d-1); return fmtYmd(x.getFullYear(), x.getMonth()+1, x.getDate()); }

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const t = (k, v) => { let s = T[S.lang][k]; if(typeof s === "string" && v) for(const x in v) s = s.replace("{"+x+"}", v[x]); return s; };
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const loc = () => S.lang === "fr" ? "fr-CA" : "en-CA";
const nKm = n => new Intl.NumberFormat(loc(),{minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
const nMoney = n => new Intl.NumberFormat(loc(),{style:"currency",currency:"CAD"}).format(n);
const nPct = n => new Intl.NumberFormat(loc(),{style:"percent",maximumFractionDigits:1}).format(n);
const today = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const round1 = n => Math.round(n*10)/10;
const num = v => { const n = parseFloat(String(v).replace(",",".")); return isFinite(n) ? n : null; };
let year = new Date().getFullYear();

const PLAN_RANK = {free:0, plus:1, pro:2};
const liveProducts = () => CONFIG.products.filter(p => p.id);
function configured(){ return liveProducts().length > 0; }
const productOf = slot => CONFIG.products.find(p => p.slot===slot);
// Politique d'expiration (inchangée) : 14 jours de grâce hors ligne, revérification après 3 jours.
// Une date de vérification future (au-delà d'une tolérance d'horloge de 5 min), nulle ou invalide est refusée.
// Limite connue : ce contrôle s'exécute dans le navigateur et reste contournable par un utilisateur technique (F1 non résolu).
const LIC_GRACE = 14*864e5, LIC_RECHECK = 3*864e5, CLOCK_SKEW = 5*60e3;
function validStamp(v){ return typeof v==="number" && isFinite(v) && v > 0 && v <= Date.now() + CLOCK_SKEW; }
/* ---------- service de droits : jetons signés ES256 ----------
   Les droits ne sont acceptés que d'un jeton dont la signature est vérifiée avec une clé PUBLIQUE de CONFIG.entitlements.keys.
   Le jeton expire après 7 jours (grâce hors ligne) et se renouvelle en ligne. Les payloads vérifiés vivent en mémoire seulement.
   Limite assumée : le code client reste modifiable; la signature empêche de fabriquer des droits, pas de contourner les
   quotas et exports locaux (F1). */
const ENT = {lic:null, bun:null};
const serverMode = () => !!(CONFIG.entitlements.endpoint && Object.keys(CONFIG.entitlements.keys||{}).length);
function bundleMode(host){
  const m = CONFIG.bundle.mode;
  if(m==="simulation") return DEV_HOST(host===undefined ? location.hostname : host) ? "simulation" : "off";
  if(m==="server") return serverMode() ? "server" : "off";
  return "off";
}
const b64u = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/") + "===".slice((s.length+3)%4)), c => c.charCodeAt(0));
async function verifyJws(token){
  try{
    const [h,p,sig] = String(token).split(".");
    const head = JSON.parse(new TextDecoder().decode(b64u(h))), pay = JSON.parse(new TextDecoder().decode(b64u(p)));
    const jwk = (CONFIG.entitlements.keys||{})[head.kid];
    if(head.alg!=="ES256" || !jwk || !crypto.subtle) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, {name:"ECDSA", namedCurve:"P-256"}, false, ["verify"]);
    const ok = await crypto.subtle.verify({name:"ECDSA", hash:"SHA-256"}, key, b64u(sig), new TextEncoder().encode(h+"."+p));
    const now = Date.now()/1000;
    if(!ok || typeof pay.exp!=="number" || now >= pay.exp || typeof pay.iat!=="number" || pay.iat > now + 86400) return null;
    if(!PLAN_RANK[pay.plan]) return null;
    return pay;
  }catch(e){ return null; }
}
async function loadEntitlements(){
  if(!serverMode()) return;
  ENT.lic = S.ent.lic ? await verifyJws(S.ent.lic) : null;
  ENT.bun = S.ent.bun ? await verifyJws(S.ent.bun) : null;
  if(ENT.lic && ENT.lic.src!=="gumroad") ENT.lic = null;
  if(ENT.bun && ENT.bun.src!=="bundle") ENT.bun = null;
  if(ENT.bun) S.trial = {plan:ENT.bun.plan, start:ENT.bun.ent_start, end:ENT.bun.ent_end, source:"bundle", ref:""};
}
async function api(path, body){
  try{
    const r = await fetch(CONFIG.entitlements.endpoint + path, {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body), cache:"no-store", credentials:"omit"});
    return {status:r.status, j: await r.json().catch(()=>null)};
  }catch(e){ return {status:0, j:null}; }
}
function licenseActive(){
  if(serverMode()) return !!ENT.lic;
  const L = S.license; if(!L || L.ok!==true || !validStamp(L.verifiedAt)) return false;
  return (Date.now() - L.verifiedAt) < LIC_GRACE;
}
function trialActive(){
  if(bundleMode()==="server"){ const x = ENT.bun; if(!x) return false; const d = today(); return d >= x.ent_start && d < x.ent_end; }
  if(bundleMode()!=="simulation") return false;
  const x = S.trial; if(!x) return false; const d = today(); return d >= x.start && d < x.end;
}
function trialEnded(){ const x = S.trial; return !!x && today() >= x.end; }
// Forfait effectif = le plus élevé des droits actifs (abonnement vérifié, offre bundle en cours), sinon Gratuit.
// Un changement de forfait ne supprime ni ne masque jamais de données : seules les nouvelles saisies et les rapports sont concernés.
function planState(){
  if(!configured()) return CONFIG.launchAccess===true ? {plan:"pro", source:"launch"} : {plan:"free", source:"free"};
  let best = {plan:"free", source:"free"};
  if(licenseActive()){ const p = serverMode() ? {plan:ENT.lic.plan, slot:ENT.lic.slot||"legacy"} : (productOf(S.license.slot) || productOf("legacy")); if(PLAN_RANK[p.plan] > PLAN_RANK[best.plan]) best = {plan:p.plan, source:p.slot}; }
  if(trialActive() && PLAN_RANK[S.trial.plan] > PLAN_RANK[best.plan]) best = {plan:S.trial.plan, source:"trial"};
  return best;
}
const plan = () => planState().plan;
const tripLimit = () => CONFIG.plans[plan()].trips;
const isPaid = () => plan() !== "free";   // rapports (PDF, CSV), trajets fréquents, détail TPS/TVQ
function planName(st){ st = st || planState(); return t(st.source==="legacy" ? "plan_legacy" : "plan_"+st.plan); }
const tripsInMonth = ym => S.trips.filter(x => x.date.slice(0,7)===ym).length;

/* ---------- calculations ---------- */
function calc(y){
  const trips = S.trips.filter(x => x.date.slice(0,4) == y);
  const exps = S.expenses.filter(x => x.date.slice(0,4) == y);
  const biz = round1(trips.filter(x=>x.type==="b").reduce((a,x)=>a+x.km,0));
  const per = round1(trips.filter(x=>x.type==="p").reduce((a,x)=>a+x.km,0));
  const o = S.odo[y] || {};
  const hasOdo = o.start!=null && o.end!=null;
  const odoBad = hasOdo && o.end < o.start;
  const odoTotal = hasOdo && !odoBad ? o.end - o.start : null;
  const total = odoTotal!=null && odoTotal>0 ? odoTotal : round1(biz+per);
  const over = odoTotal!=null && odoTotal>0 && biz > odoTotal;
  const pct = total>0 ? Math.min(1, biz/total) : 0;
  const P = PROV[S.settings.prov] || PROV.QC;
  let veh=0, full=0, taxVeh=0, taxFull=0;
  for(const e of exps){
    const c = CATS[e.cat] || CATS.othb;
    const tax = e.taxIncl ? e.amount * P.rec / (100 + P.tot) : 0;
    if(c.m==="p"){ veh += e.amount; taxVeh += tax; } else { full += e.amount; taxFull += tax; }
  }
  const reg = !!S.settings.registered;
  const taxRec = reg ? taxVeh*pct + taxFull : 0;
  const vehDed = (veh - (reg?taxVeh:0)) * pct;
  const fullDed = full - (reg?taxFull:0);
  return {trips,exps,biz,per,total,pct,hasOdo,odoBad,over,odoTotal,veh,full,vehDed,fullDed,taxRec,
          gst: P.qst ? taxRec*P.gst/P.rec : null, qst: P.qst ? taxRec*P.qst/P.rec : null, ded: vehDed+fullDed, nBiz: trips.filter(x=>x.type==="b").length};
}

/* ---------- odometer ---------- */
function drawOdo(val){
  const el = $("odo"); const v = Math.min(99999.9, Math.max(0, val));
  const s = v.toFixed(1).replace(".","").padStart(6,"0");
  if(!el.children.length){ for(let i=0;i<6;i++){ const sp=document.createElement("span"); if(i===5) sp.className="tenth"; sp.innerHTML="<i>0</i><i>0</i>"; el.appendChild(sp);} }
  [...el.children].forEach((sp,i)=>{
    const cur = sp.dataset.d || "0", nx = s[i];
    if(cur===nx){ sp.firstChild.textContent = nx; return; }
    const a = sp.children[0], b = sp.children[1];
    a.style.transition="none"; b.style.transition="none"; a.textContent=cur; b.textContent=nx; a.style.transform="translateY(0)"; b.style.transform="translateY(0)";
    void sp.offsetHeight; a.style.transition=""; b.style.transition="";
    a.style.transform="translateY(-100%)"; b.style.transform="translateY(-100%)";
    sp.dataset.d = nx;
    setTimeout(()=>{ a.style.transition="none"; b.style.transition="none"; a.textContent=nx; a.style.transform="translateY(0)"; b.style.transform="translateY(0)"; }, 520);
  });
  el.setAttribute("aria-label", nKm(v)+" km");
}

/* ---------- render ---------- */
function applyStrings(){
  document.documentElement.lang = S.lang==="fr" ? "fr-CA" : "en-CA";
  document.title = S.lang==="fr" ? "CarnetKM – Registre de kilométrage pour livreurs et travailleurs autonomes" : "CarnetKM – Mileage logbook for delivery drivers and the self-employed";
  document.querySelectorAll("[data-i]").forEach(el => el.textContent = t(el.dataset.i));
  $("langBtn").textContent = S.lang==="fr" ? "EN" : "FR";
  $("langBtn").setAttribute("aria-label", S.lang==="fr" ? "Switch to English" : "Passer au français");
  $("purposes").innerHTML = T[S.lang].purposes.map(p=>'<option value="'+esc(p)+'">').join("");
  const cat = $("eCat").value;
  $("eCat").innerHTML = Object.keys(CATS).map(k=>'<option value="'+k+'">'+esc(T[S.lang].cats[k])+'</option>').join("");
  if(cat) $("eCat").value = cat;
  $("sProv").innerHTML = Object.keys(PROV).map(k=>'<option value="'+k+'">'+esc(T[S.lang].provs[k])+'</option>').join("");
  $("sProv").value = S.settings.prov;
  $("freeList").innerHTML = T[S.lang].free_list.map(x=>"<li>"+esc(x.replace("{n}",CONFIG.plans.free.trips))+"</li>").join("");
  $("plusList").innerHTML = T[S.lang].plus_list.map(x=>"<li>"+esc(x.replace("{n}",CONFIG.plans.plus.trips))+"</li>").join("");
  $("proList").innerHTML = T[S.lang].pro_list.map(x=>"<li>"+esc(x)+"</li>").join("");
  $("plusPrice").textContent = CONFIG.plans.plus.price[S.lang];
  $("proPrice").textContent = CONFIG.plans.pro.price[S.lang];
  $("faqList").innerHTML = T[S.lang].faq.map(q=>"<details><summary>"+esc(q[0])+"</summary><p>"+esc(q[1])+"</p></details>").join("");
  $("yr").textContent = new Date().getFullYear();
}
function monthLabel(ym){ const [y,m]=ym.split("-"); return new Date(+y,+m-1,1).toLocaleDateString(loc(),{month:"long",year:"numeric"}); }
function dayLabel(d){ const [y,m,dd]=d.split("-"); return new Date(+y,+m-1,+dd).toLocaleDateString(loc(),{day:"numeric",month:"short"}).replace(".",""); }

function renderTrips(){
  const list = [...S.trips].sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  if(!list.length){ $("tripList").innerHTML = '<p class="empty">'+esc(t("no_trips"))+'</p>'; }
  else{
    const groups = {}; list.forEach(x=>{ (groups[x.date.slice(0,7)] = groups[x.date.slice(0,7)]||[]).push(x); });
    $("tripList").innerHTML = Object.keys(groups).sort().reverse().map(ym=>{
      const g = groups[ym]; const b = round1(g.filter(x=>x.type==="b").reduce((a,x)=>a+x.km,0));
      return '<div class="month"><div class="month-h"><b>'+esc(monthLabel(ym))+'</b><span class="muted">'+nKm(b)+' km '+esc(t("biz"))+'</span></div>'+
        g.map(x=>'<div class="item"><div class="d">'+esc(dayLabel(x.date))+'</div><div><div class="t">'+
          esc([x.from,x.to].filter(Boolean).join(" → ")||x.purpose||"—")+(x.type==="p"?'<span class="tag p">'+esc(t("perso"))+'</span>':'')+'</div>'+
          '<div class="s">'+esc(x.purpose && (x.from||x.to) ? x.purpose : "")+(x.o1!=null&&x.o2!=null?' <span>('+esc(x.o1)+' – '+esc(x.o2)+')</span>':'')+'</div></div>'+
          '<div><div class="v">'+nKm(x.km)+' km</div><button class="del" type="button" data-del-trip="'+esc(x.id)+'">'+esc(t("del"))+'</button></div></div>').join("")+'</div>';
    }).join("");
  }
  const f = $("favs");
  f.innerHTML = isPaid() ? S.favs.map(x=>'<button class="chip" type="button" data-fav="'+esc(x.id)+'">'+esc((x.to||x.purpose)+", "+nKm(x.km)+" km")+'</button>').join("") : "";
  f.style.display = f.innerHTML ? "" : "none";
}
function renderExp(){
  const list = [...S.expenses].sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  if(!list.length){ $("expList").innerHTML = '<p class="empty">'+esc(t("no_exp"))+'</p>'; return; }
  const groups = {}; list.forEach(x=>{ (groups[x.date.slice(0,7)] = groups[x.date.slice(0,7)]||[]).push(x); });
  $("expList").innerHTML = Object.keys(groups).sort().reverse().map(ym=>{
    const g = groups[ym]; const s = g.reduce((a,x)=>a+x.amount,0);
    return '<div class="month"><div class="month-h"><b>'+esc(monthLabel(ym))+'</b><span class="muted">'+nMoney(s)+'</span></div>'+
      g.map(x=>'<div class="item"><div class="d">'+esc(dayLabel(x.date))+'</div><div><div class="t">'+esc(T[S.lang].cats[x.cat]||x.cat)+'</div><div class="s">'+esc(x.note||"")+'</div></div>'+
        '<div><div class="v">'+nMoney(x.amount)+'</div><button class="del" type="button" data-del-exp="'+esc(x.id)+'">'+esc(t("del"))+'</button></div></div>').join("")+'</div>';
  }).join("");
}
function renderSum(){
  const years = new Set([new Date().getFullYear()]); S.trips.concat(S.expenses).forEach(x=>years.add(+x.date.slice(0,4)));
  if(!years.has(year)) year = new Date().getFullYear();
  $("sYear").innerHTML = [...years].sort((a,b)=>b-a).map(y=>'<option'+(y===year?" selected":"")+'>'+y+'</option>').join("");
  const o = S.odo[year]||{};
  if(document.activeElement!==$("sO1")) $("sO1").value = o.start!=null?o.start:"";
  if(document.activeElement!==$("sO2")) $("sO2").value = o.end!=null?o.end:"";
  if(document.activeElement!==$("sName")) $("sName").value = S.settings.name;
  if(document.activeElement!==$("sVeh")) $("sVeh").value = S.settings.vehicle;
  $("sReg").checked = !!S.settings.registered;
  const c = calc(year);
  let w = "";
  if(c.odoBad) w = t("warn_odo_bad"); else if(c.over) w = t("warn_over"); else if(!c.hasOdo) w = t("warn_odo");
  $("sumWarn").innerHTML = w ? '<div class="msg warn">'+esc(w)+'</div>' : "";
  const rows = [
    [t("s_biz"), nKm(c.biz)+" km"],
    [c.hasOdo && !c.odoBad && c.odoTotal>0 ? t("s_tot") : t("s_tot_est"), nKm(c.total)+" km"],
    [t("s_pct"), nPct(c.pct)],
    [t("s_veh"), nMoney(c.veh)],
    [t("s_vehd"), nMoney(c.vehDed)],
    [t("s_full"), nMoney(c.fullDed)]
  ];
  if(S.settings.registered){
    rows.push([t("s_tax"), nMoney(c.taxRec)]);
    if(c.gst!=null && isPaid()){ rows.push([t("s_gst"), nMoney(c.gst)]); rows.push([t("s_qst"), nMoney(c.qst)]); }
  }
  $("sumBox").innerHTML = rows.map(r=>'<div><span>'+esc(r[0])+'</span><b>'+esc(r[1])+'</b></div>').join("")+
    '<div class="big"><span>'+esc(t("s_ded"))+'</span><b>'+esc(nMoney(c.ded))+'</b></div>';
}
function renderHero(){
  const y = new Date().getFullYear(); const c = calc(y);
  $("odoCap").textContent = t("odo_cap",{y});
  drawOdo(c.biz);
  $("odoSub").textContent = c.nBiz ? t("odo_sub",{n:c.nBiz,p:nPct(c.pct)}) : t("odo_sub_none");
}
const lastDayLabel = endExcl => { const [y,m,d] = prevDay(endExcl).split("-"); return new Date(+y,+m-1,+d).toLocaleDateString(loc(),{day:"numeric",month:"long",year:"numeric"}); };
function renderPro(){
  const st = planState(), msgs = [];
  if(st.source==="launch") msgs.push(["ok", t("launch")]);
  else{
    msgs.push([st.plan==="free" ? "warn" : "ok", st.plan==="free" ? t("pro_off") : t("plan_on",{plan:planName(st)})]);
    if(licenseActive()) msgs.push(["ok", t((serverMode() ? ENT.lic.slot : S.license.slot)==="legacy" ? "legacy_on" : "pro_on"), true]);
    if(trialActive()) msgs.push(["ok", t("trial_on",{plan:t("plan_"+S.trial.plan), d:lastDayLabel(S.trial.end)})]);
    else if(trialEnded() && st.plan==="free") msgs.push(["warn", t("trial_end",{d:lastDayLabel(S.trial.end)})]);
  }
  $("proState").innerHTML = msgs.map(x=>'<div class="msg '+x[0]+'">'+esc(x[1])+(x[2]?' <button class="del" type="button" id="licRm" style="display:inline;margin-left:8px">'+esc(t("lic_remove"))+'</button>':'')+'</div>').join("");
  $("proState").style.marginBottom = "14px";
  // Boutons d'achat : seulement pour un produit réellement configuré (id + lien). Sinon « Bientôt ».
  ["plus","pro"].forEach(k=>{
    const p = productOf(k), box = $(k+"Buy");
    if(st.plan===k && st.source!=="launch") box.innerHTML = '<span class="badge">'+esc(t("current"))+'</span>';
    else if(p && p.id && p.url && PLAN_RANK[st.plan] < PLAN_RANK[k]) box.innerHTML = '<a class="btn lane" style="display:inline-block;text-decoration:none" href="'+esc(p.url)+'" target="_blank" rel="noopener">'+esc(t("buy_"+k))+'</a>';
    else box.innerHTML = PLAN_RANK[st.plan] >= PLAN_RANK[k] ? "" : '<span class="badge">'+esc(t("soon"))+'</span>';
  });
  $("freeBadge").innerHTML = st.plan==="free" && st.source!=="launch" ? '<span class="badge">'+esc(t("current"))+'</span>' : "";
  $("licBox").style.display = configured() && !licenseActive() ? "" : "none";
  const bm = bundleMode();
  $("bunSoon").textContent = bm==="simulation" ? t("bun_sim") : bm==="server" ? t("bun_srv") : t("bun_soon");
  $("bunForm").style.display = bm==="simulation" && !S.trial ? "" : "none";   // une seule offre par appareil en simulation
  $("bunSrv").style.display = bm==="server" && !trialActive() ? "" : "none";
}
function renderQuota(){
  const ym = ($("tDate").value || today()).slice(0,7), n = tripsInMonth(ym), lim = tripLimit(), st = planState();
  const box = $("quota"); if(!box) return;
  if(lim===Infinity){ box.textContent = t("quota_inf",{plan:planName(st), n, m:monthLabel(ym)}); box.className = "muted small"; return; }
  box.textContent = t("quota",{plan:planName(st), n, max:lim, m:monthLabel(ym)}) + (n > lim ? " " + t("quota_over",{n, max:lim}) : "");
  box.className = n >= lim ? "msg warn" : "muted small";
}
function renderAll(){ applyStrings(); renderTrips(); renderExp(); renderSum(); renderHero(); renderPro(); renderQuota(); expHint(); }
function flash(el, cls, text){ el.innerHTML = '<div class="msg '+cls+'">'+esc(text)+'</div>'; if(cls==="ok") setTimeout(()=>{ if(el.firstChild && el.firstChild.classList.contains("ok")) el.innerHTML=""; }, 3500); }
function expHint(){ const c = CATS[$("eCat").value]; $("eHint").textContent = c ? t(c.m==="p"?"hint_pro":"hint_full") : ""; }

/* ---------- actions ---------- */
function addTrip(ev){
  ev.preventDefault();
  const date = $("tDate").value, type = document.querySelector('input[name=tType]:checked').value;
  const from = $("tFrom").value.trim(), to = $("tTo").value.trim(), purpose = $("tPurpose").value.trim();
  const o1 = num($("tO1").value), o2 = num($("tO2").value); let km = num($("tKm").value);
  const m = $("tripMsg");
  if(!date) return flash(m,"err",t("err_date"));
  if(o1!=null && o2!=null){ if(o2<=o1) return flash(m,"err",t("err_odo")); if(km==null || km<=0) km = o2-o1; }
  if(km==null || km<=0) return flash(m,"err",t("err_km"));
  if(type==="b" && !to) return flash(m,"err",t("err_dest"));
  if(type==="b" && !purpose) return flash(m,"err",t("err_purpose"));
  // Quota : trajets existants dont la DATE tombe dans ce mois calendaire (un trajet antidaté compte dans son propre mois).
  // Le forfait appliqué est celui en vigueur au moment de la saisie. Supprimer un trajet libère une place.
  const lim = tripLimit();
  if(tripsInMonth(date.slice(0,7)) >= lim) return flash(m,"warn",t("limit",{n:lim,m:monthLabel(date.slice(0,7)),plan:planName()}));
  km = round1(km);
  S.trips.push({id:uid(),date,type,from,to,purpose,km,o1:(o1!=null&&o2!=null)?o1:null,o2:(o1!=null&&o2!=null)?o2:null});
  if($("tFav").checked && isPaid() && !S.favs.some(f=>f.from===from&&f.to===to&&f.purpose===purpose&&f.km===km)) S.favs.push({id:uid(),from,to,purpose,km,type});
  save();
  ["tFrom","tTo","tPurpose","tKm","tO1","tO2"].forEach(i=>$(i).value=""); $("tFav").checked=false;
  renderTrips(); renderSum(); renderHero(); renderQuota(); flash(m,"ok",t("trip_added"));
}
function addExp(ev){
  ev.preventDefault();
  const date = $("eDate").value, cat = $("eCat").value, amount = num($("eAmt").value), note = $("eNote").value.trim();
  const m = $("expMsg");
  if(!date) return flash(m,"err",t("err_date"));
  if(amount==null || amount<=0) return flash(m,"err",t("err_amt"));
  S.expenses.push({id:uid(),date,cat,amount:Math.round(amount*100)/100,taxIncl:$("eTax").checked,note});
  save(); $("eAmt").value=""; $("eNote").value="";
  renderExp(); renderSum(); flash(m,"ok",t("exp_added"));
}
function csvCell(v){ v = String(v==null?"":v); if(/^[=+\-@\t\r]/.test(v)) v = "'"+v; return '"'+v.replace(/"/g,'""')+'"'; }
function download(name, text, type){
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text],{type})); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function needPro(){ if(isPaid()) return false; flash($("expMsg2"),"warn",t("pro_only")); return true; }
function csvTrips(){
  if(needPro()) return;
  const c = calc(year); const rows = [[t("c_date"),t("c_type"),t("c_from"),t("c_to"),t("c_purpose"),t("c_km"),t("c_o1"),t("c_o2")]];
  [...c.trips].sort((a,b)=>a.date.localeCompare(b.date)).forEach(x=>rows.push([x.date,x.type==="b"?t("type_b"):t("type_p"),x.from,x.to,x.purpose,x.km.toFixed(1),x.o1==null?"":x.o1,x.o2==null?"":x.o2]));
  download("carnetkm-trajets-"+year+".csv","﻿"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n"),"text/csv;charset=utf-8");
}
function csvExp(){
  if(needPro()) return;
  const c = calc(year); const rows = [[t("c_date"),t("c_cat"),t("c_amt"),t("c_taxi"),t("c_note")]];
  [...c.exps].sort((a,b)=>a.date.localeCompare(b.date)).forEach(x=>rows.push([x.date,T[S.lang].cats[x.cat]||x.cat,x.amount.toFixed(2),x.taxIncl?t("yes"):t("no"),x.note]));
  download("carnetkm-depenses-"+year+".csv","﻿"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n"),"text/csv;charset=utf-8");
}
function printLog(){
  if(needPro()) return;
  const c = calc(year), o = S.odo[year]||{};
  const trips = [...c.trips].sort((a,b)=>a.date.localeCompare(b.date));
  $("print").innerHTML = '<h1>'+esc(t("p_title"))+' '+year+'</h1><div class="meta">'+
    '<div><b>'+esc(t("p_name"))+' :</b> '+esc(S.settings.name||"—")+'</div><div><b>'+esc(t("p_veh"))+' :</b> '+esc(S.settings.vehicle||"—")+'</div>'+
    '<div><b>'+esc(t("p_o1"))+' :</b> '+esc(o.start!=null?o.start:"—")+'</div><div><b>'+esc(t("p_o2"))+' :</b> '+esc(o.end!=null?o.end:"—")+'</div>'+
    '<div><b>'+esc(t("s_biz"))+' :</b> '+nKm(c.biz)+' km</div><div><b>'+esc(c.hasOdo&&!c.odoBad&&c.odoTotal>0?t("s_tot"):t("s_tot_est"))+' :</b> '+nKm(c.total)+' km</div>'+
    '<div><b>'+esc(t("s_pct"))+' :</b> '+nPct(c.pct)+'</div></div>'+
    '<table><thead><tr><th>'+esc(t("c_date"))+'</th><th>'+esc(t("c_type"))+'</th><th>'+esc(t("c_from"))+'</th><th>'+esc(t("c_to"))+'</th><th>'+esc(t("c_purpose"))+'</th><th class="n">'+esc(t("c_o1"))+'</th><th class="n">'+esc(t("c_o2"))+'</th><th class="n">'+esc(t("c_km"))+'</th></tr></thead><tbody>'+
    trips.map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(x.type==="b"?t("type_b"):t("type_p"))+'</td><td>'+esc(x.from)+'</td><td>'+esc(x.to)+'</td><td>'+esc(x.purpose)+'</td><td class="n">'+esc(x.o1)+'</td><td class="n">'+esc(x.o2)+'</td><td class="n">'+nKm(x.km)+'</td></tr>').join("")+
    '</tbody></table><div class="foot">'+esc(t("p_gen",{d:new Date().toLocaleDateString(loc())}))+'</div>';
  window.print();
}

/* ---------- licence (Gumroad) ---------- */
// Résultat : {ok:true} | {ok:false, reason:"bad"|"ended"} (refus explicite de Gumroad)
//          | {ok:false, transient:true} (réseau, HTTP 408/429/5xx, réponse non JSON ou illisible) : ne retire jamais Pro.
// Compteur « uses » (C3) : Gumroad compte les vérifications faites avec increment_uses_count=true, pas les appareils
// distincts, et n'applique aucun plafond lui-même. Le compteur n'est donc pas utilisé pour bloquer (aucun plafond fiable possible côté client).
// Plusieurs produits (origine, Plus, Pro) : une clé n'appartient qu'à un seul. On essaie le produit connu d'abord,
// puis les autres produits configurés. Résultat enrichi : {ok:true, slot}.
async function verifyLicense(key, first, slotHint){
  const order = liveProducts().slice().sort((a,b)=> (b.slot===slotHint) - (a.slot===slotHint));
  let transient = false, ended = false;
  for(const p of (slotHint && !first ? order.filter(x=>x.slot===slotHint) : order)){
    const r = await verifyOne(p.id, key, first);
    if(r.ok) return {ok:true, slot:p.slot};
    if(r.transient) transient = true; else if(r.reason==="ended") ended = true;
  }
  if(ended) return {ok:false, reason:"ended"};
  if(transient) return {ok:false, transient:true};
  return {ok:false, reason:"bad"};
}
async function verifyOne(productId, key, first){
  const body = new URLSearchParams({product_id:productId, license_key:key, increment_uses_count:first?"true":"false"});
  let r;
  try{ r = await fetch("https://api.gumroad.com/v2/licenses/verify",{method:"POST",body,cache:"no-store"}); }
  catch(e){ return {ok:false, transient:true}; }
  if(r.status===408 || r.status===429 || r.status>=500) return {ok:false, transient:true};
  const j = await r.json().catch(()=>null);
  if(!j || typeof j!=="object" || typeof j.success!=="boolean") return {ok:false, transient:true};
  if(!j.success) return {ok:false, reason:"bad"};
  const p = j.purchase||{}; const past = d => d && new Date(d).getTime() <= Date.now();
  if(p.refunded || p.chargebacked || p.disputed) return {ok:false, reason:"ended"};
  if(past(p.subscription_ended_at) || past(p.subscription_cancelled_at) || past(p.subscription_failed_at)) return {ok:false, reason:"ended"};
  return {ok:true};
}
async function activate(){
  const key = $("licKey").value.trim(), m = $("licMsg");
  if(!key) return flash(m,"err",t("lic_empty"));
  flash(m,"warn",t("lic_checking")); $("bLic").disabled = true;
  if(serverMode()){
    const r = await api("/v1/license", {key, device:S.device});
    const pay = r.status===200 && r.j && await verifyJws(r.j.token);
    if(pay && pay.src==="gumroad"){ S.license = {key:key.slice(0,100), ok:true, verifiedAt:Date.now(), slot:pay.slot}; S.ent.lic = r.j.token; ENT.lic = pay; save(); renderAll(); flash($("proFlash"),"ok",t("lic_ok")); }
    else flash(m,"err",t(r.status===404?"lic_bad":r.status===403?"lic_ended":r.status===409?"lic_devices":"lic_net"));
    $("bLic").disabled = false; return;
  }
  try{
    const r = await verifyLicense(key, true);
    if(r.ok){ S.license = {key:key.slice(0,100), ok:true, verifiedAt:Date.now(), slot:r.slot}; save(); renderAll(); flash($("proFlash"),"ok",t("lic_ok")); }
    else if(r.transient) flash(m,"err",t("lic_net"));
    else flash(m,"err",t(r.reason==="ended"?"lic_ended":"lic_bad"));
  }catch(e){ flash(m,"err",t("lic_net")); }
  $("bLic").disabled = false;
}
const RENEW_BEFORE = 3*86400;   // renouvellement en ligne quand il reste moins de 3 jours au jeton
async function recheck(){
  const L = S.license; if(!configured() || !L || !L.key) return;
  if(serverMode()){
    if(ENT.lic && ENT.lic.exp - Date.now()/1000 > RENEW_BEFORE) return;
    const r = await api("/v1/license", {key:L.key, device:S.device});
    if(r.status===200 && r.j){ const pay = await verifyJws(r.j.token); if(pay){ S.ent.lic = r.j.token; ENT.lic = pay; } }
    else if([403,404].includes(r.status)){ S.ent.lic = null; ENT.lic = null; L.ok = false; }   // révoqué/terminé; panne ou 409 : on garde le jeton jusqu'à son expiration
    save(); renderAll(); return;
  }
  // Une date invalide ou future force la revérification; sinon on attend le délai habituel.
  if(validStamp(L.verifiedAt) && Date.now() - L.verifiedAt < LIC_RECHECK) return;
  try{
    const r = await verifyLicense(L.key, false, L.slot);
    if(r.transient) return;                       // erreur passagère : on garde la dernière validation (la grâce de 14 jours s'applique)
    L.ok = r.ok; if(r.ok){ L.verifiedAt = Date.now(); L.slot = r.slot; } save(); renderAll();
  }catch(e){}
}

/* ---------- offre bundle SharpLaughs (3 mois Plus) ---------- */
// SIMULATION SEULEMENT. Aucun appel réseau, aucun vrai code. Les codes fictifs DEMO-XXXX sont « à usage unique » sur
// cet appareil uniquement : ce n'est PAS un contrôle sécurisé (stockage local modifiable, autre appareil = autre registre).
// L'activation réelle unique par achat exige une validation hors client (docs/CARNETKM-002-architecture.md).
const DEMO_RE = /^DEMO-[A-Z0-9]{4,12}$/;
function activateBundle(){
  const m = $("bunMsg"), code = $("bunCode").value.trim().toUpperCase();
  if(bundleMode()!=="simulation") return flash(m,"err",t("bun_soon"));
  if(!code) return flash(m,"err",t("bun_empty"));
  if(!DEMO_RE.test(code)) return flash(m,"err",t("bun_bad"));
  if(S.redeemed.includes(code)) return flash(m,"err",t("bun_used"));
  if(S.trial) return flash(m,"err",t("bun_once"));
  const start = today();
  S.trial = {plan:CONFIG.bundle.plan, start, end:addMonths(start, CONFIG.bundle.months), source:"bundle-sim", ref:code};
  S.redeemed.push(code); save(); $("bunCode").value = ""; renderAll();
  flash($("bunMsg"),"ok",t("bun_ok",{plan:t("plan_"+S.trial.plan), d:lastDayLabel(S.trial.end)}));
}

/* ---------- offre bundle : mode serveur (réclamation par commande Fourthwall) ---------- */
// Seuls le numéro de commande et le courriel (réclamation), le code de récupération ou le jeton sont envoyés.
const BUN_ERR = {404:"bun_notfound", 403:"bun_revoked", 410:"bun_expired", 409:"bun_devices", 429:"bun_rate"};
async function acceptBundle(r, m){
  const pay = r.status===200 && r.j && await verifyJws(r.j.token);
  if(!pay || pay.src!=="bundle") return flash(m,"err",t(BUN_ERR[r.status]||"bun_net"));
  S.ent.bun = r.j.token; ENT.bun = pay; S.trial = {plan:pay.plan, start:pay.ent_start, end:pay.ent_end, source:"bundle", ref:""};
  save(); renderAll();
  const box = $("bunMsg");
  box.innerHTML = '<div class="msg ok">'+esc(t("bun_ok",{plan:t("plan_"+pay.plan), d:lastDayLabel(pay.ent_end)}))+'</div>' +
    (r.j.recovery_code ? '<div class="msg warn" id="bunRecShow">'+esc(t("bun_rec_show",{c:r.j.recovery_code}))+'</div>' : "");
}
async function claimBundle(){
  const m = $("bunMsg"), order = $("bunOrder").value.trim(), email = $("bunEmail").value.trim();
  if(bundleMode()!=="server") return flash(m,"err",t("bun_soon"));
  if(!order || !email) return flash(m,"err",t("bun_empty"));
  $("bBunClaim").disabled = true;
  const r = await api("/v1/bundle/claim", {order, email});
  $("bBunClaim").disabled = false;
  if(r.status===200){ $("bunOrder").value = ""; $("bunEmail").value = ""; }
  return acceptBundle(r, m);
}
async function recoverBundle(){
  const m = $("bunMsg"), code = $("bunRec").value.trim();
  if(bundleMode()!=="server") return flash(m,"err",t("bun_soon"));
  if(!code) return flash(m,"err",t("bun_empty"));
  const r = await api("/v1/bundle/recover", {code});
  if(r.status===200) $("bunRec").value = "";
  return acceptBundle(r, m);
}
async function refreshBundle(){
  if(bundleMode()!=="server" || !S.ent.bun) return;
  if(ENT.bun && ENT.bun.exp - Date.now()/1000 > RENEW_BEFORE) return;
  const r = await api("/v1/bundle/refresh", {token:S.ent.bun});
  if(r.status===200 && r.j){ const pay = await verifyJws(r.j.token); if(pay){ S.ent.bun = r.j.token; ENT.bun = pay; } }
  else if([401,403,410].includes(r.status)){ S.ent.bun = null; ENT.bun = null; }   // révoqué, terminé ou trop ancien : retour Gratuit (récupération possible)
  save(); renderAll();
}

/* ---------- wiring ---------- */
function init(){
  load();
  $("tDate").value = today(); $("eDate").value = today();
  renderAll(); $("eTax").checked = !!CATS[$("eCat").value].tax;
  $("tripForm").addEventListener("submit", addTrip);
  $("expForm").addEventListener("submit", addExp);
  $("eCat").addEventListener("change", ()=>{ $("eTax").checked = !!CATS[$("eCat").value].tax; expHint(); });
  $("langBtn").addEventListener("click", ()=>{ S.lang = S.lang==="fr"?"en":"fr"; save(); renderAll(); });
  document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click", ()=>{
    document.querySelectorAll(".tabs button").forEach(x=>x.setAttribute("aria-selected", x===b ? "true":"false"));
    ["trips","exp","sum","pro"].forEach(k=>{ $("p-"+k).hidden = k!==b.dataset.tab; });
  }));
  document.addEventListener("click", ev=>{
    const el = ev.target.closest("[data-del-trip],[data-del-exp],[data-fav],#licRm"); if(!el) return;
    if((el.dataset.delTrip||el.dataset.delExp) && !el.dataset.armed){ el.dataset.armed="1"; el.textContent=t("del_sure"); el.style.color="var(--alert)"; el.style.fontWeight="600";
      setTimeout(()=>{ if(el.isConnected){ delete el.dataset.armed; el.textContent=t("del"); el.style.color=""; el.style.fontWeight=""; } }, 4000); return; }
    if(el.dataset.delTrip){ S.trips = S.trips.filter(x=>x.id!==el.dataset.delTrip); save(); renderTrips(); renderSum(); renderHero(); renderQuota(); }
    else if(el.dataset.delExp){ S.expenses = S.expenses.filter(x=>x.id!==el.dataset.delExp); save(); renderExp(); renderSum(); }
    else if(el.dataset.fav){ const f = S.favs.find(x=>x.id===el.dataset.fav); if(f){ $("tFrom").value=f.from; $("tTo").value=f.to; $("tPurpose").value=f.purpose; $("tKm").value=f.km; $("tKm").focus(); } }
    else if(el.id==="licRm"){ S.license = null; save(); renderAll(); }
  });
  $("sYear").addEventListener("change", ()=>{ year = +$("sYear").value; renderSum(); });
  const odoIn = ()=>{ const a = num($("sO1").value), b = num($("sO2").value); S.odo[year] = {start:a, end:b}; save(); renderSum(); renderHero(); };
  $("sO1").addEventListener("input", odoIn); $("sO2").addEventListener("input", odoIn);
  $("sName").addEventListener("input", ()=>{ S.settings.name = $("sName").value.trim(); save(); });
  $("sVeh").addEventListener("input", ()=>{ S.settings.vehicle = $("sVeh").value.trim(); save(); });
  $("sProv").addEventListener("change", ()=>{ S.settings.prov = $("sProv").value; save(); renderSum(); });
  $("sReg").addEventListener("change", ()=>{ S.settings.registered = $("sReg").checked; save(); renderSum(); });
  $("bPrint").addEventListener("click", printLog); $("bCsvT").addEventListener("click", csvTrips); $("bCsvE").addEventListener("click", csvExp);
  $("bLic").addEventListener("click", activate);
  $("bBun").addEventListener("click", activateBundle);
  $("bBunClaim").addEventListener("click", claimBundle);
  $("bBunRec").addEventListener("click", recoverBundle);
  $("tDate").addEventListener("change", renderQuota);
  $("bBackup").addEventListener("click", ()=> download("carnetkm-sauvegarde-"+today()+".json", JSON.stringify(exportState(),null,1), "application/json"));
  $("bRestore").addEventListener("click", ()=> $("fRestore").click());
  $("fRestore").addEventListener("change", ev=>{
    const f = ev.target.files[0]; if(!f) return; const rd = new FileReader();
    rd.onload = ()=>{ try{ const o = JSON.parse(rd.result);
        if(!o || o.app!=="carnetkm" || !Array.isArray(o.trips) || !Array.isArray(o.expenses)) throw 0;
        const clean = sanitizeState(o, false);   // C1 : identifiants validés/régénérés, champs bornés
        const box = $("bkMsg");
        box.innerHTML = '<div class="msg warn">'+esc(t("bk_confirm"))+' <span class="muted">('+clean.trips.length+' / '+clean.expenses.length+')</span><div class="row" style="margin-top:8px"><button class="btn" type="button" id="bkYes">'+esc(t("bk_yes"))+'</button><button class="btn alt" type="button" id="bkNo">'+esc(t("bk_no"))+'</button></div></div>';
        $("bkYes").onclick = ()=>{ clean.license = S.license; clean.trial = S.trial; clean.redeemed = S.redeemed; clean.device = S.device; clean.ent = S.ent; S = clean; save(); renderAll(); flash(box,"ok",t("bk_ok")); };
        $("bkNo").onclick = ()=>{ box.innerHTML=""; };
      }catch(e){ flash($("bkMsg"),"err",t("bk_bad")); } ev.target.value=""; };
    rd.readAsText(f);
  });
  loadEntitlements().then(()=>{ renderAll(); recheck(); refreshBundle(); });
  if("serviceWorker" in navigator && location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
}
init();
