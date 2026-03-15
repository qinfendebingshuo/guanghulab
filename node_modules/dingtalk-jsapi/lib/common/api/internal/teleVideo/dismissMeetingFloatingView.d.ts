export declare const apiName = "internal.teleVideo.dismissMeetingFloatingView";
/**
 * 消失本地悬浮窗 请求参数定义
 * @apiName internal.teleVideo.dismissMeetingFloatingView
 */
export interface IInternalTeleVideoDismissMeetingFloatingViewParams {
}
/**
 * 消失本地悬浮窗 返回结果定义
 * @apiName internal.teleVideo.dismissMeetingFloatingView
 */
export interface IInternalTeleVideoDismissMeetingFloatingViewResult {
}
/**
 * 消失本地悬浮窗
 * @apiName internal.teleVideo.dismissMeetingFloatingView
 * @supportVersion ios: 4.6.42 android: 4.6.42
 */
export declare function dismissMeetingFloatingView$(params: IInternalTeleVideoDismissMeetingFloatingViewParams): Promise<IInternalTeleVideoDismissMeetingFloatingViewResult>;
export default dismissMeetingFloatingView$;
