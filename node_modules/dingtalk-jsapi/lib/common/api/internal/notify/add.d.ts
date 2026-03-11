export declare const apiName = "internal.notify.add";
/**
 * 添加消息 请求参数定义
 * @apiName internal.notify.add
 */
export interface IInternalNotifyAddParams {
    [key: string]: any;
}
/**
 * 添加消息 返回结果定义
 * @apiName internal.notify.add
 */
export interface IInternalNotifyAddResult {
    [key: string]: any;
}
/**
 * 添加消息
 * @apiName internal.notify.add
 * @supportVersion  ios: 3.3.0 android: 3.3.0
 */
export declare function add$(params: IInternalNotifyAddParams): Promise<IInternalNotifyAddResult>;
export default add$;
