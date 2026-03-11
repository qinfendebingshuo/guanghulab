import { IENV, IPlatformConfig, Sdk } from './sdk';
export { ENV_ENUM, APP_TYPE, ENV_ENUM_SUB } from './sdk';
declare global {
    var __dingtalk_jsapi_top_platfrom_config__: IPlatformConfig | undefined;
    interface Navigator {
        swuserAgent: any;
    }
    var my: any;
    var __useNativeSDK: boolean;
    var __ddSDK: Sdk;
}
export declare const getUA: () => string;
export declare const getENV: () => IENV;
