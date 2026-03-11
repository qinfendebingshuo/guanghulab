import { ICommonAPIParams } from '../../constant/types';
/**
 * 选择外部联系人 请求参数定义
 * @apiName chooseExternalUsers
 */
export interface IUnionChooseExternalUsersParams extends ICommonAPIParams {
    title: string;
    corpId: string;
    maxUsers: number;
    multiple: boolean;
    limitTips: string;
    pickedUsers: string[];
    disabledUsers: string[];
    requiredUsers: string[];
}
/**
 * 选择外部联系人 返回结果定义
 * @apiName chooseExternalUsers
 */
export interface IUnionChooseExternalUsersResult {
    name: string;
    avatar: string;
    userId: string;
    orgName: string;
}
/**
 * 选择外部联系人
 * @apiName chooseExternalUsers
 */
export declare function chooseExternalUsers$(params: IUnionChooseExternalUsersParams): Promise<IUnionChooseExternalUsersResult>;
export default chooseExternalUsers$;
