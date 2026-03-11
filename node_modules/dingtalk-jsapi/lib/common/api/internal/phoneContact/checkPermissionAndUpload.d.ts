export declare const apiName = "internal.phoneContact.checkPermissionAndUpload";
/**
 * 校验客户端读取手机通讯录权限，当已有权限或新授予权限时，触发一次上传 请求参数定义
 * @apiName internal.phoneContact.checkPermissionAndUpload
 */
export interface IInternalPhoneContactCheckPermissionAndUploadParams {
    [key: string]: any;
}
/**
 * 校验客户端读取手机通讯录权限，当已有权限或新授予权限时，触发一次上传 返回结果定义
 * "1" ---表示已有权限
 * "2" ---表示新授予权限
 * "3" ---表示拒绝授予权限
 * "4" ---表示不再询问
 * @apiName internal.phoneContact.checkPermissionAndUpload
 */
export declare type IInternalPhoneContactCheckPermissionAndUploadResult = string;
/**
 * 校验客户端读取手机通讯录权限，当已有权限或新授予权限时，触发一次上传
 * @apiName internal.phoneContact.checkPermissionAndUpload
 * @supportVersion ios: 4.5.16 android: 4.5.16
 */
export declare function checkPermissionAndUpload$(params: IInternalPhoneContactCheckPermissionAndUploadParams): Promise<IInternalPhoneContactCheckPermissionAndUploadResult>;
export default checkPermissionAndUpload$;
