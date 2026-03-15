import { ICommonAPIParams } from '../../../constant/types';
/**
 * 添加手机联系人 请求参数定义
 * @apiName biz.phoneContact.add
 */
export interface IBizPhoneContactAddParams extends ICommonAPIParams {
    name: string;
    email?: string;
    remark?: string;
    address?: string;
    phoneNumber: string;
    photoFilePath?: string;
}
/**
 * 添加手机联系人 返回结果定义
 * @apiName biz.phoneContact.add
 */
export interface IBizPhoneContactAddResult {
    success: boolean;
}
/**
 * 添加手机联系人
 * @apiName biz.phoneContact.add
 */
export declare function add$(params: IBizPhoneContactAddParams): Promise<IBizPhoneContactAddResult>;
export default add$;
