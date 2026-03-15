export declare const apiName = "biz.util.addDesktopShortcuts";
/**
 * 添加桌面快捷方式 请求参数定义
 * @apiName biz.util.addDesktopShortcuts
 */
export interface IBizUtilAddDesktopShortcutsParams {
    [key: string]: any;
}
/**
 * 添加桌面快捷方式 返回结果定义
 * @apiName biz.util.addDesktopShortcuts
 */
export interface IBizUtilAddDesktopShortcutsResult {
    [key: string]: any;
}
/**
 * 添加桌面快捷方式
 * @apiName biz.util.addDesktopShortcuts
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function addDesktopShortcuts$(params: IBizUtilAddDesktopShortcutsParams): Promise<IBizUtilAddDesktopShortcutsResult>;
export default addDesktopShortcuts$;
