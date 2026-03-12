export declare const apiName = "internal.contact.chooseOrgAddress";
/**
 * 打开对应企业的位置列表，提供位置选择的功能 请求参数定义
 * @apiName internal.contact.chooseOrgAddress
 */
export interface IInternalContactChooseOrgAddressParams {
    [key: string]: any;
}
/**
 * 打开对应企业的位置列表，提供位置选择的功能 返回结果定义
 * @apiName internal.contact.chooseOrgAddress
 */
export interface IInternalContactChooseOrgAddressResult {
    [key: string]: any;
}
/**
 * 打开对应企业的位置列表，提供位置选择的功能
 * @apiName internal.contact.chooseOrgAddress
 * @supportVersion  ios: 3.5.6 android: 3.5.6
 */
export declare function chooseOrgAddress$(params: IInternalContactChooseOrgAddressParams): Promise<IInternalContactChooseOrgAddressResult>;
export default chooseOrgAddress$;
