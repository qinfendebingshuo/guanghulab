export declare const apiName = "internal.teleVideo.registPushHandler";
/**
 * 注册推送监听 请求参数定义
 * @apiName internal.teleVideo.registPushHandler
 */
export interface IInternalTeleVideoRegistPushHandlerParams {
}
/**
 * 注册推送监听 返回结果定义
 * @apiName internal.teleVideo.registPushHandler
 */
export interface IInternalTeleVideoRegistPushHandlerResult {
}
/**
 * 注册推送监听
 * @apiName internal.teleVideo.registPushHandler
 * @supportVersion ios: 4.6.42 android: 4.6.42
 */
export declare function registPushHandler$(params: IInternalTeleVideoRegistPushHandlerParams): Promise<IInternalTeleVideoRegistPushHandlerResult>;
export default registPushHandler$;
