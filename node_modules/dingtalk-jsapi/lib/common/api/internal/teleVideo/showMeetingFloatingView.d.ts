export declare const apiName = "internal.teleVideo.showMeetingFloatingView";
/**
 * 显示本地悬浮窗 请求参数定义
 * @apiName internal.teleVideo.showMeetingFloatingView
 */
export interface IInternalTeleVideoShowMeetingFloatingViewParams {
    /** 点击悬浮窗打开的页面地址 */
    href: string;
}
/**
 * 显示本地悬浮窗 返回结果定义
 * @apiName internal.teleVideo.showMeetingFloatingView
 */
export interface IInternalTeleVideoShowMeetingFloatingViewResult {
}
/**
 * 显示本地悬浮窗
 * @apiName internal.teleVideo.showMeetingFloatingView
 * @supportVersion ios: 4.6.42 android: 4.6.42
 */
export declare function showMeetingFloatingView$(params: IInternalTeleVideoShowMeetingFloatingViewParams): Promise<IInternalTeleVideoShowMeetingFloatingViewResult>;
export default showMeetingFloatingView$;
