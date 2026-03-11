export declare const apiName = "internal.phoneContact.requestPermissionAndUploadWhenAuthed";
/**
 * 请求通讯录权限（如果还未授权过），并且在用户同意授权的情况下，上传通讯录 请求参数定义
 * @apiName internal.phoneContact.requestPermissionAndUploadWhenAuthed
 */
export interface IInternalPhoneContactRequestPermissionAndUploadWhenAuthedParams {
}
/**
 * 请求通讯录权限（如果还未授权过），并且在用户同意授权的情况下，上传通讯录 返回结果定义
 * @apiName internal.phoneContact.requestPermissionAndUploadWhenAuthed
 */
export interface IInternalPhoneContactRequestPermissionAndUploadWhenAuthedResult {
    /**
     * 用户授权结果
     * result取值：
     * "1" ---表示已有权限
     * "2" ---表示新授予权限
     * "3" ---表示拒绝授予权限
     * "4" ---表示不再询问
     */
    result: string;
}
/**
 * 请求通讯录权限（如果还未授权过），并且在用户同意授权的情况下，上传通讯录
 * @apiName internal.phoneContact.requestPermissionAndUploadWhenAuthed
 * @supportVersion ios: 5.1.19 android: 5.1.19
 * @author iOS：姚曦 Android：几米
 */
export declare function requestPermissionAndUploadWhenAuthed$(params: IInternalPhoneContactRequestPermissionAndUploadWhenAuthedParams): Promise<IInternalPhoneContactRequestPermissionAndUploadWhenAuthedResult>;
export default requestPermissionAndUploadWhenAuthed$;
