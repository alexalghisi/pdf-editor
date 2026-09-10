import { registerRootComponent } from 'expo';
import 'react-native-gesture-handler';

import App from './App';
import { installBuffer } from '@/shared/installBuffer';

installBuffer();

registerRootComponent(App);
