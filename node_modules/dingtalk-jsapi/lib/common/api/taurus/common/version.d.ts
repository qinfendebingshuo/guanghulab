export declare const apiName = "taurus.common.version";
export interface ITaurusCommonVersionParams {
}
/**
 * 获取客户端版本 返回结果定义
 * @apiName taurus.common.version
 */
export interface ITaurusCommonVersionResult {
    version: string;
}
/**
 * 获取客户端版本
 * @apiName taurus.common.version
 * @supportVersion ios: 1.3.2 android: 1.3.2
 */
export declare function version$(params?: ITaurusCommonVersionParams): Promise<ITaurusCommonVersionResult>;
export default version$;
