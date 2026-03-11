export declare const addWatchParamsDeal: (params: any) => any;
export declare const addDefaultCorpIdParamsDeal: (params: any) => any;
export declare const genDefaultParamsDealFn: (defaultParams: object) => (params: any) => any;
export declare const forceChangeParamsDealFn: (forceParams: object) => (params: any) => any;
export declare const genBoolResultDealFn: (boolKeyList: string[]) => (params: any) => any;
export declare const genBizStoreParamsDealFn: (params: any) => any;
export declare const setStorageParamsDeal: (params: any) => any;
export declare const getStorageParamsDeal: (params: any) => any;
export declare const removeStorageParamsDeal: (params: any) => any;
export declare const scanParamsDeal: (params: any) => any;
export declare const getNetWorkTypeResultDeal: (result: any) => {
    netWorkAvailable: boolean;
    netWorkType: any;
    newWorkAvailable?: undefined;
} | {
    newWorkAvailable: boolean;
    netWorkAvailable?: undefined;
    netWorkType?: undefined;
};
/**
 *
 * @returns 当前环境的全局变量
 * webview默认document，context默认主context的this
 */
export declare function getGlobalSelf(): typeof window;
