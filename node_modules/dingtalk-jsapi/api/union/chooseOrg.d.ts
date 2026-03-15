import { ICommonAPIParams } from '../../constant/types';
/**
 * 选择组织 请求参数定义
 * @apiName chooseOrg
 */
export interface IUnionChooseOrgParams extends ICommonAPIParams {
    title: string;
    corpIds: string[];
    emptyTips: string;
    useDefault: boolean;
    selectCorpId: string;
}
/**
 * 选择组织 返回结果定义
 * @apiName chooseOrg
 */
export interface IUnionChooseOrgResult {
    selectCorpId: string;
}
/**
 * 选择组织
 * @apiName chooseOrg
 */
export declare function chooseOrg$(params: IUnionChooseOrgParams): Promise<IUnionChooseOrgResult>;
export default chooseOrg$;
