/**
 * Type definitions for the root navigation stack.
 *
 * Adding a screen here gives every navigator/route typed params for free.
 */
export type RootStackParamList = {
  Home: undefined;
};

declare global {
  namespace ReactNavigation {
    // Registers our param list globally so useNavigation() is typed without
    // having to pass generics at every call site.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
