export declare const apiName = "biz.util.warn";
/**
 * 报警接口 请求参数定义
 * @apiName biz.util.warn
 */
export interface IBizUtilWarnParams {
    [key: string]: any;
}
/**
 * 报警接口 返回结果定义
 * @apiName biz.util.warn
 */
export interface IBizUtilWarnResult {
    [key: string]: any;
}
/**
 * 报警接口
 * @apiName biz.util.warn
 * @supportVersion  ios: 2.7.6 android: 2.7.6
 */
export declare function warn$(params: IBizUtilWarnParams): Promise<IBizUtilWarnResult>;
export default warn$;
