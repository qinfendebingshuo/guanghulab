import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取账号类型 请求参数定义
 * @apiName getAccountType
 */
export interface IUnionGetAccountTypeParams extends ICommonAPIParams {
}
/**
 * 获取账号类型 返回结果定义
 * @apiName getAccountType
 */
export interface IUnionGetAccountTypeResult {
    isOversea: boolean;
    accountType: string;
}
/**
 * 获取账号类型
 * @apiName getAccountType
 */
export declare function getAccountType$(params: IUnionGetAccountTypeParams): Promise<IUnionGetAccountTypeResult>;
export default getAccountType$;
