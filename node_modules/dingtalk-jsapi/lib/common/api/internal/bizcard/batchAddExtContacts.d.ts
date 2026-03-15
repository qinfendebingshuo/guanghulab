export declare const apiName = "internal.bizcard.batchAddExtContacts";
/**
 * 跳转到批量添加外部联系人页面 请求参数定义
 * @apiName internal.bizcard.batchAddExtContacts
 */
export interface IInternalBizcardBatchAddExtContactsParams {
    /** ArrayList<CardSimpleUserModel> (必须有手机号，姓名) */
    userList: any[];
    corpId: string;
}
/**
 * 跳转到批量添加外部联系人页面 返回结果定义
 * @apiName internal.bizcard.batchAddExtContacts
 */
export interface IInternalBizcardBatchAddExtContactsResult {
}
/**
 * 跳转到批量添加外部联系人页面
 * @apiName internal.bizcard.batchAddExtContacts
 * @supportVersion ios: 4.5.21 android: 4.5.21
 */
export declare function batchAddExtContacts$(params: IInternalBizcardBatchAddExtContactsParams): Promise<IInternalBizcardBatchAddExtContactsResult>;
export default batchAddExtContacts$;
