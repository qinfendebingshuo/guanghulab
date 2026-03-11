import { IJSBridge } from '../../modelDef';
export declare enum BRIDGE_ERROR_CODE {
    SUCCESS = "0"
}
export interface BridgeCallbackResult {
    errorCode?: BRIDGE_ERROR_CODE;
    errorMessage?: string;
    result?: any;
    success?: 'true' | 'false';
}
export declare function handleBridgeResponse(result: BridgeCallbackResult, resolve: any, reject: any, params?: any): void;
declare const getMobileBridge: () => Promise<IJSBridge>;
export default getMobileBridge;
