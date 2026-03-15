import { ICommonAPIParams } from '../../constant/types';
/**
 * 编辑外部联系人 请求参数定义
 * @apiName editExternalUser
 */
export interface IUnionEditExternalUserParams extends ICommonAPIParams {
    job?: string;
    name?: string;
    title?: string;
    corpId?: string;
    emplId?: string;
    mobile?: string;
    remark?: string;
    deptName?: string;
    companyName?: string;
}
/**
 * 编辑外部联系人 返回结果定义
 * @apiName editExternalUser
 */
export interface IUnionEditExternalUserResult {
    job?: string;
    name?: string;
    mobile?: string;
    remark?: string;
    userId?: string;
    deptName?: string;
    companyName?: string;
}
/**
 * 编辑外部联系人
 * @apiName editExternalUser
 */
export declare function editExternalUser$(params: IUnionEditExternalUserParams): Promise<IUnionEditExternalUserResult>;
export default editExternalUser$;
