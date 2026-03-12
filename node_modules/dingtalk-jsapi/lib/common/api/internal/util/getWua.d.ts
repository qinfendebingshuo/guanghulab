export declare const apiName = "internal.util.getWua";
/**
 * 人机识别 请求参数定义
 * @apiName internal.util.getWua
 */
export interface IInternalUtilGetWuaParams {
    [key: string]: any;
}
/**
 * 人机识别 返回结果定义
 * @apiName internal.util.getWua
 */
export interface IInternalUtilGetWuaResult {
    [key: string]: any;
}
/**
 * 人机识别
 * @apiName internal.util.getWua
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function getWua$(params: IInternalUtilGetWuaParams): Promise<IInternalUtilGetWuaResult>;
export default getWua$;
