import { ICommonAPIParams } from '../../constant/types';
/**
 * 选择地区 请求参数定义
 * @apiName chooseDistrict
 */
export interface IUnionChooseDistrictParams extends ICommonAPIParams {
    selectedCode?: string;
}
/**
 * 选择地区 返回结果定义
 * @apiName chooseDistrict
 */
export interface IUnionChooseDistrictResult {
    region?: string;
    regionCode: string;
    regionName: string;
    regionFullName: string;
}
/**
 * 选择地区
 * @apiName chooseDistrict
 */
export declare function chooseDistrict$(params: IUnionChooseDistrictParams): Promise<IUnionChooseDistrictResult>;
export default chooseDistrict$;
