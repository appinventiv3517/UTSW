/* UTSW MyCare logos, read from mycare-logo/ at build time (the logo files are never edited) and inlined as data URIs.
   utsw-mycare-reversed.svg: the UTSW MyCare header logo in white, for blue backgrounds (Admin header, sign-in panel,
   the app bar in the phone preview). app-icon.svg: the MyCare app icon (preview welcome and lock screens, browser tab). */
import reversed from '../../../mycare-logo/utsw-mycare-reversed.svg?raw';
import appIcon from '../../../mycare-logo/app-icon.svg?raw';

export const b64 = (s: string): string => btoa(unescape(encodeURIComponent(s)));
export const LOGO_REVERSED_B64 = b64(reversed);
export const LOGO_ICON_B64 = b64(appIcon);
export const LOGO_REVERSED = `data:image/svg+xml;base64,${LOGO_REVERSED_B64}`;
export const APP_ICON = `data:image/svg+xml;base64,${LOGO_ICON_B64}`;
