export declare const apiName = "internal.cspace.edit";
/**
 * 钉盘文件编辑功能 请求参数定义
 * @apiName internal.cspace.edit
 */
export interface IInternalCspaceEditParams {
    /** 钉盘空间Id 必选 */
    spaceId: string;
    /** 钉盘文件Id 必选 */
    fileId: string;
}
/**
 * 钉盘文件编辑功能 返回结果定义
 * @apiName internal.cspace.edit
 */
export interface IInternalCspaceEditResult {
}
/**
 * 钉盘文件编辑功能
 * @apiName internal.cspace.edit
 * @supportVersion ios: 4.6.1 android: 4.6.1
 */
export declare function edit$(params: IInternalCspaceEditParams): Promise<IInternalCspaceEditResult>;
export default edit$;
