export declare const apiName = "internal.search.debug";
/**
 * 搜索调试 请求参数定义
 * @apiName internal.search.debug
 */
export interface IInternalSearchDebugParams {
    [key: string]: any;
}
/**
 * 搜索调试 返回结果定义
 * @apiName internal.search.debug
 */
export interface IInternalSearchDebugResult {
    [key: string]: any;
}
/**
 * 搜索调试
 * @apiName internal.search.debug
 * @supportVersion  pc: 4.1.0 ios: 4.1.0 android: 4.1.0
 */
export declare function debug$(params: IInternalSearchDebugParams): Promise<IInternalSearchDebugResult>;
export default debug$;
