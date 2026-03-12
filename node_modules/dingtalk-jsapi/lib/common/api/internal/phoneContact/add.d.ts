export declare const apiName = "internal.phoneContact.add";
/**
 * 添加号码到手机通信录 请求参数定义
 * @apiName internal.phoneContact.add
 */
export interface IInternalPhoneContactAddParams {
    [key: string]: any;
}
/**
 * 添加号码到手机通信录 返回结果定义
 * @apiName internal.phoneContact.add
 */
export interface IInternalPhoneContactAddResult {
    [key: string]: any;
}
/**
 * 添加号码到手机通信录
 * @apiName internal.phoneContact.add
 * @supportVersion  ios: 2.7.6 android: 2.7.6
 */
export declare function add$(params: IInternalPhoneContactAddParams): Promise<IInternalPhoneContactAddResult>;
export default add$;
