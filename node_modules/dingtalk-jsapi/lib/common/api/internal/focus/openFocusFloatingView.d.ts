export declare const apiName = "internal.focus.openFocusFloatingView";
/**
 * 开启投屏悬浮窗 请求参数定义
 * @apiName internal.focus.openFocusFloatingView
 */
export interface IInternalFocusOpenFocusFloatingViewParams {
    /** 点击悬浮窗后跳转的地址 */
    href: string;
}
/**
 * 开启投屏悬浮窗 返回结果定义
 * @apiName internal.focus.openFocusFloatingView
 */
export interface IInternalFocusOpenFocusFloatingViewResult {
    [key: string]: any;
}
/**
 * 开启投屏悬浮窗
 * @apiName internal.focus.openFocusFloatingView
 * @supportVersion android: 4.7.23
 * @author android: 柳樵, ios: 见招
 */
export declare function openFocusFloatingView$(params: IInternalFocusOpenFocusFloatingViewParams): Promise<IInternalFocusOpenFocusFloatingViewResult>;
export default openFocusFloatingView$;
