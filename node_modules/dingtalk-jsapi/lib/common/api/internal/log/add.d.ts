export declare const apiName = "internal.log.add";
/**
 * 日志写入到客户端 请求参数定义
 * @apiName internal.log.add
 */
export interface IInternalLogAddParams {
    text: string;
    /** type用来做业务标识，可为空 */
    type?: string;
}
/**
 * 日志写入到客户端 返回结果定义
 * @apiName internal.log.add
 */
export interface IInternalLogAddResult {
    [key: string]: any;
}
/**
 * 日志写入到客户端
 * @apiName internal.log.add
 * @supportVersion  ios: 2.7.6 android: 2.7.6
 */
export declare function add$(params: IInternalLogAddParams): Promise<IInternalLogAddResult>;
export default add$;
