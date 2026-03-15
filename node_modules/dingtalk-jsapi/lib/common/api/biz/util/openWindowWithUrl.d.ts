export declare const apiName = "biz.util.openWindowWithUrl";
/**
 * 客户端用于打开一个单独窗口的页面进行展示 请求参数定义
 * @apiName biz.util.openWindowWithUrl
 */
export interface IBizUtilOpenWindowWithUrlParams {
    /** 窗口id */
    wndId: string;
    /** 要打开的网址 */
    url: string;
    /** 窗口标题 */
    title: string;
    /** 是否隐藏在任务栏的显示 */
    isHideTaskBar?: boolean;
    /** 是否隐藏标题栏 */
    isHideWndHeader?: boolean;
    /** 是否禁用窗口大小调整 */
    isDisableResize?: boolean;
    /** 是否禁用记住上次窗口位置 */
    isDisableRememberPosition?: boolean;
    /** 默认宽 */
    width?: number;
    /** 默认高 */
    height?: number;
    /** 最小宽 */
    minWidth?: number;
    /** 最小高 */
    minHeight?: number;
    /** 相对调用者窗口的偏移X */
    offsetClientX?: number;
    /** 相对调用者窗口的偏移Y */
    offsetClientY?: number;
}
/**
 * 客户端用于打开一个单独窗口的页面进行展示 返回结果定义
 * @apiName biz.util.openWindowWithUrl
 */
export interface IBizUtilOpenWindowWithUrlResult {
}
/**
 * 客户端用于打开一个单独窗口的页面进行展示
 * @apiName biz.util.openWindowWithUrl
 * @supportVersion pc: 6.0.13
 * @author win：周镛 mac：伯温
 */
export declare function openWindowWithUrl$(params: IBizUtilOpenWindowWithUrlParams): Promise<IBizUtilOpenWindowWithUrlResult>;
export default openWindowWithUrl$;
