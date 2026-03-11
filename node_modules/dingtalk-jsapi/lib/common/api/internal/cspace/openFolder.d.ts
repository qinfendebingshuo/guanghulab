export declare const apiName = "internal.cspace.openFolder";
/**
 * 进入钉盘指定目录 请求参数定义
 * @apiName internal.cspace.openFolder
 */
export interface IInternalCspaceOpenFolderParams {
    [key: string]: any;
}
/**
 * 进入钉盘指定目录 返回结果定义
 * @apiName internal.cspace.openFolder
 */
export interface IInternalCspaceOpenFolderResult {
    [key: string]: any;
}
/**
 * 进入钉盘指定目录
 * @apiName internal.cspace.openFolder
 * @supportVersion  pc: 4.2.5 ios: 4.2.5 android: 4.2.5
 */
export declare function openFolder$(params: IInternalCspaceOpenFolderParams): Promise<IInternalCspaceOpenFolderResult>;
export default openFolder$;
