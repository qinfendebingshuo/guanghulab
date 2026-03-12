export declare const apiName = "taurus.common.authConfig";
/**
 * 用于 JSAPI 鉴权 请求参数定义
 * @apiName taurus.common.authConfig
 */
export interface ITaurusCommonAuthConfigParams {
    ticket: string;
    jsApiList: string[];
}
/**
 * 用于 JSAPI 鉴权 返回结果定义
 * @apiName taurus.common.authConfig
 */
export interface ITaurusCommonAuthConfigResult {
    name: string;
    validateResult: boolean;
}
/**
 * 用于 JSAPI 鉴权
 * @apiName taurus.common.authConfig
 * @supportVersion ios: 1.2.0 android: 1.2.0
 */
export declare function authConfig$(params: ITaurusCommonAuthConfigParams): Promise<ITaurusCommonAuthConfigResult[]>;
export default authConfig$;
