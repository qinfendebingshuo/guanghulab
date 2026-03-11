export declare const apiName = "internal.contact.chooseEnterpriseUser";
/**
 * 选择企业用户 请求参数定义
 * @apiName internal.contact.chooseEnterpriseUser
 */
export interface IInternalContactChooseEnterpriseUserParams {
    /** 企业id */
    corpId: string;
    /** 选人界面标题 */
    title: string;
    /** 最大可选人数 */
    max?: number;
    /** 默认选中的用户 JSONArray 可选 */
    users?: string[];
    /** 必须选择的用户 */
    required?: string[];
}
/**
 * 选择企业用户 返回结果定义
 * @apiName internal.contact.chooseEnterpriseUser
 */
export declare type IInternalContactChooseEnterpriseUserResult = Array<{
    name: string;
    encryptionUid: string;
    avatar: string;
    emplId: string;
}>;
/**
 * 选择企业用户
 * @apiName internal.contact.chooseEnterpriseUser
 * @supportVersion ios: 4.6.8 android: 4.6.8
 */
export declare function chooseEnterpriseUser$(params: IInternalContactChooseEnterpriseUserParams): Promise<IInternalContactChooseEnterpriseUserResult>;
export default chooseEnterpriseUser$;
