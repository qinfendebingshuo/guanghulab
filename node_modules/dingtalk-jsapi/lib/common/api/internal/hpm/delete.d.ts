export declare const apiName = "internal.hpm.delete";
/**
 * hpm删除 请求参数定义
 * @apiName internal.hpm.delete
 */
export interface IInternalHpmDeleteParams {
    [key: string]: any;
}
/**
 * hpm删除 返回结果定义
 * @apiName internal.hpm.delete
 */
export interface IInternalHpmDeleteResult {
    [key: string]: any;
}
/**
 * hpm删除
 * @apiName internal.hpm.delete
 * @supportVersion  ios: 2.15.0 android: 2.15.0
 */
export declare function delete$(params: IInternalHpmDeleteParams): Promise<IInternalHpmDeleteResult>;
export default delete$;
