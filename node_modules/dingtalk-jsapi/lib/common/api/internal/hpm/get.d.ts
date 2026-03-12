export declare const apiName = "internal.hpm.get";
/**
 * 获取hpm配置信息（暂未开发） 请求参数定义
 * @apiName internal.hpm.get
 */
export interface IInternalHpmGetParams {
    [key: string]: any;
}
/**
 * 获取hpm配置信息（暂未开发） 返回结果定义
 * @apiName internal.hpm.get
 */
export interface IInternalHpmGetResult {
    [key: string]: any;
}
/**
 * 获取hpm配置信息（暂未开发）
 * @apiName internal.hpm.get
 * @supportVersion  ios: 2.7.0 android: 2.7.0
 */
export declare function get$(params: IInternalHpmGetParams): Promise<IInternalHpmGetResult>;
export default get$;
