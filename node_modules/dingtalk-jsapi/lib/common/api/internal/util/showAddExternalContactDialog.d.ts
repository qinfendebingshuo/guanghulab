export declare const apiName = "internal.util.showAddExternalContactDialog";
/**
 * 唤起添加外部联系人组件 请求参数定义
 * @apiName internal.util.showAddExternalContactDialog
 */
export interface IInternalUtilShowAddExternalContactDialogParams {
    [key: string]: any;
}
/**
 * 唤起添加外部联系人组件 返回结果定义
 * @apiName internal.util.showAddExternalContactDialog
 */
export interface IInternalUtilShowAddExternalContactDialogResult {
    [key: string]: any;
}
/**
 * 唤起添加外部联系人组件
 * @apiName internal.util.showAddExternalContactDialog
 * @supportVersion  ios: 3.5.3 android: 3.5.3
 */
export declare function showAddExternalContactDialog$(params: IInternalUtilShowAddExternalContactDialogParams): Promise<IInternalUtilShowAddExternalContactDialogResult>;
export default showAddExternalContactDialog$;
