export declare const apiName = "internal.util.encryData";
/**
 * 参数加密生成key 请求参数定义
 * @apiName internal.util.encryData
 */
export interface IInternalUtilEncryDataParams {
    [key: string]: any;
}
/**
 * 参数加密生成key 返回结果定义
 * @apiName internal.util.encryData
 */
export interface IInternalUtilEncryDataResult {
    [key: string]: any;
}
/**
 * 参数加密生成key
 * @apiName internal.util.encryData
 * @supportVersion  ios: 2.5.2 android: 2.5.2
 */
export declare function encryData$(params: IInternalUtilEncryDataParams): Promise<IInternalUtilEncryDataResult>;
export default encryData$;
