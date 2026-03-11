export declare const apiName = "internal.focus.closeFocusFloatingView";
/**
 * 关闭投屏悬浮窗 请求参数定义
 * @apiName internal.focus.closeFocusFloatingView
 */
export interface IInternalFocusCloseFocusFloatingViewParams {
}
/**
 * 关闭投屏悬浮窗 返回结果定义
 * @apiName internal.focus.closeFocusFloatingView
 */
export interface IInternalFocusCloseFocusFloatingViewResult {
}
/**
 * 关闭投屏悬浮窗
 * @apiName internal.focus.closeFocusFloatingView
 * @supportVersion android: 4.7.23
 * @author android: 柳樵, ios: 见招
 */
export declare function closeFocusFloatingView$(params: IInternalFocusCloseFocusFloatingViewParams): Promise<IInternalFocusCloseFocusFloatingViewResult>;
export default closeFocusFloatingView$;
