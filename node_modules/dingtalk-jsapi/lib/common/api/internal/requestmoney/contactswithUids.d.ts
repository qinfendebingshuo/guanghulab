export declare const apiName = "internal.requestmoney.contactswithUids";
/**
 * 批量获取联系人信息 请求参数定义
 * @apiName internal.requestmoney.contactswithUids
 */
export interface IInternalRequestmoneyContactswithUidsParams {
    [key: string]: any;
}
/**
 * 批量获取联系人信息 返回结果定义
 * @apiName internal.requestmoney.contactswithUids
 */
export interface IInternalRequestmoneyContactswithUidsResult {
    users?: Array<{
        uid: number;
        nick: string;
        avatarURL: string;
    }>;
}
/**
 * 批量获取联系人信息
 * @apiName internal.requestmoney.contactswithUids
 * @supportVersion ios: 4.5.8 android: 4.5.8
 */
export declare function contactswithUids$(params: IInternalRequestmoneyContactswithUidsParams): Promise<IInternalRequestmoneyContactswithUidsResult>;
export default contactswithUids$;
