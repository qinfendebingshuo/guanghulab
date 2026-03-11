import { ICommonAPIParams } from '../../constant/types';
/**
 * 拨打钉钉电话 请求参数定义
 * @apiName callUsers
 */
export interface IUnionCallUsersParams extends ICommonAPIParams {
    users: string[];
    corpId?: string;
}
/**
 * 拨打钉钉电话 返回结果定义
 * @apiName callUsers
 */
export interface IUnionCallUsersResult {
}
/**
 * 拨打钉钉电话
 * @apiName callUsers
 */
export declare function callUsers$(params: IUnionCallUsersParams): Promise<IUnionCallUsersResult>;
export default callUsers$;
