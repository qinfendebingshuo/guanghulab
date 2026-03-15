export declare const apiName = "internal.hpm.update";
/**
 * 更新hpm 请求参数定义
 * @apiName internal.hpm.update
 */
export interface IInternalHpmUpdateParams {
    [key: string]: any;
}
/**
 * 更新hpm 返回结果定义
 * @apiName internal.hpm.update
 */
export interface IInternalHpmUpdateResult {
    [key: string]: any;
}
/**
 * 更新hpm
 * @apiName internal.hpm.update
 * @supportVersion  ios: 2.7.0 android: 2.7.0
 */
export declare function update$(params: IInternalHpmUpdateParams): Promise<IInternalHpmUpdateResult>;
export default update$;
