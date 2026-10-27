import { registerRootComponent } from 'expo';
import { getRandomBytes } from 'expo-crypto';
import { setSecureRandom } from '@cipherlink/shared';
import App from './App';
setSecureRandom(getRandomBytes);
registerRootComponent(App);
