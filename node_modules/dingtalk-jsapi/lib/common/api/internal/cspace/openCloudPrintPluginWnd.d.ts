export declare const apiName = "internal.cspace.openCloudPrintPluginWnd";
/**
 * 跳转到安装本地虚拟驱动云打印插件窗口 请求参数定义
 * @apiName internal.cspace.openCloudPrintPluginWnd
 */
export interface IInternalCspaceOpenCloudPrintPluginWndParams {
    /** 企业id */
    cropId: string;
    /** 下载插件的url */
    downLoadPluginUrl: string;
    /** 插件的版本 */
    pluginVersion: string;
}
/**
 * 跳转到安装本地虚拟驱动云打印插件窗口 返回结果定义
 * @apiName internal.cspace.openCloudPrintPluginWnd
 */
export interface IInternalCspaceOpenCloudPrintPluginWndResult {
}
/**
 * 跳转到安装本地虚拟驱动云打印插件窗口
 * @apiName internal.cspace.openCloudPrintPluginWnd
 * @supportVersion ios: 4.3.5 android: 4.3.5
 */
export declare function openCloudPrintPluginWnd$(params: IInternalCspaceOpenCloudPrintPluginWndParams): Promise<IInternalCspaceOpenCloudPrintPluginWndResult>;
export default openCloudPrintPluginWnd$;
