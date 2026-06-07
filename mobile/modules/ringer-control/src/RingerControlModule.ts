import { requireNativeModule } from 'expo';

import type { RingerControlModule } from './RingerControl.types';

// Resolves the autolinked native module registered as `RingerControl` in the
// Kotlin `ModuleDefinition`. Throws at import time if the native module is
// missing — e.g. when running in Expo Go instead of the dev client.
export default requireNativeModule<RingerControlModule>('RingerControl');
