/**
 * Bangla names for the location header (F-07.4 / FR-5.1).
 *
 * Expo's on-device reverse geocoder returns place names in the *device* locale
 * (English on most phones), with no language option — so when the app language is
 * Bangla the header would still read "Khulna, Khulna District". Sakina is
 * Bangladesh-focused, so we translate the administrative names ourselves: the 8
 * divisions, 64 districts, and the common metro thanas/areas, plus the
 * "District"/"Division"/"Upazila" suffix words. Anything unmapped falls back to
 * its English name, so the header is never blank.
 *
 * Applied at *display* time ({@link ../../components/LocationHeader}), not when the
 * name is resolved/cached — so switching language re-localizes instantly and the
 * cached value stays canonical (English).
 */

import type { AppLocale } from './locale';

/** Administrative suffixes Android appends, e.g. "Khulna District". */
const SUFFIX_BN: Record<string, string> = {
  District: 'জেলা',
  Division: 'বিভাগ',
  Upazila: 'উপজেলা',
  Subdistrict: 'উপজেলা',
  City: 'সিটি',
};

// English → Bangla for Bangladesh place names. Divisions, all 64 districts (incl.
// common alternate spellings), and frequently-seen metro thanas/areas. Keyed on
// the exact string the geocoder returns (proper-case).
const EN_TO_BN: Record<string, string> = {
  // Divisions
  Dhaka: 'ঢাকা',
  Chittagong: 'চট্টগ্রাম',
  Chattogram: 'চট্টগ্রাম',
  Khulna: 'খুলনা',
  Rajshahi: 'রাজশাহী',
  Barisal: 'বরিশাল',
  Barishal: 'বরিশাল',
  Sylhet: 'সিলেট',
  Rangpur: 'রংপুর',
  Mymensingh: 'ময়মনসিংহ',

  // Dhaka division districts
  Faridpur: 'ফরিদপুর',
  Gazipur: 'গাজীপুর',
  Gopalganj: 'গোপালগঞ্জ',
  Kishoreganj: 'কিশোরগঞ্জ',
  Madaripur: 'মাদারীপুর',
  Manikganj: 'মানিকগঞ্জ',
  Munshiganj: 'মুন্শিগঞ্জ',
  Narayanganj: 'নারায়ণগঞ্জ',
  Narsingdi: 'নরসিংদী',
  Rajbari: 'রাজবাড়ী',
  Shariatpur: 'শরীয়তপুর',
  Tangail: 'টাঙ্গাইল',

  // Chittagong division districts
  Bandarban: 'বান্দরবান',
  Brahmanbaria: 'ব্রাহ্মণবাড়িয়া',
  Chandpur: 'চাঁদপুর',
  Comilla: 'কুমিল্লা',
  Cumilla: 'কুমিল্লা',
  "Cox's Bazar": 'কক্সবাজার',
  Feni: 'ফেনী',
  Khagrachhari: 'খাগড়াছড়ি',
  Khagrachari: 'খাগড়াছড়ি',
  Lakshmipur: 'লক্ষ্মীপুর',
  Noakhali: 'নোয়াখালী',
  Rangamati: 'রাঙ্গামাটি',

  // Khulna division districts
  Bagerhat: 'বাগেরহাট',
  Chuadanga: 'চুয়াডাঙ্গা',
  Jessore: 'যশোর',
  Jashore: 'যশোর',
  Jhenaidah: 'ঝিনাইদহ',
  Kushtia: 'কুষ্টিয়া',
  Magura: 'মাগুরা',
  Meherpur: 'মেহেরপুর',
  Narail: 'নড়াইল',
  Satkhira: 'সাতক্ষীরা',

  // Rajshahi division districts
  Bogra: 'বগুড়া',
  Bogura: 'বগুড়া',
  Joypurhat: 'জয়পুরহাট',
  Naogaon: 'নওগাঁ',
  Natore: 'নাটোর',
  Chapainawabganj: 'চাঁপাইনবাবগঞ্জ',
  Nawabganj: 'চাঁপাইনবাবগঞ্জ',
  Pabna: 'পাবনা',
  Sirajganj: 'সিরাজগঞ্জ',

  // Barisal division districts
  Barguna: 'বরগুনা',
  Bhola: 'ভোলা',
  Jhalokati: 'ঝালকাঠি',
  Patuakhali: 'পটুয়াখালী',
  Pirojpur: 'পিরোজপুর',

  // Sylhet division districts
  Habiganj: 'হবিগঞ্জ',
  Moulvibazar: 'মৌলভীবাজার',
  Sunamganj: 'সুনামগঞ্জ',

  // Rangpur division districts
  Dinajpur: 'দিনাজপুর',
  Gaibandha: 'গাইবান্ধা',
  Kurigram: 'কুড়িগ্রাম',
  Lalmonirhat: 'লালমনিরহাট',
  Nilphamari: 'নীলফামারী',
  Panchagarh: 'পঞ্চগড়',
  Thakurgaon: 'ঠাকুরগাঁও',

  // Mymensingh division districts
  Jamalpur: 'জামালপুর',
  Netrokona: 'নেত্রকোণা',
  Netrakona: 'নেত্রকোণা',
  Sherpur: 'শেরপুর',

  // Common Dhaka thanas / areas
  Dhanmondi: 'ধানমন্ডি',
  Gulshan: 'গুলশান',
  Banani: 'বনানী',
  Mirpur: 'মিরপুর',
  Uttara: 'উত্তরা',
  Mohammadpur: 'মোহাম্মদপুর',
  Motijheel: 'মতিঝিল',
  Tejgaon: 'তেজগাঁও',
  Badda: 'বাড্ডা',
  Jatrabari: 'যাত্রাবাড়ী',
  Khilgaon: 'খিলগাঁও',
  Rampura: 'রামপুরা',
  Shyamoli: 'শ্যামলী',
  Wari: 'ওয়ারী',
  Lalbagh: 'লালবাগ',
  Savar: 'সাভার',
  Keraniganj: 'কেরানীগঞ্জ',
  Mohakhali: 'মহাখালী',
  Bashundhara: 'বসুন্ধরা',

  // Common Khulna thanas / areas
  Khalishpur: 'খালিশপুর',
  Daulatpur: 'দৌলতপুর',
  Sonadanga: 'সোনাডাঙ্গা',
  Boyra: 'বয়রা',
};

/** Localize one place component, e.g. "Khulna District" → "খুলনা জেলা". */
function localizeComponent(component: string): string {
  const exact = EN_TO_BN[component];
  if (exact) {
    return exact;
  }
  // "<Name> District/Division/Upazila" → translate base + suffix.
  const match = component.match(/^(.*)\s+(\w+)$/);
  if (match) {
    const suffix = SUFFIX_BN[match[2]];
    if (suffix) {
      const base = EN_TO_BN[match[1]] ?? match[1];
      return `${base} ${suffix}`;
    }
  }
  return component; // unmapped — keep English rather than blank
}

/**
 * Localize a composed place label (e.g. "Khalishpur, Khulna") for the header.
 * A no-op for English; for Bangla, translates each comma-separated component
 * with English fallback for anything unmapped.
 */
export function localizePlaceLabel(label: string, locale: AppLocale): string {
  if (locale !== 'bn') {
    return label;
  }
  return label.split(', ').map(localizeComponent).join(', ');
}
