"""Large hand-written lexicons (romanized Nepali) for the generators. Small word lists let a tiny model memorise
surface forms; with hundreds of names/places/jobs/objects the only stable signal is *reading* the input."""

NAMES_M = ('ram hari shyam bikash suman nabin kiran dipak rajesh sagar anil sunil prakash binod ramesh suresh mahesh dinesh '
           'ganesh umesh rohan aayush bibek pratik sanjay bishal sujan santosh manish nirajan kamal bimal krishna gopal '
           'mohan sohan arjun bhim nakul sahadev kapil rabin roshan sudip pradip dilip anup arun barun tarun yogesh '
           'pasang tenzing nima dawa lakpa mingma pemba karma sonam ang dorje tashi ngima chhiring phurba '
           'bijay ajay nischal niraj neeraj saurav gaurav bipin bishnu shiva hem tek dev jeevan jiban raju saroj '
           'sushil kushal bishwas samir sameer amrit asmit ishan kushal milan nitesh ritesh saugat sumit utsav '
           'yubraj bhuwan bhupendra keshav madhav narayan purna rudra shankar tilak upendra').split()
NAMES_F = ('sita gita anita pooja sarita asha maya laxmi kamala sunita rita nisha binita sabina manisha rojina samjhana '
           'sushma srijana alisha anjali deepa radha sarala kalpana bimala nirmala pramila urmila sharmila rekha '
           'renu sangita sarina srijana tara uma yamuna ganga jamuna sapana smriti sneha prakriti aakriti aastha '
           'sangam pemba dolma lhamu yangchen pasang dawa chhiring ang nima ' 
           'bindu indu sunaina rupa dipika samikshya prerana kripa shristi sristi rachana suju sabita rojina '
           'mamata bandana nikita sujata parbati durga saraswati shanti kabita januka mina hira').split()
NAMES_F = [n for n in dict.fromkeys(NAMES_F) if n not in ('pemba', 'pasang', 'dawa', 'chhiring', 'ang', 'nima', 'sangam')]
NAMES_M = list(dict.fromkeys(NAMES_M))
PLACES = ('kathmandu lalitpur bhaktapur pokhara butwal bhairahawa dharan itahari biratnagar birgunj hetauda chitwan '
          'bharatpur nepalgunj dhangadhi mahendranagar janakpur rajbiraj lahan siraha gaur kalaiya jaleshwar malangwa '
          'ilam phidim taplejung dhankuta bhojpur khotang okhaldhunga solukhumbu ramechhap dolakha sindhupalchok '
          'kavre nuwakot dhading gorkha lamjung tanahun syangja palpa gulmi arghakhanchi baglung myagdi mustang '
          'parbat kaski banepa dhulikhel damauli waling tansen tulsipur ghorahi surkhet jumla dailekh salyan '
          'rukum rolpa pyuthan dang bardiya kailali kanchanpur dadeldhura baitadi darchula bajhang bajura achham doti '
          'birtamod damak mechinagar urlabari kakarvitta inaruwa gaighat triyuga').split()
JOBS = ['shikshak', 'doctor', 'engineer', 'kisan', 'driver', 'nurse', 'developer', 'bidyarthi', 'byapari', 'lekhak',
        'pilot', 'police', 'sipahi', 'wakil', 'patrakar', 'karmachari', 'bank karmachari', 'pasale', 'sikarmi', 'dakarmi',
        'darji', 'hajam', 'bhanse', 'gayak', 'chitrakar', 'photographer', 'designer', 'lekhapal', 'pharmacist',
        'professor', 'scientist', 'guide', 'porter', 'mistri', 'electrician', 'plumber', 'pujari', 'khelaadi',
        'coach', 'sampadak']
JOBS_EN = dict(shikshak='teacher', doctor='doctor', engineer='engineer', kisan='farmer', driver='driver', nurse='nurse',
               developer='developer', bidyarthi='student', byapari='businessman', lekhak='writer', pilot='pilot',
               police='police officer', sipahi='soldier', wakil='lawyer', patrakar='journalist', karmachari='employee',
               pasale='shopkeeper', sikarmi='carpenter', darji='tailor', hajam='barber', bhanse='cook', gayak='singer',
               chitrakar='painter', photographer='photographer', designer='designer', pharmacist='pharmacist',
               professor='professor', scientist='scientist', guide='guide', porter='porter', electrician='electrician',
               plumber='plumber', pujari='priest', coach='coach')
# countable things: (word, unit/classifier)
THINGS = [('syau', 'ota'), ('kera', 'ota'), ('suntala', 'ota'), ('aanp', 'ota'), ('anda', 'ota'), ('kitab', 'ota'),
          ('kapi', 'ota'), ('kalam', 'ota'), ('pencil', 'ota'), ('ballon', 'ota'), ('chakleti', 'ota'), ('biskut', 'packet'),
          ('chamal', 'kilo'), ('aalu', 'kilo'), ('pyaj', 'kilo'), ('golbheda', 'kilo'), ('chini', 'kilo'), ('dal', 'kilo'),
          ('dudh', 'liter'), ('pani', 'bottle'), ('tel', 'liter'), ('momo', 'plate'), ('chiya', 'cup'), ('coffee', 'cup'),
          ('roti', 'ota'), ('sel roti', 'ota'), ('samosa', 'ota'), ('kukhura', 'ota'), ('bakhra', 'ota'), ('gai', 'ota'),
          ('kurta', 'ota'), ('jutta', 'joda'), ('chappal', 'joda'), ('topi', 'ota'), ('jhola', 'ota'), ('ghadi', 'ota'),
          ('phone', 'ota'), ('ticket', 'ota'), ('phool', 'ota'), ('mala', 'ota'), ('diyo', 'ota'), ('photo', 'ota'),
          ('mobile', 'ota'), ('cycle', 'ota'), ('kursi', 'ota'), ('tebul', 'ota'), ('gamla', 'ota'), ('bijuli bati', 'ota')]
FOODS = ['momo', 'dal bhat', 'chowmein', 'sel roti', 'pizza', 'aalu tama', 'chiya', 'dhido', 'samosa', 'kheer', 'yomari',
         'chatamari', 'bara', 'sekuwa', 'thukpa', 'pani puri', 'jeri', 'lassi', 'gundruk', 'kodo ko roti', 'burger',
         'aalu paratha', 'chana', 'masu bhat', 'machha', 'juju dhau', 'laddu', 'barfi', 'malpuwa', 'khichadi']
HOBBIES = ['gita gaune', 'football khelne', 'kitab padhne', 'chitra banaune', 'coding garne', 'ghumna jaane', 'nachne',
           'cycle chalaune', 'cricket khelne', 'pauri khelne', 'photo khichne', 'guitar bajaune', 'kheti garne',
           'kabita lekhne', 'movie herne', 'chess khelne', 'yoga garne', 'pakaune', 'hiking jaane', 'basketball khelne',
           'madal bajaune', 'flute bajaune', 'blog lekhne', 'game khelne', 'ful ropne']
COLORS = ['rato', 'nilo', 'hariyo', 'pahelo', 'seto', 'kalo', 'khairo', 'gulabi', 'baijani', 'suntala rang', 'aakashe']
ANIMALS = ['kukur', 'biralo', 'gai', 'bakhra', 'ghoda', 'kharayo', 'suga', 'kukhura', 'hans', 'bhaisi', 'bhenda', 'machha']
PET_NAMES = ['tommy', 'kalu', 'mimi', 'bhote', 'tiger', 'jhyape', 'lucky', 'chhoti', 'raja', 'goldie', 'puntu', 'max', 'kale']
RELATIONS_M = ['dai', 'bhai', 'buwa', 'hajurba', 'mama', 'kaka', 'sathi', 'bhinaju']
RELATIONS_F = ['didi', 'bahini', 'aama', 'hajurama', 'maiju', 'kaki', 'sathi', 'bhauju']
TIMES = ['bihana 6 baje', 'bihana 7 baje', 'bihana 8 baje', 'bihana 9 baje', 'bihana 10 baje', 'diuso 12 baje',
         'diuso 1 baje', 'diuso 2 baje', 'diuso 3 baje', 'beluka 4 baje', 'beluka 5 baje', 'beluka 6 baje', 'beluka 7 baje',
         'raati 8 baje', 'raati 9 baje']
DAYS = ['aaitabar', 'sombar', 'mangalbar', 'budhabar', 'bihibar', 'sukrabar', 'sanibar']
VENUES = ['school', 'college', 'office', 'bazaar', 'hospital', 'mandir', 'pustakalaya', 'chautari', 'khet', 'maidan',
          'bank', 'pasal', 'bus park', 'park', 'restaurant', 'gym', 'hulak', 'thana', 'cinema hall', 'pokhari']
