export declare const apiName = "internal.cspace.openCloudPrintWnd";
/**
 * 打开云打印窗口（效果与从钉盘点击云打印一样） 请求参数定义
 * @apiName internal.cspace.openCloudPrintWnd
 */
export interface IInternalCspaceOpenCloudPrintWndParams {
    /**  1: 钉盘文件 2：mediaid */
    fileType: number;
    /** fileType为1时有效 */
    spaceId?: string;
    /** fileType为1时有效 */
    fileId?: string;
    /** fileType为1时有效 */
    encrypt?: any;
    /** fileType为2时有效 */
    mediaId?: string;
}
/**
 * 打开云打印窗口（效果与从钉盘点击云打印一样） 返回结果定义
 * @apiName internal.cspace.openCloudPrintWnd
 */
export interface IInternalCspaceOpenCloudPrintWndResult {
    [key: string]: any;
}
/**
 * 打开云打印窗口（效果与从钉盘点击云打印一样）
 * @apiName internal.cspace.openCloudPrintWnd
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function openCloudPrintWnd$(params: IInternalCspaceOpenCloudPrintWndParams): Promise<IInternalCspaceOpenCloudPrintWndResult>;
export default openCloudPrintWnd$;
