// A correr dentro da app Android (Capacitor), e não num navegador. Na app não há push web nem
// "instalar a app"; esses avisos e botões escondem-se.
import { Capacitor } from '@capacitor/core';

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();
