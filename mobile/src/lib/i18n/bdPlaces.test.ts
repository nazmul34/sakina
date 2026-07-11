import { localizePlaceLabel } from './bdPlaces';

describe('localizePlaceLabel', () => {
  it('is a no-op for English', () => {
    expect(localizePlaceLabel('Khulna, Khulna District', 'en')).toBe(
      'Khulna, Khulna District',
    );
  });

  it('translates division/district suffixes and names for Bangla', () => {
    expect(localizePlaceLabel('Khulna, Khulna District', 'bn')).toBe(
      'খুলনা, খুলনা জেলা',
    );
    expect(localizePlaceLabel('Dhaka, Dhaka Division', 'bn')).toBe(
      'ঢাকা, ঢাকা বিভাগ',
    );
  });

  it('translates a thana + district pair', () => {
    expect(localizePlaceLabel('Khalishpur, Khulna', 'bn')).toBe(
      'খালিশপুর, খুলনা',
    );
  });

  it('keeps unmapped components in English rather than blanking', () => {
    expect(localizePlaceLabel('Springfield, Khulna', 'bn')).toBe(
      'Springfield, খুলনা',
    );
  });
});
