import { ICommonAPIParams } from '../../constant/types';
/**
 * 添加手机联系人 请求参数定义
 * @apiName addPhoneContact
 */
export interface IUnionAddPhoneContactParams extends ICommonAPIParams {
    name: string;
    email?: string;
    remark?: string;
    address?: string;
    phoneNumber: string;
    photoFilePath?: string;
}
/**
 * 添加手机联系人 返回结果定义
 * @apiName addPhoneContact
 */
export interface IUnionAddPhoneContactResult {
    success: boolean;
}
/**
 * 添加手机联系人
 * @apiName addPhoneContact
 */
export declare function addPhoneContact$(params: IUnionAddPhoneContactParams): Promise<IUnionAddPhoneContactResult>;
export default addPhoneContact$;
