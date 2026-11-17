/* MyCare logos, read from mycare-logo/ at build time (the logo files are never edited) and inlined as data URIs */
import reversed from '../../../mycare-logo/reversed.svg?raw';
import horizontal from '../../../mycare-logo/horizontal.svg?raw';
import icon from '../../../mycare-logo/icon.svg?raw';

export const b64 = (s: string): string => btoa(unescape(encodeURIComponent(s)));
export const LOGO_REVERSED_B64 = b64(reversed);
export const LOGO_ICON_B64 = b64(icon);
export const LOGO_REVERSED = `data:image/svg+xml;base64,${LOGO_REVERSED_B64}`;
export const LOGO_HORIZONTAL = `data:image/svg+xml;base64,${b64(horizontal)}`;
