export declare const apiName = "internal.cspace.openEditInviteWnd";
/**
 * 打开在线编辑邀请窗口 请求参数定义
 * @apiName internal.cspace.openEditInviteWnd
 */
export interface IInternalCspaceOpenEditInviteWndParams {
    spaceId: string;
    fileId: string;
    extra: any;
}
/**
 * 打开在线编辑邀请窗口 返回结果定义
 * @apiName internal.cspace.openEditInviteWnd
 */
export interface IInternalCspaceOpenEditInviteWndResult {
}
/**
 * 打开在线编辑邀请窗口
 * @apiName internal.cspace.openEditInviteWnd
 * @supportVersion ios: 4.5.1 android: 4.5.1
 */
export declare function openEditInviteWnd$(params: IInternalCspaceOpenEditInviteWndParams): Promise<IInternalCspaceOpenEditInviteWndResult>;
export default openEditInviteWnd$;
