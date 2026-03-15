import { ICommonAPIParams } from '../../constant/types';
/**
 * 单选自定义联系人 请求参数定义
 * @apiName chooseUserFromList
 */
export interface IUnionChooseUserFromListParams extends ICommonAPIParams {
    title?: string;
    users: string[];
    corpId?: string;
    disabledUsers?: string[];
    isShowCompanyName?: boolean;
}
/**
 * 单选自定义联系人 返回结果定义
 * @apiName chooseUserFromList
 */
export interface IUnionChooseUserFromListResult {
    name: string;
    avatar: string;
    userId: string;
}
/**
 * 单选自定义联系人
 * @apiName chooseUserFromList
 */
export declare function chooseUserFromList$(params: IUnionChooseUserFromListParams): Promise<IUnionChooseUserFromListResult>;
export default chooseUserFromList$;
