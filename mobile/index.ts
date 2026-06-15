import { registerRootComponent } from 'expo';

import App from './App';
// Registers the background geofencing task at module scope so it exists before
// TaskManager invokes it — including on a headless launch, where this entry
// module still runs but no React tree is mounted (FR-1.2).
import './src/lib/geofencing/task';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
