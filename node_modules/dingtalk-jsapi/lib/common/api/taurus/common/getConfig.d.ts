export declare const apiName = "taurus.common.getConfig";
/**
 * 获取常用服务端 & 客户端配置信息 请求参数定义
 * @apiName taurus.common.getConfig
 */
export interface ITaurusCommonGetConfigParams {
}
/**
 * 获取常用服务端 & 客户端配置信息 返回结果定义
 * @apiName taurus.common.getConfig
 */
export interface ITaurusCommonGetConfigResult {
    host?: string;
    mediaHost?: string;
}
/**
 * 获取常用服务端 & 客户端配置信息
 * @apiName taurus.common.getConfig
 * @supportVersion ios: 2.7.0 android: 2.7.0
 */
export declare function getConfig$(params?: ITaurusCommonGetConfigParams): Promise<ITaurusCommonGetConfigResult>;
export default getConfig$;
