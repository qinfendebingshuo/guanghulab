export declare const apiName = "internal.lwp.call";
/**
 * lwp接口(目前只有套件使用) 请求参数定义
 * @apiName internal.lwp.call
 */
export interface IInternalLwpCallParams {
    [key: string]: any;
}
/**
 * lwp接口(目前只有套件使用) 返回结果定义
 * @apiName internal.lwp.call
 */
export interface IInternalLwpCallResult {
    [key: string]: any;
}
/**
 * lwp接口(目前只有套件使用)
 * @apiName internal.lwp.call
 * @supportVersion  ios: 2.5.0 android: 2.5.0
 */
export declare function call$(params: IInternalLwpCallParams): Promise<IInternalLwpCallResult>;
export default call$;
