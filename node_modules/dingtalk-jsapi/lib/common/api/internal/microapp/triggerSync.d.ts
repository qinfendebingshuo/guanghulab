export declare const apiName = "internal.microapp.triggerSync";
/**
 * 触发cloudsetting数据同步，进而更新配置中心(oa_user)数据 请求参数定义
 * @apiName internal.microapp.triggerSync
 */
export interface IInternalMicroappTriggerSyncParams {
    [key: string]: any;
}
/**
 * 触发cloudsetting数据同步，进而更新配置中心(oa_user)数据 返回结果定义
 * @apiName internal.microapp.triggerSync
 */
export interface IInternalMicroappTriggerSyncResult {
    [key: string]: any;
}
/**
 * 触发cloudsetting数据同步，进而更新配置中心(oa_user)数据
 * @apiName internal.microapp.triggerSync
 * @supportVersion  ios: 3.5.6 android: 3.5.6
 */
export declare function triggerSync$(params: IInternalMicroappTriggerSyncParams): Promise<IInternalMicroappTriggerSyncResult>;
export default triggerSync$;
