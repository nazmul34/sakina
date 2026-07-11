/**
 * Translation tables for the app UI (English + Bangla).
 *
 * Keys are flat, dotted, and grouped by screen/area. `en` is the source of
 * truth; `bn` must provide the same keys (enforced by the `Record<TranslationKey,
 * string>` type on `bn`). `{token}` placeholders are filled at call time by
 * {@link ./index#translate}.
 *
 * Proper nouns that read the same in both languages (calculation-method names
 * like "Muslim World League", the "Sakina" wordmark) are intentionally not keyed
 * here — they stay in their source modules.
 */

export const en = {
  // Navigation — stack header titles
  'nav.permissions': 'Permissions',
  'nav.activity': 'Activity',
  'nav.pinnedZones': 'Pinned zones',
  'nav.pinLocation': 'Pin a location',
  'nav.savedMessages': 'Saved messages',
  'nav.dailyReminder': 'Daily reminder',
  'nav.prayerTimes': 'Prayer times',
  'nav.qibla': 'Qibla',
  'nav.appearance': 'Appearance',
  'nav.language': 'Language',
  // Navigation — bottom tabs
  'tab.home': 'Home',
  'tab.mosques': 'Nearby mosques',
  'tab.messages': 'Daily message',
  'tab.settings': 'Settings',

  // Shared
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.tryAgain': 'Try again',
  'common.share': 'Share',
  'common.remove': 'Remove',
  'common.report': 'Report',
  'common.navigate': 'Navigate',
  'common.notNow': 'Not now',
  'common.continue': 'Continue',
  'common.openSettings': 'Open settings',

  // Prayer names
  'prayer.fajr': 'Fajr',
  'prayer.dhuhr': 'Dhuhr',
  'prayer.asr': 'Asr',
  'prayer.maghrib': 'Maghrib',
  'prayer.isha': 'Isha',

  // Home
  'home.greeting': 'Assalamu alaikum',
  'home.tagline': 'Your phone, respectful around mosques and during prayer.',
  'home.quickActions': 'Quick actions',
  'home.nearbyMosques': 'Nearby mosques',
  'home.qiblaDirection': 'Qibla direction',
  'home.dailyMessage': 'Daily message',
  'home.prayerTimes': 'Prayer times',

  // Current-prayer card
  'currentPrayer.label': 'Current prayer',
  'currentPrayer.enableLocation':
    'Enable location to see prayer times and your countdown.',
  'currentPrayer.endsAt': 'ends {time}',
  'currentPrayer.remaining': '{time} left',

  // Auto-silent toggle
  'autoSilent.title': 'Auto-quiet',
  'autoSilent.subtitle':
    'Quiet your phone automatically near mosques and during prayer.',
  'autoSilent.silent': 'Silent',
  'autoSilent.vibrate': 'Vibrate',

  // Settings hub
  'settings.section.prayer': 'Prayer & worship',
  'settings.section.locations': 'Locations',
  'settings.section.messages': 'Messages',
  'settings.section.app': 'App',
  'settings.section.developer': 'Developer',
  'settings.prayerTimes.label': 'Prayer times',
  'settings.prayerTimes.subtitle': 'Calculation method and Asr school',
  'settings.qibla.label': 'Qibla direction',
  'settings.qibla.subtitle': 'Find the direction of the Kaaba',
  'settings.pinnedZones.label': 'Pinned zones',
  'settings.pinnedZones.subtitle': 'Custom places to silence your phone',
  'settings.savedMessages.label': 'Saved messages',
  'settings.savedMessages.subtitle': 'Your favourited reminders',
  'settings.dailyReminder.label': 'Daily reminder',
  'settings.dailyReminder.subtitle': 'A message at a time you choose',
  'settings.appearance.label': 'Appearance',
  'settings.appearance.subtitle': 'Light, dark, or system theme',
  'settings.language.label': 'Language',
  'settings.language.subtitle': 'English or Bangla',
  'settings.permissions.label': 'Permissions',
  'settings.permissions.subtitle': 'Location and Do Not Disturb access',
  'settings.activity.label': 'Activity log',
  'settings.activity.subtitle': 'When and where your phone was silenced',

  // Theme settings
  'theme.section': 'Theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'theme.schemeLight': 'light',
  'theme.schemeDark': 'dark',
  'theme.note':
    '“System” follows your device’s light/dark setting (currently {scheme}). Your choice is saved on this device and synced to your other devices.',

  // Language settings
  'language.section': 'Language',
  'language.note':
    'Choose the language for the app. Your choice is saved on this device.',

  // Daily message screen
  'dailyMessage.all': 'All',
  'dailyMessage.quran': 'Qur’an',
  'dailyMessage.hadith': 'Hadith',
  'dailyMessage.dua': 'Du’a',
  'dailyMessage.reminder': 'Reminder',
  'dailyMessage.filterBy': 'Filter by {label}',
  'dailyMessage.noMessages': 'No messages',
  'dailyMessage.noMessagesBody': 'There are no messages in this category yet.',
  'dailyMessage.loadError': 'Couldn’t load a message',
  'dailyMessage.loadErrorBody': 'Check your connection and try again.',
  'dailyMessage.shareText': 'Share text',
  'dailyMessage.shareImage': 'Share as image',
  'dailyMessage.preparingImage': 'Preparing image…',
  'dailyMessage.next': 'Next message',
  'dailyMessage.saveMessage': 'Save message',
  'dailyMessage.removeFromSaved': 'Remove from saved',
  'dailyMessage.shareAsText': 'Share this message as text',
  'dailyMessage.shareAsImage': 'Share this message as an image card',
  'dailyMessage.sharingUnavailable': 'Sharing unavailable',
  'dailyMessage.sharingUnavailableBody':
    'Image sharing is not available on this device.',
  'dailyMessage.imageError': 'Could not create image',
  'dailyMessage.imageErrorBody': 'Something went wrong rendering the card.',
  'dailyMessage.shareDialogTitle': 'Share message card',

  // Saved messages
  'savedMessages.empty': 'No saved messages',
  'savedMessages.emptyBody':
    'Tap the heart on a daily message to save it here. Your saved list is available offline.',

  // Share image card
  'shareCard.kicker': 'Daily reminder',
  'shareCard.tagline': 'Find your calm',

  // Prayer settings screen
  'prayerSettings.todaysTimes': 'Today’s times',
  'prayerSettings.next': 'Next',
  'prayerSettings.locationHintSaved':
    'Grant location access to preview your prayer times. Your method choice below is still saved.',
  'prayerSettings.calcMethod': 'Calculation method',
  'prayerSettings.asrCalc': 'Asr calculation',
  'prayerSettings.asrStandard': 'Standard (Shafiʿi)',
  'prayerSettings.asrHanafi': 'Hanafi',
  'prayerSettings.reminders': 'Reminders',
  'prayerSettings.prayerReminders': 'Prayer reminders',
  'prayerSettings.prayerRemindersSub': 'A notification at each prayer time.',
  'prayerSettings.playSound': 'Play sound',
  'prayerSettings.prayerAware': 'Prayer-aware silent',
  'prayerSettings.tighten': 'Tighten around prayer',
  'prayerSettings.tightenSub':
    'Near a mosque, silence around each prayer (from just before jamaat to the end of salah) rather than the whole time you’re nearby.',
  'prayerSettings.activeNow': 'Active now',
  'prayerSettings.noPrayerWindow': 'No prayer window',
  'prayerSettings.windowUntil': '{prayer} · until {time}',
  'prayerSettings.note':
    'Prayer times are computed on your device from your location — no account needed, and they work offline. Reminders are scheduled locally and play the default notification sound. Prayer-aware silent is optional and off by default.',
  'prayerSettings.notifOff': 'Notifications off',
  'prayerSettings.notifOffBody':
    'Enable notifications for Sakina in your system settings to get prayer reminders.',

  // Qibla screen
  'qibla.locationNeeded': 'Location needed',
  'qibla.locationNeededBody':
    'Allow location access so Sakina can work out which way the Qibla is from where you are.',
  'qibla.setupPermissions': 'Set up permissions',
  'qibla.couldntFind': 'Couldn’t find you',
  'qibla.couldntFindBody':
    'We couldn’t get your location to compute the Qibla. Please try again.',
  'qibla.finding': 'Finding the Qibla…',
  'qibla.noSensor': 'No compass sensor',
  'qibla.noSensorBefore':
    'This device has no magnetometer, so the live compass isn’t available. The Qibla is ',
  'qibla.noSensorAfter': ' from north.',
  'qibla.heading': 'Qibla',
  'qibla.facingSubtitle': 'You’re facing the Qibla — {kaaba} is at the top.',
  'qibla.turnSubtitle': 'Turn until the {kaaba} reaches the top marker.',
  'qibla.facingReadout': 'Facing the Qibla',
  'qibla.fromNorth': 'Qibla from north',

  // Nearby mosques
  'mosques.finding': 'Finding mosques near you…',
  'mosques.locationNeeded': 'Location needed',
  'mosques.couldntLoad': 'Couldn’t load mosques',
  'mosques.locationNeededBody':
    'Allow location access so Sakina can find mosques near you.',
  'mosques.connectionBody': 'Check your connection and try again.',
  'mosques.setupPermissions': 'Set up permissions',
  'mosques.noneNearby': 'No mosques nearby',
  'mosques.noneNearbyBody':
    'We couldn’t find any mosques within range of your location.',
  'mosques.stale': 'Showing saved results from {time} — couldn’t refresh.',
  'mosques.updated': 'Updated {time}',
  'mosques.navigateTo': 'Navigate to {name}',
  'mosques.reportAs': 'Report {name} as incorrect',
  'mosques.reportTitle': 'Report incorrect mosque',
  'mosques.reportMessage':
    'Let us know “{name}” looks wrong — closed, misnamed, or not a mosque. We’ll review it.',
  'mosques.reportThanks': 'Thanks for the report',
  'mosques.reportThanksBody': 'We’ll review this mosque’s details.',
  'mosques.reportFailed': 'Could not send report',
  'mosques.reportFailedBody': 'Please try again in a moment.',
  'mosques.couldntOpenMaps': 'Could not open maps',
  'mosques.couldntOpenMapsBody': 'No maps app is available to navigate.',
  'mosques.justNow': 'just now',
  'mosques.minAgo': '{n} min ago',
  'mosques.hAgo': '{n} h ago',

  // Daily reminder screen
  'dailyReminderScreen.title': 'Daily reminder',
  'dailyReminderScreen.subtitle':
    'Get one message as a notification at a time you choose.',
  'dailyReminderScreen.time': 'Time',
  'dailyReminderScreen.changeTime': 'Change reminder time',
  'dailyReminderScreen.note':
    'Reminders are scheduled on your device — no account needed, and they work offline.',
  'dailyReminderScreen.notifOff': 'Notifications off',
  'dailyReminderScreen.notifOffBody':
    'Enable notifications for Sakina in your system settings to get daily reminders.',

  // Activity log
  'activity.empty': 'No activity yet',
  'activity.emptyBody':
    'When auto-silent silences your phone near a mosque and restores it after you leave, those events show up here.',
  'activity.clearLog': 'Clear log',
  'activity.clearTitle': 'Clear activity log?',
  'activity.clearMessage':
    'This removes all recorded events. This can’t be undone.',
  'activity.clear': 'Clear',
  'activity.silencedNear': 'Silenced near {zone}',
  'activity.restoredLeaving': 'Restored leaving {zone}',
  'activity.pinnedZone': 'a pinned zone',
  'activity.nearbyMosque': 'a nearby mosque',

  // Permissions
  'permissions.intro':
    'Auto-silent needs these four permissions to silence your phone near mosques — even when the app is closed.',
  'permissions.allSet': '✓ All set — you’re covered.',
  'permissions.granted': 'Granted',
  'permissions.fix': 'Fix',
  'permissions.fixLabel': 'Fix {title}',
  'permissions.dnd.title': 'Do Not Disturb access',
  'permissions.dnd.desc':
    'Lets Sakina silence — and restore — your ringer near mosques.',
  'permissions.location.title': 'Location — “Allow all the time”',
  'permissions.location.desc':
    'Detects when you arrive at and leave a mosque, even in the background.',
  'permissions.notifications.title': 'Notifications',
  'permissions.notifications.desc':
    'Shows the ongoing auto-silent status and any warnings.',
  'permissions.battery.title': 'Ignore battery optimization',
  'permissions.battery.desc':
    'Stops the system from delaying auto-silent while idle.',
  'permissions.locationOffTitle': 'Location is turned off',
  'permissions.locationOffBody':
    'Enable Location for Sakina in system settings, then choose “Allow all the time”.',
  'permissions.locationAccessTitle': 'Location access',
  'permissions.locationAccessBody':
    'Sakina uses your location to silence your phone near mosques and during prayer. First allow location, then choose “Allow all the time”.',
  'permissions.allTimeTitle': 'Allow all the time',
  'permissions.allTimeBody':
    'So silencing keeps working when the app is closed, set Location to “Allow all the time” on the next screen.',

  // Pinned zones list
  'pinned.emptyTitle': 'No pinned zones yet',
  'pinned.emptyBody':
    'Drop a pin on a spot — like your local masjid — to make it a silent zone, even if it isn’t in our mosque data.',
  'pinned.editLabel': 'Edit {label}',
  'pinned.unlabelledForEdit': 'unlabelled pin',
  'pinned.unlabelled': 'Unlabelled pin',
  'pinned.radius': '{radius} radius',
  'pinned.addPin': '+ Add a pin',

  // Pin editor
  'pinEditor.findingLocation': 'Finding your location…',
  'pinEditor.tapHint': 'Tap the map or drag the pin to set the spot.',
  'pinEditor.suggested': 'Suggested',
  'pinEditor.label': 'Label',
  'pinEditor.labelPlaceholder': 'e.g. My local masjid',
  'pinEditor.radius': 'Radius',
  'pinEditor.saveChanges': 'Save changes',
  'pinEditor.savePin': 'Save pin',
  'pinEditor.deletePin': 'Delete pin',
  'pinEditor.deleteTitle': 'Delete this pin?',
  'pinEditor.deleteMessage':
    'This silent zone will be removed from this device.',
  'pinEditor.delete': 'Delete',

  // Notification bodies
  'notif.dailyTitle': 'Daily reminder',
  'notif.dailyFallback': 'Open Sakina for today’s reminder.',
} as const;

export type TranslationKey = keyof typeof en;

export const bn: Record<TranslationKey, string> = {
  // Navigation — stack header titles
  'nav.permissions': 'অনুমতিসমূহ',
  'nav.activity': 'কার্যকলাপ',
  'nav.pinnedZones': 'পিন করা এলাকা',
  'nav.pinLocation': 'একটি স্থান পিন করুন',
  'nav.savedMessages': 'সংরক্ষিত বার্তা',
  'nav.dailyReminder': 'দৈনিক অনুস্মারক',
  'nav.prayerTimes': 'নামাজের সময়',
  'nav.qibla': 'কিবলা',
  'nav.appearance': 'অ্যাপের চেহারা',
  'nav.language': 'ভাষা',
  // Navigation — bottom tabs
  'tab.home': 'হোম',
  'tab.mosques': 'কাছের মসজিদ',
  'tab.messages': 'দৈনিক বার্তা',
  'tab.settings': 'সেটিংস',

  // Shared
  'common.cancel': 'বাতিল',
  'common.confirm': 'নিশ্চিত করুন',
  'common.tryAgain': 'আবার চেষ্টা করুন',
  'common.share': 'শেয়ার',
  'common.remove': 'সরান',
  'common.report': 'রিপোর্ট',
  'common.navigate': 'দিকনির্দেশ',
  'common.notNow': 'এখন নয়',
  'common.continue': 'চালিয়ে যান',
  'common.openSettings': 'সেটিংস খুলুন',

  // Prayer names
  'prayer.fajr': 'ফজর',
  'prayer.dhuhr': 'যোহর',
  'prayer.asr': 'আসর',
  'prayer.maghrib': 'মাগরিব',
  'prayer.isha': 'এশা',

  // Home
  'home.greeting': 'আসসালামু আলাইকুম',
  'home.tagline': 'মসজিদের কাছে ও নামাজের সময় আপনার ফোন থাকবে শ্রদ্ধাশীল।',
  'home.quickActions': 'দ্রুত কাজ',
  'home.nearbyMosques': 'কাছের মসজিদ',
  'home.qiblaDirection': 'কিবলার দিক',
  'home.dailyMessage': 'দৈনিক বার্তা',
  'home.prayerTimes': 'নামাজের সময়',

  // Current-prayer card
  'currentPrayer.label': 'বর্তমান নামাজ',
  'currentPrayer.enableLocation':
    'নামাজের সময় ও কাউন্টডাউন দেখতে লোকেশন চালু করুন।',
  'currentPrayer.endsAt': 'শেষ {time}',
  'currentPrayer.remaining': '{time} বাকি',

  // Auto-silent toggle
  'autoSilent.title': 'স্বয়ংক্রিয় নীরবতা',
  'autoSilent.subtitle':
    'মসজিদের কাছে ও নামাজের সময় ফোন স্বয়ংক্রিয়ভাবে নীরব হবে।',
  'autoSilent.silent': 'নীরব',
  'autoSilent.vibrate': 'কম্পন',

  // Settings hub
  'settings.section.prayer': 'নামাজ ও ইবাদত',
  'settings.section.locations': 'স্থান',
  'settings.section.messages': 'বার্তা',
  'settings.section.app': 'অ্যাপ',
  'settings.section.developer': 'ডেভেলপার',
  'settings.prayerTimes.label': 'নামাজের সময়',
  'settings.prayerTimes.subtitle': 'গণনা পদ্ধতি ও আসরের মাযহাব',
  'settings.qibla.label': 'কিবলার দিক',
  'settings.qibla.subtitle': 'কাবার দিক নির্ণয় করুন',
  'settings.pinnedZones.label': 'পিন করা এলাকা',
  'settings.pinnedZones.subtitle': 'ফোন নীরব করার নিজস্ব স্থান',
  'settings.savedMessages.label': 'সংরক্ষিত বার্তা',
  'settings.savedMessages.subtitle': 'আপনার পছন্দের অনুস্মারক',
  'settings.dailyReminder.label': 'দৈনিক অনুস্মারক',
  'settings.dailyReminder.subtitle': 'আপনার বেছে নেওয়া সময়ে একটি বার্তা',
  'settings.appearance.label': 'অ্যাপের চেহারা',
  'settings.appearance.subtitle': 'লাইট, ডার্ক বা সিস্টেম থিম',
  'settings.language.label': 'ভাষা',
  'settings.language.subtitle': 'ইংরেজি বা বাংলা',
  'settings.permissions.label': 'অনুমতিসমূহ',
  'settings.permissions.subtitle': 'লোকেশন ও ডু নট ডিস্টার্ব অ্যাক্সেস',
  'settings.activity.label': 'কার্যকলাপের লগ',
  'settings.activity.subtitle': 'কখন ও কোথায় আপনার ফোন নীরব হয়েছিল',

  // Theme settings
  'theme.section': 'থিম',
  'theme.light': 'লাইট',
  'theme.dark': 'ডার্ক',
  'theme.system': 'সিস্টেম',
  'theme.schemeLight': 'লাইট',
  'theme.schemeDark': 'ডার্ক',
  'theme.note':
    '“সিস্টেম” আপনার ডিভাইসের লাইট/ডার্ক সেটিং অনুসরণ করে (বর্তমানে {scheme})। আপনার পছন্দ এই ডিভাইসে সংরক্ষিত ও অন্য ডিভাইসে সিঙ্ক হয়।',

  // Language settings
  'language.section': 'ভাষা',
  'language.note':
    'অ্যাপের ভাষা বেছে নিন। আপনার পছন্দ এই ডিভাইসে সংরক্ষিত হয়।',

  // Daily message screen
  'dailyMessage.all': 'সব',
  'dailyMessage.quran': 'কুরআন',
  'dailyMessage.hadith': 'হাদিস',
  'dailyMessage.dua': 'দোয়া',
  'dailyMessage.reminder': 'উপদেশ',
  'dailyMessage.filterBy': '{label} দিয়ে ফিল্টার করুন',
  'dailyMessage.noMessages': 'কোনো বার্তা নেই',
  'dailyMessage.noMessagesBody': 'এই বিভাগে এখনো কোনো বার্তা নেই।',
  'dailyMessage.loadError': 'বার্তা লোড করা যায়নি',
  'dailyMessage.loadErrorBody': 'সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
  'dailyMessage.shareText': 'টেক্সট শেয়ার করুন',
  'dailyMessage.shareImage': 'ছবি হিসেবে শেয়ার করুন',
  'dailyMessage.preparingImage': 'ছবি প্রস্তুত হচ্ছে…',
  'dailyMessage.next': 'পরবর্তী বার্তা',
  'dailyMessage.saveMessage': 'বার্তা সংরক্ষণ করুন',
  'dailyMessage.removeFromSaved': 'সংরক্ষণ থেকে সরান',
  'dailyMessage.shareAsText': 'এই বার্তাটি টেক্সট হিসেবে শেয়ার করুন',
  'dailyMessage.shareAsImage': 'এই বার্তাটি ছবি কার্ড হিসেবে শেয়ার করুন',
  'dailyMessage.sharingUnavailable': 'শেয়ারিং অনুপলব্ধ',
  'dailyMessage.sharingUnavailableBody': 'এই ডিভাইসে ছবি শেয়ার করা যায় না।',
  'dailyMessage.imageError': 'ছবি তৈরি করা যায়নি',
  'dailyMessage.imageErrorBody': 'কার্ড তৈরিতে সমস্যা হয়েছে।',
  'dailyMessage.shareDialogTitle': 'বার্তা কার্ড শেয়ার করুন',

  // Saved messages
  'savedMessages.empty': 'কোনো সংরক্ষিত বার্তা নেই',
  'savedMessages.emptyBody':
    'দৈনিক বার্তায় হার্টে ট্যাপ করে এখানে সংরক্ষণ করুন। আপনার তালিকা অফলাইনেও পাওয়া যাবে।',

  // Share image card
  'shareCard.kicker': 'দৈনিক অনুস্মারক',
  'shareCard.tagline': 'খুঁজে নিন প্রশান্তি',

  // Prayer settings screen
  'prayerSettings.todaysTimes': 'আজকের সময়সূচি',
  'prayerSettings.next': 'পরবর্তী',
  'prayerSettings.locationHintSaved':
    'নামাজের সময় দেখতে লোকেশন অ্যাক্সেস দিন। নিচের পদ্ধতির পছন্দ সংরক্ষিত থাকবে।',
  'prayerSettings.calcMethod': 'গণনা পদ্ধতি',
  'prayerSettings.asrCalc': 'আসর গণনা',
  'prayerSettings.asrStandard': 'স্ট্যান্ডার্ড (শাফিঈ)',
  'prayerSettings.asrHanafi': 'হানাফি',
  'prayerSettings.reminders': 'অনুস্মারক',
  'prayerSettings.prayerReminders': 'নামাজের অনুস্মারক',
  'prayerSettings.prayerRemindersSub': 'প্রতি নামাজের সময় একটি নোটিফিকেশন।',
  'prayerSettings.playSound': 'শব্দ বাজান',
  'prayerSettings.prayerAware': 'নামাজ-সচেতন নীরবতা',
  'prayerSettings.tighten': 'নামাজের সময় কঠোর করুন',
  'prayerSettings.tightenSub':
    'মসজিদের কাছে পুরো সময় নয়, বরং প্রতি নামাজের আশপাশে (জামাতের ঠিক আগে থেকে সালাত শেষ পর্যন্ত) নীরব করুন।',
  'prayerSettings.activeNow': 'এখন সক্রিয়',
  'prayerSettings.noPrayerWindow': 'কোনো নামাজের সময় নেই',
  'prayerSettings.windowUntil': '{prayer} · {time} পর্যন্ত',
  'prayerSettings.note':
    'নামাজের সময় আপনার ডিভাইসে অবস্থান থেকে গণনা করা হয় — কোনো অ্যাকাউন্ট লাগে না, অফলাইনেও কাজ করে। অনুস্মারক স্থানীয়ভাবে নির্ধারিত হয় ও ডিফল্ট নোটিফিকেশন শব্দ বাজায়। নামাজ-সচেতন নীরবতা ঐচ্ছিক এবং ডিফল্টে বন্ধ থাকে।',
  'prayerSettings.notifOff': 'নোটিফিকেশন বন্ধ',
  'prayerSettings.notifOffBody':
    'নামাজের অনুস্মারক পেতে সিস্টেম সেটিংসে Sakina-র নোটিফিকেশন চালু করুন।',

  // Qibla screen
  'qibla.locationNeeded': 'লোকেশন প্রয়োজন',
  'qibla.locationNeededBody':
    'আপনার অবস্থান থেকে কিবলার দিক নির্ণয় করতে লোকেশন অ্যাক্সেস দিন।',
  'qibla.setupPermissions': 'অনুমতি সেট আপ করুন',
  'qibla.couldntFind': 'আপনাকে খুঁজে পাওয়া যায়নি',
  'qibla.couldntFindBody':
    'কিবলা নির্ণয়ে আপনার অবস্থান পাওয়া যায়নি। আবার চেষ্টা করুন।',
  'qibla.finding': 'কিবলা খোঁজা হচ্ছে…',
  'qibla.noSensor': 'কম্পাস সেন্সর নেই',
  'qibla.noSensorBefore':
    'এই ডিভাইসে ম্যাগনেটোমিটার নেই, তাই লাইভ কম্পাস পাওয়া যাচ্ছে না। কিবলা উত্তর থেকে ',
  'qibla.noSensorAfter': '।',
  'qibla.heading': 'কিবলা',
  'qibla.facingSubtitle': 'আপনি কিবলামুখী — {kaaba} উপরে আছে।',
  'qibla.turnSubtitle': '{kaaba} উপরের চিহ্নে না আসা পর্যন্ত ঘুরুন।',
  'qibla.facingReadout': 'কিবলামুখী',
  'qibla.fromNorth': 'উত্তর থেকে কিবলা',

  // Nearby mosques
  'mosques.finding': 'আপনার কাছের মসজিদ খোঁজা হচ্ছে…',
  'mosques.locationNeeded': 'লোকেশন প্রয়োজন',
  'mosques.couldntLoad': 'মসজিদ লোড করা যায়নি',
  'mosques.locationNeededBody':
    'কাছের মসজিদ খুঁজতে লোকেশন অ্যাক্সেস দিন।',
  'mosques.connectionBody': 'সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
  'mosques.setupPermissions': 'অনুমতি সেট আপ করুন',
  'mosques.noneNearby': 'কাছে কোনো মসজিদ নেই',
  'mosques.noneNearbyBody':
    'আপনার অবস্থানের কাছাকাছি কোনো মসজিদ পাওয়া যায়নি।',
  'mosques.stale': '{time} এর সংরক্ষিত ফলাফল দেখানো হচ্ছে — রিফ্রেশ করা যায়নি।',
  'mosques.updated': 'আপডেট {time}',
  'mosques.navigateTo': '{name} এ দিকনির্দেশ',
  'mosques.reportAs': '{name} ভুল হিসেবে রিপোর্ট করুন',
  'mosques.reportTitle': 'ভুল মসজিদ রিপোর্ট করুন',
  'mosques.reportMessage':
    '“{name}” ভুল মনে হলে জানান — বন্ধ, ভুল নাম, বা মসজিদ নয়। আমরা যাচাই করব।',
  'mosques.reportThanks': 'রিপোর্টের জন্য ধন্যবাদ',
  'mosques.reportThanksBody': 'আমরা এই মসজিদের তথ্য যাচাই করব।',
  'mosques.reportFailed': 'রিপোর্ট পাঠানো যায়নি',
  'mosques.reportFailedBody': 'একটু পরে আবার চেষ্টা করুন।',
  'mosques.couldntOpenMaps': 'মানচিত্র খোলা যায়নি',
  'mosques.couldntOpenMapsBody': 'দিকনির্দেশের জন্য কোনো মানচিত্র অ্যাপ নেই।',
  'mosques.justNow': 'এইমাত্র',
  'mosques.minAgo': '{n} মিনিট আগে',
  'mosques.hAgo': '{n} ঘণ্টা আগে',

  // Daily reminder screen
  'dailyReminderScreen.title': 'দৈনিক অনুস্মারক',
  'dailyReminderScreen.subtitle':
    'আপনার বেছে নেওয়া সময়ে একটি বার্তা নোটিফিকেশন হিসেবে পান।',
  'dailyReminderScreen.time': 'সময়',
  'dailyReminderScreen.changeTime': 'অনুস্মারকের সময় পরিবর্তন করুন',
  'dailyReminderScreen.note':
    'অনুস্মারক আপনার ডিভাইসে নির্ধারিত হয় — কোনো অ্যাকাউন্ট লাগে না, অফলাইনেও কাজ করে।',
  'dailyReminderScreen.notifOff': 'নোটিফিকেশন বন্ধ',
  'dailyReminderScreen.notifOffBody':
    'দৈনিক অনুস্মারক পেতে সিস্টেম সেটিংসে Sakina-র নোটিফিকেশন চালু করুন।',

  // Activity log
  'activity.empty': 'এখনো কোনো কার্যকলাপ নেই',
  'activity.emptyBody':
    'মসজিদের কাছে স্বয়ংক্রিয় নীরবতা আপনার ফোন নীরব করলে ও বেরোনোর পর ফিরিয়ে দিলে সেই ঘটনাগুলো এখানে দেখা যাবে।',
  'activity.clearLog': 'লগ মুছুন',
  'activity.clearTitle': 'কার্যকলাপের লগ মুছবেন?',
  'activity.clearMessage': 'এটি সব রেকর্ড করা ঘটনা মুছে দেবে। এটি আর ফেরানো যাবে না।',
  'activity.clear': 'মুছুন',
  'activity.silencedNear': '{zone} এর কাছে নীরব করা হয়েছিল',
  'activity.restoredLeaving': '{zone} ছাড়ার পর ফিরিয়ে দেওয়া হয়েছিল',
  'activity.pinnedZone': 'একটি পিন করা এলাকা',
  'activity.nearbyMosque': 'কাছের একটি মসজিদ',

  // Permissions
  'permissions.intro':
    'অ্যাপ বন্ধ থাকলেও মসজিদের কাছে ফোন নীরব করতে স্বয়ংক্রিয় নীরবতার এই চারটি অনুমতি প্রয়োজন।',
  'permissions.allSet': '✓ সব প্রস্তুত — আপনি সুরক্ষিত।',
  'permissions.granted': 'অনুমোদিত',
  'permissions.fix': 'ঠিক করুন',
  'permissions.fixLabel': '{title} ঠিক করুন',
  'permissions.dnd.title': 'ডু নট ডিস্টার্ব অ্যাক্সেস',
  'permissions.dnd.desc':
    'মসজিদের কাছে আপনার রিংগার নীরব ও পুনরায় চালু করতে Sakina-কে অনুমতি দেয়।',
  'permissions.location.title': 'লোকেশন — “সব সময় অনুমতি দিন”',
  'permissions.location.desc':
    'ব্যাকগ্রাউন্ডেও আপনি কখন মসজিদে পৌঁছান ও ছাড়েন তা শনাক্ত করে।',
  'permissions.notifications.title': 'নোটিফিকেশন',
  'permissions.notifications.desc':
    'চলমান স্বয়ংক্রিয় নীরবতার অবস্থা ও যেকোনো সতর্কতা দেখায়।',
  'permissions.battery.title': 'ব্যাটারি অপটিমাইজেশন উপেক্ষা করুন',
  'permissions.battery.desc':
    'নিষ্ক্রিয় থাকাকালে সিস্টেমকে স্বয়ংক্রিয় নীরবতা বিলম্বিত করা থেকে বিরত রাখে।',
  'permissions.locationOffTitle': 'লোকেশন বন্ধ আছে',
  'permissions.locationOffBody':
    'সিস্টেম সেটিংসে Sakina-র লোকেশন চালু করে “সব সময় অনুমতি দিন” বেছে নিন।',
  'permissions.locationAccessTitle': 'লোকেশন অ্যাক্সেস',
  'permissions.locationAccessBody':
    'Sakina মসজিদের কাছে ও নামাজের সময় আপনার ফোন নীরব করতে আপনার অবস্থান ব্যবহার করে। প্রথমে লোকেশন অনুমতি দিন, তারপর “সব সময় অনুমতি দিন” বেছে নিন।',
  'permissions.allTimeTitle': 'সব সময় অনুমতি দিন',
  'permissions.allTimeBody':
    'অ্যাপ বন্ধ থাকলেও নীরবতা চালু রাখতে পরবর্তী স্ক্রিনে লোকেশন “সব সময় অনুমতি দিন”-এ সেট করুন।',

  // Pinned zones list
  'pinned.emptyTitle': 'এখনো কোনো পিন করা এলাকা নেই',
  'pinned.emptyBody':
    'আমাদের মসজিদ ডেটায় না থাকলেও — যেমন আপনার এলাকার মসজিদ — কোনো স্থানে পিন দিয়ে সেটিকে নীরব এলাকা বানান।',
  'pinned.editLabel': '{label} সম্পাদনা করুন',
  'pinned.unlabelledForEdit': 'নামহীন পিন',
  'pinned.unlabelled': 'নামহীন পিন',
  'pinned.radius': '{radius} ব্যাসার্ধ',
  'pinned.addPin': '+ পিন যোগ করুন',

  // Pin editor
  'pinEditor.findingLocation': 'আপনার অবস্থান খোঁজা হচ্ছে…',
  'pinEditor.tapHint': 'স্থান নির্ধারণে মানচিত্রে ট্যাপ করুন বা পিন টেনে আনুন।',
  'pinEditor.suggested': 'প্রস্তাবিত',
  'pinEditor.label': 'নাম',
  'pinEditor.labelPlaceholder': 'যেমন আমার এলাকার মসজিদ',
  'pinEditor.radius': 'ব্যাসার্ধ',
  'pinEditor.saveChanges': 'পরিবর্তন সংরক্ষণ করুন',
  'pinEditor.savePin': 'পিন সংরক্ষণ করুন',
  'pinEditor.deletePin': 'পিন মুছুন',
  'pinEditor.deleteTitle': 'এই পিনটি মুছবেন?',
  'pinEditor.deleteMessage': 'এই নীরব এলাকাটি এই ডিভাইস থেকে সরিয়ে ফেলা হবে।',
  'pinEditor.delete': 'মুছুন',

  // Notification bodies
  'notif.dailyTitle': 'দৈনিক অনুস্মারক',
  'notif.dailyFallback': 'আজকের অনুস্মারকের জন্য Sakina খুলুন।',
};

export const translations = { en, bn } as const;
