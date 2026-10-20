"""Hand-written gold explanations in grammatical romanized Nepali (written by the teacher).

Each entry: ([question phrasings], answer). Answers are accurate, simple, and
2-4 sentences: the register a good school teacher uses. They teach Nik to explain
"why" and "how", not just recite facts.
"""

GOLD = [
    # ---------------- science
    (['aakash kina nilo dekhinchha?', 'sky kina blue hunchha?', 'aakash ko rang nilo kina?'],
     'ghaam ko seto prakash ma sabai rang hunchhan. hawa ka sana kan le nilo prakash lai aru rang bhanda badhi chharchhan, tyasaile jata herda pani nilo prakash hamro aankha ma aauchha. yasailai prakash ko prakirnan bhaninchha.'),
    (['pani kasari parchha?', 'barsha kasari hunchha?', 'rain kasari aauchha?'],
     'ghaam le samudra, nadi ra tal ko pani tataera baph banauchha. baph mathi gaera chiso bhaepachhi sana pani ka thopa ma badalinchha ra badal banchha. thopa haru jodiera garho bhaepachhi pani ko rup ma tala jharchhan. yo pani chakra ho.'),
    (['din ra raat kina hunchha?', 'raat kina parchha?', 'din raat kasari hunchha?'],
     'prithvi afno akshya ma 24 ghanta ma ek palta ghumchha. jun bhag ghaam tira farkinchha tyaha din hunchha, ra ulto bhag ma raat. ghaam ghumeko haina, prithvi ghumeko ho.'),
    (['rritu kina ferinchha?', 'garmi ra jado kina hunchha?', 'season kasari change hunchha?'],
     'prithvi ko akshya alikati dhalkeko chha ra yo ghaam lai barsabhari parikrama garchha. jun bela hamro bhag ghaam tira dhalkinchha, ghaam ko kiran sidha parchha ra garmi hunchha. ulto dhalkida kiran tirchho parchha ra jado hunchha.'),
    (['gurutwakarshan k ho?', 'gravity k ho?', 'chij tala kina khaschha?'],
     'gurutwakarshan bhaneko pindha bhayeka sabai chij le ek arka lai tanne bal ho. prithvi dherai thulo bhayeko le yasle sabai chij lai afno kendra tira tanchha, tyasaile hami le chhodeko kura tala khaschha. yahi bal le chandrama lai prithvi ko parikrama garauchha.'),
    (['bhukampa kina aauchha?', 'earthquake kasari hunchha?', 'nepal ma bhukampa kina dherai aauchha?'],
     'prithvi ko mathillo satah thula plate haru ma bandiyeko chha jun bistarai chalirahanchhan. bhartiya plate ra yurasiyan plate ek arka lai dhakeldai chhan, tyasle tanab jamma hunchha ra achanak chhutda jamin hallinchha. yahi plate ko takkar le himal pani baneko ho, tyasaile nepal ma bhukampa ko jokhim badhi chha.'),
    (['bhukampa aauda k garne?', 'earthquake ma k garnu parchha?'],
     'bhukampa aauda "jhuk, chhop ra samat": bhuin ma jhuknus, baliyo table muni tauko chhopnus ra samatnus. jhyal ra bhitta bata tadha basnus. hallinchha rokiyepachhi matra surakshit tarika le khulla thau ma jaanus.'),
    (['biruwa le khana kasari banauchha?', 'prakash sanshleshan k ho?', 'photosynthesis k ho?'],
     'biruwa ko paat ma hunne hariyo padartha le ghaam ko prakash samatchha. tyo urja prayog garera biruwa le hawa ko carbon dioxide ra jara bata aayeko pani milaera chini banauchha, ani oxygen bahira falchha. yasailai prakash sanshleshan bhaninchha.'),
    (['indreni kasari banchha?', 'rainbow kina dekhinchha?'],
     'pani pare pachhi hawa ma sana pani ka thopa hunchhan. ghaam ko prakash thopa bhitra pasda mudchha ra sat rang ma chhuttinchha, ani pharkera hamro aankha ma aauchha. tyasaile ghaam pachhadi ra pani agadi hunda indreni dekhinchha.'),
    (['chandrama ko aakar kina ferinchha?', 'chand kina sano thulo dekhinchha?'],
     'chandrama afai chamkidaina, ghaam ko prakash farkaunchha. yo prithvi ko parikrama garda hami le yasko ujyalo bhag kahile dherai, kahile thorai dekhchhau. tyasaile purnima, aunsi ra bichka aakar dekhinchhan.'),
    (['bijuli kasari aauchha?', 'nepal ma bijuli kasari banchha?'],
     'nepal ma dherai jaso bijuli jalbidyut bata banchha. nadi ko bagne pani le turbine ghumauchha, ani turbine sanga jodieko generator le chumbak ra taar ko madat le bijuli utpadan garchha. yo bijuli taar hudai ghar samma aauchha.'),
    (['awaj kasari sunchhau?', 'sound kasari travel garchha?'],
     'kunai chij kampida hawa ka kan pani kampinchhan ra tyo kampan lahar jastai agadi badhchha. lahar hamro kaan ko parda ma pugda parda kampinchha ra dimag le tyaslai awaj ko rup ma bujhchha. awaj hawa bhanda pani ma ra thos ma jhan chhito jaanchha.'),
    (['vaccine le kasari kam garchha?', 'khop kina lagaunchhan?'],
     'khop le sarir lai rog ko kamjor wa mareko rup dekhaera chinaunchha. sarir ko raksha pranali le tyasko biruddha antibody banauna sikchha. pachhi sachchai rog aauda sarir le chhito chinera ladchha, tyasaile hami birami hudainau wa kam birami hunchhau.'),
    (['mutu le k kam garchha?', 'heart kasari kam garchha?'],
     'mutu ek baliyo mansapeshi ho jasle pump jastai ragat lai sarir bhari pathauchha. ragat le pratyek koshika samma oxygen ra poshan puryauchha ra fohor farkauchha. thulo manchhe ko mutu ek minet ma lagbhag 60 dekhi 100 palta dhadkinchha.'),
    (['nidra kina jaruri chha?', 'sutnu kina parchha?'], 'sutda dimag le din bhari sikeko kura milauchha ra sarir le afulai marmat garchha. thorai nidra le dhyan, smriti ra mood kharab hunchha. thula manchhe lai 7 dekhi 9 ghanta, ra bidyarthi lai alikati badhi nidra chahinchha.'),
    (['dengue kasari sarchha?', 'dengue bata kasari bachne?'],
     'dengue lamkhutte ko tokai bata sarchha, jun safa jameko pani ma janmanchha. ghar waripari ko gamla, tyre ra bhanda ma pani jamna nadinus, lamo bahula ko luga lagaunus ra jhul prayog garnus. jworo ra jiu dukhe chhito doctor kahan jaanus.'),

    # ---------------- health & life
    (['din ma kati pani piunu parchha?', 'pani kati khane?'], 'sadharan taya thula manchhe le din ma lagbhag 2 dekhi 3 liter pani piunu ramro hunchha. garmi ma wa khelkud garda jhan badhi chahinchha. pyas lagnu agadi nai thorai thorai piunu ramro bani ho.'),
    (['swasthya kasari ramro rakhne?', 'healthy kasari basne?', 'ramro swasthya ko lagi k garne?'],
     'santulit khana khanus: tarkari, fal, gedagudi ra paryapt pani. har din kamsekam 30 minet hidnus wa byayam garnus. samaya mai sutnus, ra mann ko kura bharosa lagne manchhe sanga bhannus.'),
    (['tension kasari kam garne?', 'stress kam garne upaya?', 'chinta kasari ghataune?'],
     'pahila gahiro saas linus: char second bhitra, char second rokera, char second bahira. thulo kaam lai sano sano tukra ma bandnus ra ek palta ma ek matra garnus. hidnu, ramro nidra ra sathi sanga kura garnu le pani dherai madat garchha.'),
    (['risaaunda k garne?', 'ris kasari control garne?'], 'ris uthda turuntai bolnu wa nirnaya linu bhanda das samma gannus ra gahiro saas linus. ris aaunu galat haina, tara tyasma garne kaam hamro haat ma chha. shanta bhaepachhi aafno kura narm tarika le bhannus.'),
    (['sathi kasari banaune?', 'naya sathi kasari banaune?'], 'arulai sachchai chasō dekhaunus: prashna sodhnus ra dhyan diera sunnus. sano sahayog garnus ra afai pani khulla hunus. sachcha mitrata samaya lagera banchha, hatar nagarnus.'.replace('chasō', 'chaso')),
    (['asafal bhaye k garne?', 'fail bhaye k garne?', 'haar khaye pachhi k garne?'],
     'asafalta le timi asafal manchhe ho bhanne dekhaudaina, yo eutai prayas asafal bhayo bhanne matra ho. k bigriyo bhanera shanta bhaera hernus, ani tyo kura sudharera pheri prayas garnus. dherai safal manchhe le pani dherai palta asafal bhaera nai sikeka hun.'),
    (['dhanyabad bhannu kina ramro?', 'kritagyata kina mahattwapurna chha?'], 'dhanyabad bhanda arulai sammanit mahasus hunchha ra nata baliyo hunchha. afai pani jiwan ma bhayeka ramro kura dekhna thalchhau, jasle mann khusi banauchha. sano dhanyabad ko thulo asar hunchha.'),

    # ---------------- study
    (['ramro sanga kasari padhne?', 'padhne ramro tarika k ho?', 'study tips deu'],
     '25 minet dhyan diera padhnus ra 5 minet aaram garnus. padheko kura kitab band garera afnai shabda ma lekhnus wa arulai sunaunus, yasle yaad baliyo banauchha. purano prashna haru solve garnus ra galti bhayeka thau pheri padhnus.'),
    (['kura kasari yaad garne?', 'memory kasari badhaune?'], 'ek palta lamo samaya padhnu bhanda dherai palta chhoto doharaunu ramro hunchha: aaja, bholi, ek hapta pachhi. naya kura lai purano kura sanga jodnus ra udaharan sochnus. ramro nidra le pani smriti baliyo banauchha.'),
    (['parikshya ko dar kasari hataune?', 'exam ma nervous hunchhu'], 'tayari nai sabai bhanda thulo aushadhi ho, tyasaile samaya talika banaera padhnus. parikshya agadi raati ramrari sutnus. prashna patra paunda pahila sajilo prashna gari aatmabishwas badhaunus, ani garho tira jaanus.'),
    (['samaya ko byabasthapan kasari garne?', 'time management kasari garne?'], 'bihana nai aaja ka sabai bhanda mahattwapurna tin kaam lekhnus ra pahila tini garnus. phone ko notification band garera ek palta ma ek kaam garnus. sano kaam turuntai sakaunus, thulo kaam lai tukra ma bandnus.'),
    (['math kasari ramro banaune?', 'ganit ma kasari ramro hune?'], 'ganit dekhera haina, afai solve garera sikinchha. har din alikati abhyas garnus ra sajilo bata garho tira jaanus. galti bhaye kun step ma bhayo khojnus, kinaki galti nai sabai bhanda ramro shikshak ho.'),

    # ---------------- tech
    (['internet kasari chalchha?', 'internet k ho?'], 'internet bhaneko sansar bhari ka computer haru ek arka sanga jodieko thulo jal ho. timi le website kholda timro phone le tyo website ko server lai sandesh pathauchha, ra server le sana tukra ma jankari farkaunchha. yi tukra taar, fiber ra tower hudai chhito yatra garchhan.'),
    (['AI k ho?', 'artificial intelligence k ho?', 'AI le kasari sikchha?'], 'AI bhaneko computer lai udaharan bata sikna sikaune prabidhi ho. dherai data herera yasle dhanchha chinchha, ani naya kura ma tyo gyan prayog garchha. ma pani ek sano AI hu, jasle dherai nepali text padhera arko shabda anuman garna sikeko chhu.'),
    (['programming k ho?', 'coding bhaneko k ho?'], 'programming bhaneko computer lai step step nirdesan dinu ho, jun computer le bujhne bhasha ma lekhinchha. jastai python ma "print(\'namaste\')" lekhda computer le namaste dekhauchha. sano program bata suru garera thulo app samma banauna sakinchha.'),
    (['password kasto banaune?', 'ramro password kasto hunchha?'], 'ramro password lamo hunchha, kamsekam 12 akshar, ra sajilai anuman garna nasakine. dherai shabda jodera banaunus, jastai "chiya-pahad-taara-27". har website ma farak password rakhnus ra kasaile pani OTP wa password magda nadinus.'),
    (['phone ko battery kasari lamo chalaune?', 'battery chhito sakinchha'], 'screen ko ujyalo kam garnus ra nachahine app band garnus. battery lai dherai garmi bata bachaunus. sambhab bhaye 20 dekhi 80 pratishat ko bich ma charge rakhda battery ko aayu lamo hunchha.'),
    (['fake message kasari chinne?', 'online thagi bata kasari bachne?'], '"tapai le chitthā jitnubhayo" wa "turuntai paisa pathaunus" jasta sandesh dherai jaso thagi hunchhan. ajnat link click nagarnus ra kasailai pani OTP, PIN wa password nadinus. shanka lage sidhai sambandhit bank wa karyalaya lai phone garera sodhnus.'.replace('chitthā', 'chittha')),

    # ---------------- money
    (['paisa kasari bachaune?', 'saving kasari garne?', 'bachat ko tarika?'], 'kamai aauna bittikai kehi bhag, jastai 20 pratishat, chhuttai rakhnus ani baki kharcha garnus. mahina ko kharcha lekhnus, nachahine kharcha afai dekhinchha. sano sano bachat pani samaya sanga thulo rakam banchha.'),
    (['loan line ki naline?', 'rin linu ramro ho?'], 'rin linu agadi byaj dar, kista ra jamma tirnu parne rakam ramrari hisab garnus. jun kura le kamai badhauchha, jastai padhai wa byabasaya, tyasko lagi sochera rin linu thik huna sakchha. dekhawati kharcha ko lagi rin linu jokhim purna hunchha.'),

    # ---------------- nepal
    (['nepal ko ekikaran kasle garyo?', 'prithvi narayan shah ko barema bhana'], 'gorkha ka raja prithvi narayan shah le bi.sa. 1800 ko dashak ma sana sana rajya haru lai jodera adhunik nepal ko ekikaran suru garnubhayo. uhalai nepal ko rashtra nirmata bhaninchha. uhako "nepal char jat chhattis barna ko phulbari ho" bhanne bhanai prasiddha chha.'),
    (['nepal ma kati wata pradesh chhan ra kun kun?', 'nepal ka pradesh haru bhana'], 'nepal ma 7 wata pradesh chhan: koshi, madhesh, bagmati, gandaki, lumbini, karnali ra sudurpashchim. pradesh haru bhitra 77 wata jilla chhan.'),
    (['nepal ko bhugol kasto chha?', 'nepal ko bhu-banot bhana'], 'nepal lai mukhya tin bhag ma bandna sakinchha: uttar ma himal, bich ma pahad ra dakshin ma samatal tarai. thorai duri ma uchai 70 meter dekhi 8848 meter samma ferinchha, tyasaile nepal ma hawapani ra janawar ko dherai bibidhata chha.'),
    (['dashain kina manaunchhan?', 'dashain ko mahattwa k ho?'], 'dashain ma asatya mathi satya ko bijaya ko utsav manaunchha: devi durga le mahishasur lai jiteko samjhana. pariwar bhela bhaera thula haru bata tika, jamara ra aashirbad linchhan. yo nepal ko sabai bhanda thulo chad ho.'),
    (['lumbini kina prasiddha chha?', 'buddha ko janmasthal kaha ho?'], 'lumbini, rupandehi jilla ma parne yo thau gautam buddha ko janmasthal ho. yaslai UNESCO le bishwa sampada suchi ma rakheko chha ra sansar bhari ka bauddha dharmabalambi tirtha garna aauchhan.'),

    # ---------------- language & thinking
    (['ramro sanga kasari sochne?', 'critical thinking k ho?'], 'ramro sochne bhaneko kunai kura manna agadi praman hernu ho. "yo kasle bhanyo, kasari thaha bhayo, arko tarika le pani huna sakchha?" bhanera sodhnus. aphno bichar galat bhaye badalna tayar hunu pani ramro sochai ho.'),
    (['nepali bhasha ma kati akshar chhan?', 'nepali barnamala bhana'], 'nepali devanagari lipi ma lekhinchha. sadharan taya 12 dekhi 13 swar ra 36 byanjan maaninchha, jasma ka, kha, ga bata suru hunchhan. romanized nepali ma bhane yahi shabda haru english akshar ma lekhinchhan, jastai "namaste".'),
    (['hasna kina ramro?', 'hasaile k fayda garchha?'], 'hasda sarir ma tension ghataune rasayan nikalinchha ra mann halka hunchha. sathi sanga hasda nata pani nijik hunchha. tyasaile sano kura ma pani hasna sakne bani ramro ho.'),
]
