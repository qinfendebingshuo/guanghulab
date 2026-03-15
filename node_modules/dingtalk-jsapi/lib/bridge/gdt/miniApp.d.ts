import { IJSBridge } from '../../modelDef';
import { BridgeCallbackResult } from './h5Mobile';
declare global {
    var my: {
        call: (method: string, args: object, callback: (result: BridgeCallbackResult) => void) => void;
    } & any;
}
declare const getMiniAppBridge: () => Promise<IJSBridge>;
export default getMiniAppBridge;
