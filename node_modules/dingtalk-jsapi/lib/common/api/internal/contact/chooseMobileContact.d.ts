export declare const apiName = "internal.contact.chooseMobileContact";
/**
 * 手机通讯录选人（单选） 请求参数定义
 * @apiName internal.contact.chooseMobileContact
 */
export interface IInternalContactChooseMobileContactParams {
    [key: string]: any;
}
/**
 * 手机通讯录选人（单选） 返回结果定义
 * @apiName internal.contact.chooseMobileContact
 */
export interface IInternalContactChooseMobileContactResult {
    [key: string]: any;
}
/**
 * 手机通讯录选人（单选）
 * @apiName internal.contact.chooseMobileContact
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function chooseMobileContact$(params: IInternalContactChooseMobileContactParams): Promise<IInternalContactChooseMobileContactResult>;
export default chooseMobileContact$;
