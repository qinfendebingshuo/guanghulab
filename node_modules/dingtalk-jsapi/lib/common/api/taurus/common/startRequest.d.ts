export declare const apiName = "taurus.common.startRequest";
/**
 * 专有钉内部的请求方法 请求参数定义
 * @apiName taurus.common.startRequest
 */
export interface ITaurusCommonStartRequestParams {
    apiName: string;
    params: any;
}
/**
 * 专有钉内部的请求方法 返回结果定义
 * @apiName taurus.common.startRequest
 */
export interface ITaurusCommonStartRequestResult {
    [key: string]: any;
}
/**
 * 专有钉内部的请求方法
 * @apiName taurus.common.startRequest
 * @supportVersion ios: 2.7.0 android: 2.7.0
 */
export declare function startRequest$(params: ITaurusCommonStartRequestParams): Promise<ITaurusCommonStartRequestResult>;
export default startRequest$;
