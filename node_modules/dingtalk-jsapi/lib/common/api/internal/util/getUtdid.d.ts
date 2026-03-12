export declare const apiName = "internal.util.getUtdid";
/**
 * 获取设备utdid，钉钉内部使用，非对外 请求参数定义
 * @apiName internal.util.getUtdid
 */
export interface IInternalUtilGetUtdidParams {
}
/**
 * 获取设备utdid，钉钉内部使用，非对外 返回结果定义
 * @apiName internal.util.getUtdid
 */
export interface IInternalUtilGetUtdidResult {
    utdid: string;
}
/**
 * 获取设备utdid，钉钉内部使用，非对外
 * @apiName internal.util.getUtdid
 * @supportVersion ios: 5.0.7 android: 5.0.7
 * @author ios: 驽良, android: 龙雀
 */
export declare function getUtdid$(params: IInternalUtilGetUtdidParams): Promise<IInternalUtilGetUtdidResult>;
export default getUtdid$;
