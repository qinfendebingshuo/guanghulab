export declare const apiName = "internal.teleVideo.unregistPushHandler";
/**
 * 取消注册推送监听 请求参数定义
 * @apiName internal.teleVideo.unregistPushHandler
 */
export interface IInternalTeleVideoUnregistPushHandlerParams {
}
/**
 * 取消注册推送监听 返回结果定义
 * @apiName internal.teleVideo.unregistPushHandler
 */
export interface IInternalTeleVideoUnregistPushHandlerResult {
}
/**
 * 取消注册推送监听
 * @apiName internal.teleVideo.unregistPushHandler
 * @supportVersion ios: 4.6.42 android: 4.6.42
 */
export declare function unregistPushHandler$(params: IInternalTeleVideoUnregistPushHandlerParams): Promise<IInternalTeleVideoUnregistPushHandlerResult>;
export default unregistPushHandler$;
