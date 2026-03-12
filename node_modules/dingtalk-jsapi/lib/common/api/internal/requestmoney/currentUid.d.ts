export declare const apiName = "internal.requestmoney.currentUid";
/**
 * 获取当前用户uid 请求参数定义
 * @apiName internal.requestmoney.currentUid
 */
export interface IInternalRequestmoneyCurrentUidParams {
    [key: string]: any;
}
/**
 * 获取当前用户uid 返回结果定义
 * @apiName internal.requestmoney.currentUid
 */
export interface IInternalRequestmoneyCurrentUidResult {
    /** 当前用户uid */
    result: number;
}
/**
 * 获取当前用户uid
 * @apiName internal.requestmoney.currentUid
 * @supportVersion ios: 4.5.9 android: 4.5.9
 */
export declare function currentUid$(params: IInternalRequestmoneyCurrentUidParams): Promise<IInternalRequestmoneyCurrentUidResult>;
export default currentUid$;
