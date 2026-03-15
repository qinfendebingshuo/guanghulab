import { ICommonAPIParams } from '../../constant/types';
/**
 * 多选自定义联系人 请求参数定义
 * @apiName customChooseUsers
 */
export interface IUnionCustomChooseUsersParams extends ICommonAPIParams {
}
/**
 * 多选自定义联系人 返回结果定义
 * @apiName customChooseUsers
 */
export interface IUnionCustomChooseUsersResult {
}
/**
 * 多选自定义联系人
 * @apiName customChooseUsers
 */
export declare function customChooseUsers$(params: IUnionCustomChooseUsersParams): Promise<IUnionCustomChooseUsersResult>;
export default customChooseUsers$;
